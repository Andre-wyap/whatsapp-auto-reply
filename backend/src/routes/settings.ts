import { Router } from 'express'
import { supabase } from '../services/supabase'

const router = Router()

router.get('/', async (_req, res) => {
  const { data, error } = await supabase.from('settings').select('key, value')
  if (error) { res.status(500).json({ error: error.message }); return }

  // Return as flat object
  const result: Record<string, string> = {}
  for (const row of data ?? []) {
    if (row.key !== 'baileys_auth_state') result[row.key] = row.value
  }
  res.json(result)
})

router.put('/', async (req, res) => {
  const allowed = ['global_auto_reply']
  const updates = Object.entries(req.body as Record<string, string>).filter(
    ([k]) => allowed.includes(k)
  )

  if (!updates.length) { res.status(400).json({ error: 'No valid settings provided' }); return }

  const upserts = updates.map(([key, value]) => ({ key, value, updated_at: new Date().toISOString() }))
  const { error } = await supabase.from('settings').upsert(upserts, { onConflict: 'key' })

  if (error) { res.status(500).json({ error: error.message }); return }
  res.json({ ok: true })
})

export default router
