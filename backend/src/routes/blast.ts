import { Router } from 'express'
import { supabase } from '../services/supabase'
import { enqueueCampaign, pauseCampaign } from '../services/blastQueue'

const router = Router()

// GET /api/blast — list campaigns
router.get('/', async (_req, res) => {
  const { data, error } = await supabase
    .from('blast_campaigns')
    .select('*, message_templates(name)')
    .order('created_at', { ascending: false })

  if (error) { res.status(500).json({ error: error.message }); return }
  res.json(data)
})

// POST /api/blast — create campaign + add recipients
router.post('/', async (req, res) => {
  const { name, template_id, custom_message, contact_ids } = req.body

  if (!name) { res.status(400).json({ error: 'name required' }); return }
  if (!template_id && !custom_message) {
    res.status(400).json({ error: 'template_id or custom_message required' })
    return
  }
  if (!contact_ids?.length) { res.status(400).json({ error: 'contact_ids required' }); return }

  const { data: campaigns, error: campErr } = await supabase
    .from('blast_campaigns')
    .insert({
      name,
      template_id: template_id ?? null,
      custom_message: custom_message ?? null,
      total_recipients: contact_ids.length,
    })
    .select()

  if (campErr) { res.status(500).json({ error: campErr.message }); return }
  const campaign = campaigns?.[0]
  if (!campaign) { res.status(500).json({ error: 'Failed to create campaign' }); return }

  const recipients = contact_ids.map((cid: string) => ({
    campaign_id: campaign.id,
    contact_id: cid,
  }))

  const { error: recErr } = await supabase.from('blast_recipients').insert(recipients)
  if (recErr) { res.status(500).json({ error: recErr.message }); return }

  res.status(201).json(campaign)
})

// POST /api/blast/:id/start
router.post('/:id/start', async (req, res) => {
  try {
    await enqueueCampaign(req.params.id)
    res.json({ ok: true })
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    res.status(500).json({ error })
  }
})

// POST /api/blast/:id/pause
router.post('/:id/pause', async (req, res) => {
  try {
    const removed = await pauseCampaign(req.params.id)
    res.json({ ok: true, removed })
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    res.status(500).json({ error })
  }
})

// GET /api/blast/:id/recipients
router.get('/:id/recipients', async (req, res) => {
  const { data, error } = await supabase
    .from('blast_recipients')
    .select('*, contacts(name, phone)')
    .eq('campaign_id', req.params.id)
    .order('status')

  if (error) { res.status(500).json({ error: error.message }); return }
  res.json(data)
})

export default router
