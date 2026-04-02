import { Router } from 'express'
import { supabase } from '../services/supabase'
import { sock, connectionStatus } from '../whatsapp/connection'

const router = Router()

router.get('/', async (_req, res) => {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .order('name')

  if (error) { res.status(500).json({ error: error.message }); return }
  res.json(data)
})

router.post('/', async (req, res) => {
  const { name, phone, tags } = req.body
  if (!name || !phone) { res.status(400).json({ error: 'name and phone required' }); return }

  const { data, error } = await supabase
    .from('contacts')
    .insert({ name, phone, tags: tags ?? [] })
    .select()
    .single()

  if (error) { res.status(500).json({ error: error.message }); return }
  res.status(201).json(data)
})

router.put('/:id', async (req, res) => {
  const { name, phone, tags } = req.body
  const { data, error } = await supabase
    .from('contacts')
    .update({ name, phone, tags })
    .eq('id', req.params.id)
    .select()
    .single()

  if (error) { res.status(500).json({ error: error.message }); return }
  res.json(data)
})

router.delete('/:id', async (req, res) => {
  const { error } = await supabase
    .from('contacts')
    .delete()
    .eq('id', req.params.id)

  if (error) { res.status(500).json({ error: error.message }); return }
  res.status(204).send()
})

router.post('/sync', async (_req, res) => {
  if (!sock || connectionStatus !== 'open') {
    res.status(503).json({ error: 'WhatsApp not connected' })
    return
  }

  const toUpsert: { name: string; phone: string; tags: string[] }[] = []
  const seen = new Set<string>()

  // Source 1: sock.contacts (populated on fresh QR scan)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawContacts = ((sock as any).contacts ?? {}) as Record<string, { id: string; name?: string; notify?: string; verifiedName?: string }>
  for (const [jid, contact] of Object.entries(rawContacts)) {
    if (!jid.match(/^\d+@(s\.whatsapp\.net|lid)$/)) continue
    const name = contact.name ?? contact.notify ?? contact.verifiedName
    if (!name) continue
    const phone = '+' + jid.replace(/@.*$/, '')
    if (seen.has(phone)) continue
    seen.add(phone)
    toUpsert.push({ phone, name, tags: [] })
  }

  // Source 2: chats table — anyone who has messaged you
  const { data: chats } = await supabase
    .from('chats')
    .select('phone, name')
    .not('phone', 'is', null)

  for (const chat of chats ?? []) {
    if (!chat.phone || seen.has(chat.phone)) continue
    seen.add(chat.phone)
    toUpsert.push({ phone: chat.phone, name: chat.name ?? chat.phone, tags: [] })
  }

  if (toUpsert.length === 0) {
    res.json({ synced: 0 })
    return
  }

  const { error } = await supabase
    .from('contacts')
    .upsert(toUpsert, { onConflict: 'phone', ignoreDuplicates: true })

  if (error) { res.status(500).json({ error: error.message }); return }
  res.json({ synced: toUpsert.length })
})

export default router
