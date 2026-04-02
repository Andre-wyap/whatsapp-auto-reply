import { Router } from 'express'
import { supabase } from '../services/supabase'

const router = Router()

router.get('/', async (_req, res) => {
  const { data, error } = await supabase
    .from('message_templates')
    .select('*')
    .order('name')

  if (error) { res.status(500).json({ error: error.message }); return }
  res.json(data)
})

router.post('/', async (req, res) => {
  const { name, body } = req.body
  if (!name || !body) { res.status(400).json({ error: 'name and body required' }); return }

  const { data, error } = await supabase
    .from('message_templates')
    .insert({ name, body })
    .select()
    .single()

  if (error) { res.status(500).json({ error: error.message }); return }
  res.status(201).json(data)
})

router.put('/:id', async (req, res) => {
  const { name, body } = req.body
  const { data, error } = await supabase
    .from('message_templates')
    .update({ name, body })
    .eq('id', req.params.id)
    .select()
    .single()

  if (error) { res.status(500).json({ error: error.message }); return }
  res.json(data)
})

router.delete('/:id', async (req, res) => {
  const { error } = await supabase
    .from('message_templates')
    .delete()
    .eq('id', req.params.id)

  if (error) { res.status(500).json({ error: error.message }); return }
  res.status(204).send()
})

export default router
