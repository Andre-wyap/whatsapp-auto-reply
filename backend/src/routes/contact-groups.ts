import { Router } from 'express'
import axios from 'axios'
import { supabase } from '../services/supabase'

const router = Router()

// GET / — list all groups with member count
router.get('/', async (_req, res) => {
  const { data, error } = await supabase
    .from('contact_groups')
    .select('*, contact_group_members(count)')
    .order('name')

  if (error) { res.status(500).json({ error: error.message }); return }
  res.json(data)
})

// POST / — create a group
router.post('/', async (req, res) => {
  const { name, sheet_url, description } = req.body
  if (!name) { res.status(400).json({ error: 'name required' }); return }

  const { data, error } = await supabase
    .from('contact_groups')
    .insert({ name, sheet_url: sheet_url ?? null, description: description ?? null })
    .select()
    .single()

  if (error) { res.status(500).json({ error: error.message }); return }
  res.status(201).json(data)
})

// PUT /:id — update a group
router.put('/:id', async (req, res) => {
  const { name, sheet_url, description } = req.body
  const { data, error } = await supabase
    .from('contact_groups')
    .update({ name, sheet_url, description })
    .eq('id', req.params.id)
    .select()
    .single()

  if (error) { res.status(500).json({ error: error.message }); return }
  res.json(data)
})

// DELETE /:id — delete a group (cascades memberships)
router.delete('/:id', async (req, res) => {
  const { error } = await supabase
    .from('contact_groups')
    .delete()
    .eq('id', req.params.id)

  if (error) { res.status(500).json({ error: error.message }); return }
  res.status(204).send()
})

// GET /:id/contacts — contacts in this group with their per-group status
router.get('/:id/contacts', async (req, res) => {
  const { data, error } = await supabase
    .from('contact_group_members')
    .select('status, added_at, contacts(*)')
    .eq('group_id', req.params.id)
    .order('added_at', { ascending: false })

  if (error) { res.status(500).json({ error: error.message }); return }

  // Flatten: merge contact fields with membership status
  const result = (data ?? []).map((row) => ({
    ...(row.contacts as unknown as Record<string, unknown>),
    status: row.status,
    added_at: row.added_at,
  }))
  res.json(result)
})

// GET /:id/statuses — distinct statuses in this group (for blast filter)
router.get('/:id/statuses', async (req, res) => {
  const { data, error } = await supabase
    .from('contact_group_members')
    .select('status')
    .eq('group_id', req.params.id)
    .not('status', 'is', null)

  if (error) { res.status(500).json({ error: error.message }); return }

  const statuses = [...new Set((data ?? []).map((r) => r.status as string))].sort()
  res.json(statuses)
})

// DELETE /:id/members/:contactId — remove a contact from a group
router.delete('/:id/members/:contactId', async (req, res) => {
  const { error } = await supabase
    .from('contact_group_members')
    .delete()
    .eq('group_id', req.params.id)
    .eq('contact_id', req.params.contactId)

  if (error) { res.status(500).json({ error: error.message }); return }
  res.status(204).send()
})

// POST /:id/sync — trigger n8n with this group's sheet URL
router.post('/:id/sync', async (req, res) => {
  const syncUrl = process.env.N8N_CONTACT_SYNC_URL
  if (!syncUrl) {
    res.status(500).json({ error: 'N8N_CONTACT_SYNC_URL env var not set' })
    return
  }

  const { data: group, error } = await supabase
    .from('contact_groups')
    .select('id, sheet_url')
    .eq('id', req.params.id)
    .single()

  if (error || !group) { res.status(404).json({ error: 'Group not found' }); return }
  if (!group.sheet_url) { res.status(400).json({ error: 'No sheet URL configured for this group' }); return }

  try {
    await axios.post(
      syncUrl,
      { sheetUrl: group.sheet_url, groupId: group.id },
      { headers: { Authorization: `Bearer ${process.env.API_KEY}` }, timeout: 10000 }
    )
    res.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    res.status(502).json({ error: `Failed to trigger n8n: ${message}` })
  }
})

export default router
