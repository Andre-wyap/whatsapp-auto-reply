import { Router } from 'express'
import { sendMessage } from '../whatsapp/connection'
import { supabase } from '../services/supabase'

const router = Router()

router.post('/', async (req, res) => {
  const { chatId, message } = req.body

  if (!chatId || !message) {
    res.status(400).json({ error: 'chatId and message are required' })
    return
  }

  try {
    await sendMessage(chatId, message)

    const timestamp = new Date().toISOString()

    // Ensure chat row exists
    await supabase.from('chats').upsert(
      { id: chatId, last_message: message, last_message_at: timestamp },
      { onConflict: 'id' }
    )

    await supabase.from('messages').insert({
      chat_id: chatId,
      body: message,
      direction: 'outbound',
      status: 'sent',
      timestamp,
    })

    res.json({ ok: true })
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    res.status(500).json({ error })
  }
})

export default router
