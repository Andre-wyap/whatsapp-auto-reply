import axios from 'axios'
import { supabase } from './supabase'

interface N8nPayload {
  jid: string
  phone: string
  body: string
  timestamp: string
}

const CHAT_HISTORY_LIMIT = parseInt(process.env.CHAT_HISTORY_LIMIT || '20', 10)

export async function forwardToN8n({ jid, phone, body, timestamp }: N8nPayload) {
  const webhookUrl = process.env.N8N_WEBHOOK_URL
  if (!webhookUrl) {
    console.warn('N8N_WEBHOOK_URL not set — skipping n8n forward')
    return
  }

  const { data: messages } = await supabase
    .from('messages')
    .select('direction, body, timestamp')
    .eq('chat_id', jid)
    .order('timestamp', { ascending: false })
    .limit(CHAT_HISTORY_LIMIT)

  const history = (messages ?? []).reverse()

  await axios.post(
    webhookUrl,
    {
      chatId: jid,
      from: phone,
      message: body,
      timestamp,
      history,
    },
    {
      headers: { Authorization: `Bearer ${process.env.API_KEY}` },
      timeout: 30000,
    }
  )
}
