import { Router } from 'express'
import { supabase } from '../services/supabase'

const router = Router()

// GET /api/chats
router.get('/', async (_req, res) => {
  const { data, error } = await supabase
    .from('chats')
    .select('*')
    .order('last_message_at', { ascending: false })

  if (error) { res.status(500).json({ error: error.message }); return }
  res.json(data)
})

// GET /api/chats/:id/messages
router.get('/:id/messages', async (req, res) => {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('chat_id', req.params.id)
    .order('timestamp', { ascending: true })

  if (error) { res.status(500).json({ error: error.message }); return }
  res.json(data)
})

// PATCH /api/chats/:id — update auto_reply_enabled or clear unread
router.patch('/:id', async (req, res) => {
  const allowed = ['auto_reply_enabled', 'unread_count', 'name']
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (req.body[key] !== undefined) update[key] = req.body[key]
  }

  const { data, error } = await supabase
    .from('chats')
    .update(update)
    .eq('id', req.params.id)
    .select()
    .single()

  if (error) { res.status(500).json({ error: error.message }); return }
  res.json(data)
})

export default router
