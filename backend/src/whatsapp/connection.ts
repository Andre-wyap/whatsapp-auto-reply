import makeWASocket, {
  DisconnectReason,
  WASocket,
  fetchLatestBaileysVersion,
  initAuthCreds,
  BufferJSON,
  AuthenticationState,
  SignalDataTypeMap,
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import { supabase } from '../services/supabase'
import { handleInboundMessage } from './messageHandler'

export let sock: WASocket | null = null
export let qrCode: string | null = null
export let connectionStatus: 'connecting' | 'open' | 'close' = 'connecting'

// Persist entire Baileys auth state in Supabase so it survives Railway restarts
async function useSupabaseAuthState(): Promise<{
  state: AuthenticationState
  saveCreds: () => Promise<void>
}> {
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'baileys_auth_state')
    .single()

  type KeyStore = { [type: string]: { [id: string]: unknown } }
  let stored: { creds?: ReturnType<typeof initAuthCreds>; keys?: KeyStore } = {}

  try {
    if (data?.value && data.value !== '{}') {
      stored = JSON.parse(data.value, BufferJSON.reviver)
    }
  } catch {
    // Start fresh if stored state is invalid
  }

  const creds = stored.creds ?? initAuthCreds()
  const keys: KeyStore = stored.keys ?? {}

  const saveState = async () => {
    await supabase.from('settings').upsert(
      {
        key: 'baileys_auth_state',
        value: JSON.stringify({ creds, keys }, BufferJSON.replacer),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    )
  }

  return {
    state: {
      creds,
      keys: {
        get: async <T extends keyof SignalDataTypeMap>(type: T, ids: string[]) => {
          const result: Partial<Record<string, SignalDataTypeMap[T]>> = {}
          for (const id of ids) {
            const val = keys[type as string]?.[id]
            if (val !== undefined) result[id] = val as SignalDataTypeMap[T]
          }
          return result as { [id: string]: SignalDataTypeMap[T] }
        },
        set: async (data: Partial<{ [T in keyof SignalDataTypeMap]: { [id: string]: SignalDataTypeMap[T] | null } }>) => {
          for (const [type, typeData] of Object.entries(data)) {
            if (!typeData) continue
            if (!keys[type]) keys[type] = {}
            for (const [id, val] of Object.entries(typeData)) {
              if (val === null) {
                delete keys[type][id]
              } else {
                keys[type][id] = val
              }
            }
          }
          await saveState()
        },
      },
    },
    saveCreds: saveState,
  }
}

export async function initWhatsApp() {
  const { state, saveCreds } = await useSupabaseAuthState()
  const { version } = await fetchLatestBaileysVersion()

  sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: true,
    logger: require('pino')({ level: 'warn' }),
  })

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      qrCode = qr
      connectionStatus = 'connecting'
      console.log('QR code ready — scan in the setup page')
    }

    if (connection === 'close') {
      connectionStatus = 'close'
      qrCode = null
      const code = (lastDisconnect?.error as Boom)?.output?.statusCode
      const shouldReconnect = code !== DisconnectReason.loggedOut
      console.log(`Connection closed (code ${code}). Reconnect: ${shouldReconnect}`)
      if (shouldReconnect) {
        setTimeout(initWhatsApp, 5000)
      }
    } else if (connection === 'open') {
      connectionStatus = 'open'
      qrCode = null
      console.log('WhatsApp connected')
    }
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('messages.upsert', ({ messages, type }) => {
    if (type === 'notify') {
      messages.forEach(handleInboundMessage)
    }
  })

  sock.ev.on('contacts.upsert', async (contacts) => {
    const toUpsert: { name: string; phone: string; tags: string[] }[] = []
    for (const contact of contacts) {
      const jid = contact.id
      if (!jid.match(/^\d+@(s\.whatsapp\.net|lid)$/)) continue
      const name = contact.name ?? contact.notify ?? contact.verifiedName
      if (!name) continue
      const phone = '+' + jid.replace(/@.*$/, '')
      toUpsert.push({ phone, name, tags: [] })
    }
    if (toUpsert.length === 0) return
    const { error } = await supabase
      .from('contacts')
      .upsert(toUpsert, { onConflict: 'phone', ignoreDuplicates: false })
    if (error) console.error('Auto contact sync failed:', error.message)
    else console.log(`Auto-synced ${toUpsert.length} contacts`)
  })
}

export async function sendMessage(jid: string, text: string) {
  if (!sock || connectionStatus !== 'open') {
    throw new Error('WhatsApp not connected')
  }
  return sock.sendMessage(jid, { text })
}

export async function logout() {
  if (sock) {
    try { await sock.logout() } catch { /* ignore */ }
  }
  // Clear auth state so next initWhatsApp() shows a fresh QR
  await supabase
    .from('settings')
    .update({ value: '{}' })
    .eq('key', 'baileys_auth_state')
  sock = null
  connectionStatus = 'connecting'
  qrCode = null
  // Re-initialize — will now generate a new QR
  setTimeout(initWhatsApp, 1000)
}
