import { Router } from 'express'
import { supabase } from '../services/supabase'
import { sock, connectionStatus } from '../whatsapp/connection'

const router = Router()

// GET / — list all contacts (no group/status info here; use /contact-groups/:id/contacts for that)
router.get('/', async (_req, res) => {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .order('name')

  if (error) { res.status(500).json({ error: error.message }); return }
  res.json(data)
})

// POST / — upsert contact by phone, optionally link to a group with a status
// Called by n8n during sheet sync: { name, phone, remark?, groupId?, status? }
router.post('/', async (req, res) => {
  const { name, phone, remark, groupId, status } = req.body
  if (!name || !phone) { res.status(400).json({ error: 'name and phone required' }); return }

  const { data: contact, error } = await supabase
    .from('contacts')
    .upsert({ name, phone, remark: remark ?? null }, { onConflict: 'phone' })
    .select()
    .single()

  if (error) { res.status(500).json({ error: error.message }); return }

  if (groupId) {
    const { error: memberError } = await supabase
      .from('contact_group_members')
      .upsert(
        { contact_id: contact.id, group_id: groupId, status: status ?? null },
        { onConflict: 'contact_id,group_id' }
      )
    if (memberError) { res.status(500).json({ error: memberError.message }); return }
  }

  res.status(201).json(contact)
})

// PUT /:id — update contact details (name, phone, remark only)
router.put('/:id', async (req, res) => {
  const { name, phone, remark } = req.body
  const { data, error } = await supabase
    .from('contacts')
    .update({ name, phone, remark })
    .eq('id', req.params.id)
    .select()
    .single()

  if (error) { res.status(500).json({ error: error.message }); return }
  res.json(data)
})

// PATCH /:id/membership — update a contact's status within a specific group
router.patch('/:id/membership', async (req, res) => {
  const { groupId, status } = req.body
  if (!groupId) { res.status(400).json({ error: 'groupId required' }); return }

  const { data, error } = await supabase
    .from('contact_group_members')
    .update({ status })
    .eq('contact_id', req.params.id)
    .eq('group_id', groupId)
    .select()
    .single()

  if (error) { res.status(500).json({ error: error.message }); return }
  res.json(data)
})

// DELETE /:id — delete contact entirely (cascades all group memberships)
router.delete('/:id', async (req, res) => {
  const { error } = await supabase
    .from('contacts')
    .delete()
    .eq('id', req.params.id)

  if (error) { res.status(500).json({ error: error.message }); return }
  res.status(204).send()
})

// POST /sync — pull contacts from WhatsApp (no group assignment)
router.post('/sync', async (_req, res) => {
  if (!sock || connectionStatus !== 'open') {
    res.status(503).json({ error: 'WhatsApp not connected' })
    return
  }

  const toUpsert: { name: string; phone: string }[] = []
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
    toUpsert.push({ phone, name })
  }

  // Source 2: chats table — anyone who has messaged you
  const { data: chats } = await supabase
    .from('chats')
    .select('phone, name')
    .not('phone', 'is', null)

  for (const chat of chats ?? []) {
    if (!chat.phone || seen.has(chat.phone)) continue
    seen.add(chat.phone)
    toUpsert.push({ phone: chat.phone, name: chat.name ?? chat.phone })
  }

  if (toUpsert.length === 0) { res.json({ synced: 0 }); return }

  const { error } = await supabase
    .from('contacts')
    .upsert(toUpsert, { onConflict: 'phone', ignoreDuplicates: true })

  if (error) { res.status(500).json({ error: error.message }); return }
  res.json({ synced: toUpsert.length })
})

export default router
