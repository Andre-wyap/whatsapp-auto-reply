import { Router } from 'express'
import { supabase } from '../services/supabase'
import { sendMessage } from '../whatsapp/connection'

const router = Router()

// ─── FIELDS ────────────────────────────────────────────────

router.get('/fields', async (_req, res) => {
  const { data, error } = await supabase
    .from('crm_fields')
    .select('*')
    .order('sort_order', { ascending: true })
  if (error) { res.status(500).json({ error: error.message }); return }
  res.json(data)
})

router.post('/fields', async (req, res) => {
  const { name, key, type, options, required, sort_order } = req.body
  if (!name || !key) { res.status(400).json({ error: 'name and key required' }); return }
  const { data, error } = await supabase
    .from('crm_fields')
    .insert({
      name,
      key,
      type: type ?? 'text',
      options: options ?? [],
      required: required ?? false,
      sort_order: sort_order ?? 0,
    })
    .select()
  if (error) { res.status(500).json({ error: error.message }); return }
  res.status(201).json(data?.[0])
})

router.put('/fields/:id', async (req, res) => {
  const { name, type, options, required, sort_order } = req.body
  const { data, error } = await supabase
    .from('crm_fields')
    .update({ name, type, options, required, sort_order })
    .eq('id', req.params.id)
    .select()
  if (error) { res.status(500).json({ error: error.message }); return }
  res.json(data?.[0])
})

router.delete('/fields/:id', async (req, res) => {
  const { error } = await supabase.from('crm_fields').delete().eq('id', req.params.id)
  if (error) { res.status(500).json({ error: error.message }); return }
  res.status(204).send()
})

// ─── CSV EXPORT (must be before /:id routes) ───────────────

router.get('/contacts/export', async (_req, res) => {
  const [{ data: fields }, { data: contacts }] = await Promise.all([
    supabase.from('crm_fields').select('*').order('sort_order'),
    supabase.from('crm_contacts').select('*').order('created_at', { ascending: false }),
  ])

  const baseHeaders = ['id', 'name', 'phone', 'email', 'created_at']
  const customKeys = (fields ?? []).map((f) => f.key)
  const allHeaders = [...baseHeaders, ...customKeys]

  const rows = (contacts ?? []).map((c) => {
    const base = [c.id, c.name ?? '', c.phone ?? '', c.email ?? '', c.created_at ?? '']
    const custom = customKeys.map((key) => {
      const val = (c.custom_data ?? {})[key]
      return val !== undefined && val !== null ? String(val) : ''
    })
    return [...base, ...custom].map((v) => `"${String(v).replace(/"/g, '""')}"`)
  })

  const csv = [allHeaders.join(','), ...rows.map((r) => r.join(','))].join('\n')
  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', 'attachment; filename="crm-contacts.csv"')
  res.send(csv)
})

// ─── CSV IMPORT ─────────────────────────────────────────────

router.post('/contacts/import', async (req, res) => {
  const { csv } = req.body
  if (!csv || typeof csv !== 'string') { res.status(400).json({ error: 'csv string required' }); return }

  const lines = csv.split('\n').map((l: string) => l.trim()).filter(Boolean)
  if (lines.length < 2) { res.status(400).json({ error: 'CSV must have a header row and at least one data row' }); return }

  const headers = parseCSVLine(lines[0])
  const BASE_COLS = ['id', 'name', 'phone', 'email', 'created_at', 'updated_at']

  const toInsert: { name: string; phone: string | null; email: string | null; custom_data: Record<string, string> }[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => { row[h] = values[idx] ?? '' })

    const name = row['name']?.trim()
    if (!name) continue

    const custom_data: Record<string, string> = {}
    for (const [k, v] of Object.entries(row)) {
      if (!BASE_COLS.includes(k) && v !== '') custom_data[k] = v
    }

    toInsert.push({
      name,
      phone: row['phone']?.trim() || null,
      email: row['email']?.trim() || null,
      custom_data,
    })
  }

  if (toInsert.length === 0) { res.status(400).json({ error: 'No valid rows found (name column required)' }); return }

  const { error } = await supabase.from('crm_contacts').insert(toInsert)
  if (error) { res.status(500).json({ error: error.message }); return }
  res.json({ imported: toInsert.length })
})

// ─── CONTACTS CRUD ──────────────────────────────────────────

router.get('/contacts', async (_req, res) => {
  const { data, error } = await supabase
    .from('crm_contacts')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) { res.status(500).json({ error: error.message }); return }
  res.json(data)
})

// POST /api/crm/contacts — also callable from n8n
router.post('/contacts', async (req, res) => {
  const { name, phone, email, custom_data } = req.body
  if (!name) { res.status(400).json({ error: 'name required' }); return }
  const { data, error } = await supabase
    .from('crm_contacts')
    .insert({ name, phone: phone ?? null, email: email ?? null, custom_data: custom_data ?? {} })
    .select()
  if (error) { res.status(500).json({ error: error.message }); return }
  res.status(201).json(data?.[0])
})

