import { proto } from '@whiskeysockets/baileys'
import { supabase } from '../services/supabase'
import { forwardToN8n } from '../services/n8nBridge'

export async function handleInboundMessage(msg: proto.IWebMessageInfo) {
  // Skip own messages and messages without content
  if (!msg.message || msg.key.fromMe) return

  const jid = msg.key.remoteJid
  if (!jid) return

  // Skip group messages
  if (jid.endsWith('@g.us')) return

  const body =
    msg.message.conversation ||
    msg.message.extendedTextMessage?.text ||
    ''

  if (!body.trim()) return

  const timestamp = new Date(
    (msg.messageTimestamp as number) * 1000
  ).toISOString()

  const phone = '+' + jid.replace(/@.*$/, '')

  // Upsert chat row
  await supabase.from('chats').upsert(
    {
      id: jid,
      phone,
      last_message: body,
      last_message_at: timestamp,
    },
    { onConflict: 'id' }
  )

  // Increment unread count
  const { data: chat } = await supabase
    .from('chats')
    .select('unread_count, auto_reply_enabled')
    .eq('id', jid)
    .single()

  await supabase
    .from('chats')
    .update({ unread_count: (chat?.unread_count ?? 0) + 1 })
    .eq('id', jid)

  // Deduplicate by wa_message_id
  if (msg.key.id) {
    const { data: existing } = await supabase
      .from('messages')
      .select('id')
      .eq('wa_message_id', msg.key.id)
      .single()

    if (existing) return
  }

  // Save message
  await supabase.from('messages').insert({
    chat_id: jid,
    wa_message_id: msg.key.id ?? null,
    body,
    direction: 'inbound',
    timestamp,
  })

  // Check auto-reply
  const { data: globalSetting } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'global_auto_reply')
    .single()

  const globalAutoReply = globalSetting?.value === 'true'
  const chatAutoReply = chat?.auto_reply_enabled ?? true

  if (globalAutoReply && chatAutoReply) {
    try {
      await forwardToN8n({ jid, phone, body, timestamp })
    } catch (err) {
      console.error('n8n forward failed:', err)
    }
  }
}
