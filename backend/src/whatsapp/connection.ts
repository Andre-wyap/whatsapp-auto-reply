import makeWASocket, {
  DisconnectReason,
  WASocket,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import fs from 'fs/promises'
import { supabase } from '../services/supabase'
import { handleInboundMessage } from './messageHandler'

export let sock: WASocket | null = null
export let qrCode: string | null = null
export let connectionStatus: 'connecting' | 'open' | 'close' = 'connecting'

// Auth files live in a Railway persistent Volume (mounted at /data).
// Locally falls back to ./auth_info
const AUTH_DIR = process.env.AUTH_DIR ?? './auth_info'

export async function initWhatsApp() {
  await fs.mkdir(AUTH_DIR, { recursive: true })

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR)
  const { version } = await fetchLatestBaileysVersion()

  sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: true,
    logger: require('pino')({ level: 'warn' }),
    getMessage: async (key) => {
      const { data } = await supabase
        .from('messages')
        .select('body')
        .eq('wa_message_id', key.id ?? '')
        .single()
      if (data?.body) return { conversation: data.body }
      return undefined
    },
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
  sock = null
  connectionStatus = 'connecting'
  qrCode = null

  // Wipe auth files so next initWhatsApp() shows a fresh QR
  try {
    await fs.rm(AUTH_DIR, { recursive: true, force: true })
  } catch { /* ignore */ }

  setTimeout(initWhatsApp, 1000)
}