router.put('/contacts/:id', async (req, res) => {
  const { name, phone, email, custom_data } = req.body
  const { data, error } = await supabase
    .from('crm_contacts')
    .update({ name, phone: phone ?? null, email: email ?? null, custom_data: custom_data ?? {}, updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select()
  if (error) { res.status(500).json({ error: error.message }); return }
  res.json(data?.[0])
})

router.delete('/contacts/:id', async (req, res) => {
  const { error } = await supabase.from('crm_contacts').delete().eq('id', req.params.id)
  if (error) { res.status(500).json({ error: error.message }); return }
  res.status(204).send()
})

// ─── SEND MESSAGE TO CONTACT (frontend button) ──────────────

router.post('/contacts/:id/send', async (req, res) => {
  const { message, template_id } = req.body

  const { data: contact } = await supabase
    .from('crm_contacts')
    .select('*')
    .eq('id', req.params.id)
    .maybeSingle()

  if (!contact) { res.status(404).json({ error: 'Contact not found' }); return }
  if (!contact.phone) { res.status(400).json({ error: 'Contact has no phone number' }); return }

  let messageText: string | null = message ?? null
  if (!messageText && template_id) {
    const { data: tmpl } = await supabase
      .from('message_templates').select('body').eq('id', template_id).maybeSingle()
    if (tmpl) {
      messageText = tmpl.body
        .replace(/\{\{name\}\}/g, contact.name)
        .replace(/\{\{phone\}\}/g, contact.phone)
    }
  }
  if (!messageText) { res.status(400).json({ error: 'message or template_id required' }); return }

  const { data: existingChat } = await supabase
    .from('chats').select('id').eq('phone', contact.phone).maybeSingle()
  const jid = existingChat?.id ?? (contact.phone.replace('+', '') + '@s.whatsapp.net')

  try {
    await sendMessage(jid, messageText)
    const timestamp = new Date().toISOString()
    await supabase.from('chats').upsert(
      { id: jid, phone: contact.phone, name: contact.name, last_message: messageText, last_message_at: timestamp },
      { onConflict: 'id' }
    )
    await supabase.from('messages').insert({
      chat_id: jid, body: messageText, direction: 'outbound', status: 'sent', timestamp,
    })
    res.json({ sent: true, chat_id: jid })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

// ─── LEAD WEBHOOK (called from n8n) ─────────────────────────
// Creates/updates CRM contact AND sends a WhatsApp message
//
// POST /api/crm/leads
// { "name": "...", "phone": "+60...", "email": "...",
//   "custom_data": { "field_key": "value" },
//   "message": "Hi {{name}}!"   OR   "template_id": "uuid" }

router.post('/leads', async (req, res) => {
  const { name, phone, email, custom_data, message, template_id } = req.body
  if (!name) { res.status(400).json({ error: 'name required' }); return }
  if (!phone) { res.status(400).json({ error: 'phone required' }); return }

  // 1. Upsert CRM contact (update if same phone already exists)
  const { data: upserted, error: contactErr } = await supabase
    .from('crm_contacts')
    .upsert(
      { name, phone, email: email ?? null, custom_data: custom_data ?? {}, updated_at: new Date().toISOString() },
      { onConflict: 'phone' }
    )
    .select()
  if (contactErr) { res.status(500).json({ error: contactErr.message }); return }
  const contact = upserted?.[0]

  // 2. Resolve message text
  let messageText: string | null = message ?? null
  if (!messageText && template_id) {
    const { data: tmpl } = await supabase
      .from('message_templates').select('body').eq('id', template_id).maybeSingle()
    if (tmpl) {
      messageText = tmpl.body
        .replace(/\{\{name\}\}/g, name)
        .replace(/\{\{phone\}\}/g, phone)
    }
  }

  // 3. Send WhatsApp message if provided
  if (!messageText) {
    res.status(201).json({ contact, sent: false })
    return
  }

  const { data: existingChat } = await supabase
    .from('chats').select('id').eq('phone', phone).maybeSingle()
  const jid = existingChat?.id ?? (phone.replace('+', '') + '@s.whatsapp.net')

  try {
    await sendMessage(jid, messageText)
    const timestamp = new Date().toISOString()
    await supabase.from('chats').upsert(
      { id: jid, phone, name, last_message: messageText, last_message_at: timestamp },
      { onConflict: 'id' }
    )
    await supabase.from('messages').insert({
      chat_id: jid, body: messageText, direction: 'outbound', status: 'sent', timestamp,
    })
    res.status(201).json({ contact, sent: true, chat_id: jid })
  } catch (err) {
    // Contact was saved — still 201, but report send failure
    res.status(201).json({ contact, sent: false, error: err instanceof Error ? err.message : String(err) })
  }
})

// ─── CSV PARSER ─────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  result.push(current)
  return result
}

export default router
