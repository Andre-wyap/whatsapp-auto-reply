'use client'

import { useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api'
import type { CrmContact, CrmField } from '@/lib/types'
import type { MessageTemplate } from '@/lib/types'
import { Plus, Upload, Download, X, Trash2, Edit2, Check, Database, Settings2, MessageCircle } from 'lucide-react'

const FIELD_TYPES = ['text', 'number', 'date', 'select', 'boolean'] as const
type FieldType = typeof FIELD_TYPES[number]

function toKey(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}

function FieldTypeBadge({ type }: { type: FieldType }) {
  const styles: Record<FieldType, string> = {
    text: 'bg-blue-500/15 text-blue-400',
    number: 'bg-purple-500/15 text-purple-400',
    date: 'bg-amber/15 text-amber',
    select: 'bg-teal/15 text-teal',
    boolean: 'bg-coral/15 text-coral',
  }
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${styles[type]}`}>
      {type}
    </span>
  )
}

// ─── FIELD MODAL ─────────────────────────────────────────────

function FieldModal({
  field,
  sortOrder,
  onSave,
  onClose,
}: {
  field: CrmField | null
  sortOrder: number
  onSave: (f: CrmField) => void
  onClose: () => void
}) {
  const [name, setName] = useState(field?.name ?? '')
  const [key, setKey] = useState(field?.key ?? '')
  const [type, setType] = useState<FieldType>(field?.type ?? 'text')
  const [options, setOptions] = useState(field?.options.join(', ') ?? '')
  const [required, setRequired] = useState(field?.required ?? false)
  const [saving, setSaving] = useState(false)
  const keyManuallyEdited = useRef(!!field)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        name,
        key,
        type,
        options: type === 'select' ? options.split(',').map((o) => o.trim()).filter(Boolean) : [],
        required,
        sort_order: field?.sort_order ?? sortOrder,
      }
      let saved: CrmField
      if (field) {
        saved = await api.crm.fields.update(field.id, payload) as CrmField
      } else {
        saved = await api.crm.fields.create(payload) as CrmField
      }
      onSave(saved)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4">
      <div className="glass-high rounded-card w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-lg font-semibold text-white">
            {field ? 'Edit Field' : 'New Field'}
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Field Name</label>
            <input
              className="input"
              required
              value={name}
              placeholder="Company Name"
              onChange={(e) => {
                setName(e.target.value)
                if (!keyManuallyEdited.current) setKey(toKey(e.target.value))
              }}
            />
          </div>
          <div>
            <label className="label">Key <span className="text-slate-600 text-[10px]">(used by n8n)</span></label>
            <input
              className="input font-mono text-sm"
              required
              value={key}
              placeholder="company_name"
              disabled={!!field}
              onChange={(e) => { keyManuallyEdited.current = true; setKey(e.target.value) }}
            />
            {field && <p className="text-[11px] text-slate-600 mt-1">Key cannot be changed after creation</p>}
          </div>
          <div>
            <label className="label">Type</label>
            <select className="input" value={type} onChange={(e) => setType(e.target.value as FieldType)}>
              {FIELD_TYPES.map((t) => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
          </div>
          {type === 'select' && (
            <div>
              <label className="label">Options <span className="text-slate-600 text-[10px]">(comma-separated)</span></label>
              <input
                className="input"
                value={options}
                placeholder="Option A, Option B, Option C"
                onChange={(e) => setOptions(e.target.value)}
              />
            </div>
          )}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={required}
              onChange={(e) => setRequired(e.target.checked)}
              className="accent-teal"
            />
            <span className="text-sm text-slate-300">Required field</span>
          </label>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">Cancel</button>
            <button type="submit" disabled={saving || !name || !key} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check size={14} />}
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── CONTACT MODAL ───────────────────────────────────────────

function ContactModal({
  contact,
  fields,
  onSave,
  onClose,
}: {
  contact: CrmContact | null
  fields: CrmField[]
  onSave: (c: CrmContact) => void
  onClose: () => void
}) {
  const [name, setName] = useState(contact?.name ?? '')
  const [phone, setPhone] = useState(contact?.phone ?? '')
  const [email, setEmail] = useState(contact?.email ?? '')
  const [customData, setCustomData] = useState<Record<string, string>>(() => {
    const data: Record<string, string> = {}
    for (const f of fields) {
      const val = contact?.custom_data?.[f.key]
      data[f.key] = val !== undefined && val !== null ? String(val) : ''
    }
    return data
  })
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const filteredCustom: Record<string, string> = {}
      for (const [k, v] of Object.entries(customData)) {
        if (v !== '') filteredCustom[k] = v
      }
      const payload = { name, phone: phone || null, email: email || null, custom_data: filteredCustom }
      let saved: CrmContact
      if (contact) {
        saved = await api.crm.contacts.update(contact.id, payload) as CrmContact
      } else {
        saved = await api.crm.contacts.create(payload) as CrmContact
      }
      onSave(saved)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4">
      <div className="glass-high rounded-card w-full max-w-md p-6 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-lg font-semibold text-white">
            {contact ? 'Edit Contact' : 'New Contact'}
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Name *</label>
            <input className="input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="John Doe" />
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+60123456789" />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="john@example.com" />
          </div>
          {fields.map((f) => (
            <div key={f.key}>
              <label className="label">
                {f.name} {f.required && <span className="text-coral">*</span>}
              </label>
              {f.type === 'select' ? (
                <select
                  className="input"
                  value={customData[f.key] ?? ''}
                  onChange={(e) => setCustomData((d) => ({ ...d, [f.key]: e.target.value }))}
                  required={f.required}
                >
                  <option value="">— Select —</option>
                  {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : f.type === 'boolean' ? (
                <label className="flex items-center gap-3 cursor-pointer mt-1">
                  <input
                    type="checkbox"
                    checked={customData[f.key] === 'true'}
                    onChange={(e) => setCustomData((d) => ({ ...d, [f.key]: String(e.target.checked) }))}
                    className="accent-teal"
                  />
                  <span className="text-sm text-slate-300">Yes</span>
                </label>
              ) : (
                <input
                  className="input"
                  type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                  value={customData[f.key] ?? ''}
                  required={f.required}
                  onChange={(e) => setCustomData((d) => ({ ...d, [f.key]: e.target.value }))}
                />
              )}
            </div>
          ))}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">Cancel</button>
            <button type="submit" disabled={saving || !name} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check size={14} />}
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── SEND MESSAGE MODAL ──────────────────────────────────────

function SendModal({
  contact,
  templates,
  onClose,
}: {
  contact: CrmContact
  templates: MessageTemplate[]
  onClose: () => void
}) {
  const [mode, setMode] = useState<'template' | 'custom'>(templates.length > 0 ? 'template' : 'custom')
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? '')
  const [customMsg, setCustomMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ sent: boolean; error?: string } | null>(null)

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)
    try {
      const payload = mode === 'template'
        ? { template_id: templateId }
        : { message: customMsg }
      const r = await api.crm.contacts.send(contact.id, payload) as { sent: boolean; error?: string }
      setResult(r)
    } catch (err) {
      setResult({ sent: false, error: err instanceof Error ? err.message : 'Send failed' })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4">
      <div className="glass-high rounded-card w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-white">Send Message</h2>
            <p className="text-sm text-slate-500 mt-0.5">{contact.name} · {contact.phone}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {result ? (
          <div className={`rounded-xl p-4 text-sm text-center ${result.sent ? 'bg-teal/10 text-teal border border-teal/20' : 'bg-coral/10 text-coral border border-coral/20'}`}>
            {result.sent ? '✓ Message sent successfully' : `Failed: ${result.error}`}
            <div className="mt-3">
              <button onClick={onClose} className="btn-ghost text-sm px-4">Close</button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSend} className="space-y-4">
            <div className="flex rounded-xl overflow-hidden border border-white/8">
              <button type="button" onClick={() => setMode('template')}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === 'template' ? 'bg-teal/20 text-teal' : 'text-slate-500'}`}>
                Template
              </button>
              <button type="button" onClick={() => setMode('custom')}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === 'custom' ? 'bg-teal/20 text-teal' : 'text-slate-500'}`}>
                Custom
              </button>
            </div>

            {mode === 'template' ? (
              templates.length === 0 ? (
                <p className="text-xs text-slate-500 py-2">No templates yet — create one in Settings.</p>
              ) : (
                <select className="input" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                  {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              )
            ) : (
              <textarea
                className="input resize-none"
                rows={4}
                required
                value={customMsg}
                onChange={(e) => setCustomMsg(e.target.value)}
                placeholder={`Hi ${contact.name}, …`}
              />
            )}

            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="btn-ghost flex-1">Cancel</button>
              <button
                type="submit"
                disabled={sending || (mode === 'template' && !templateId) || (mode === 'custom' && !customMsg.trim())}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {sending
                  ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <MessageCircle size={14} />}
                Send
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// ─── MAIN PAGE ───────────────────────────────────────────────

export default function CrmPage() {
  const [tab, setTab] = useState<'contacts' | 'fields'>('contacts')
  const [contacts, setContacts] = useState<CrmContact[]>([])
  const [fields, setFields] = useState<CrmField[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const [templates, setTemplates] = useState<MessageTemplate[]>([])
  const [contactModal, setContactModal] = useState<{ open: boolean; contact: CrmContact | null }>({ open: false, contact: null })
  const [fieldModal, setFieldModal] = useState<{ open: boolean; field: CrmField | null }>({ open: false, field: null })
  const [sendModal, setSendModal] = useState<CrmContact | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    Promise.all([
      api.crm.fields.list() as Promise<CrmField[]>,
      api.crm.contacts.list() as Promise<CrmContact[]>,
      api.templates.list() as Promise<MessageTemplate[]>,
    ]).then(([f, c, t]) => {
      setFields(f)
      setContacts(c)
      setTemplates(t)
      setLoading(false)
    })
  }, [])

  const filtered = contacts.filter((c) => {
    const q = search.toLowerCase()
    return (
      c.name.toLowerCase().includes(q) ||
      (c.phone ?? '').includes(q) ||
      (c.email ?? '').toLowerCase().includes(q) ||
      Object.values(c.custom_data ?? {}).some((v) => String(v).toLowerCase().includes(q))
    )
  })

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      const text = await file.text()
      const result = await api.crm.contacts.import(text) as { imported: number }
      const refreshed = await api.crm.contacts.list() as CrmContact[]
      setContacts(refreshed)
      alert(`Imported ${result.imported} contacts`)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  async function handleExport() {
    setExporting(true)
    try {
      const csv = await api.crm.contacts.export()
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'crm-contacts.csv'
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  async function handleDeleteContact(id: string) {
    if (!confirm('Delete this contact?')) return
    await api.crm.contacts.delete(id)
    setContacts((prev) => prev.filter((c) => c.id !== id))
  }

  async function handleDeleteField(id: string) {
    if (!confirm('Delete this field? Existing contact data for this field will remain in the database but won\'t be shown.')) return
    await api.crm.fields.delete(id)
    setFields((prev) => prev.filter((f) => f.id !== id))
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-5 pt-6 pb-3 shrink-0">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-white">CRM</h1>
            <p className="text-slate-500 text-sm mt-1">{contacts.length} contacts · {fields.length} custom fields</p>
          </div>
          {tab === 'contacts' && (
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleImport}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                title="Import CSV"
                className="btn-ghost p-2 text-slate-400"
              >
                {importing ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin block" /> : <Upload size={16} />}
              </button>
              <button
                onClick={handleExport}
                disabled={exporting}
                title="Export CSV"
                className="btn-ghost p-2 text-slate-400"
              >
                {exporting ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin block" /> : <Download size={16} />}
              </button>
              <button
                onClick={() => setContactModal({ open: true, contact: null })}
                className="btn-primary flex items-center gap-1.5 text-sm"
              >
                <Plus size={15} /> New
              </button>
            </div>
          )}
          {tab === 'fields' && (
            <button
              onClick={() => setFieldModal({ open: true, field: null })}
              className="btn-primary flex items-center gap-1.5 text-sm"
            >
              <Plus size={15} /> Add Field
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex rounded-xl overflow-hidden border border-white/8">
          <button
            onClick={() => setTab('contacts')}
            className={`flex-1 py-2 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${tab === 'contacts' ? 'bg-teal/20 text-teal' : 'text-slate-500'}`}
          >
            <Database size={13} /> Contacts
          </button>
          <button
            onClick={() => setTab('fields')}
            className={`flex-1 py-2 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${tab === 'fields' ? 'bg-teal/20 text-teal' : 'text-slate-500'}`}
          >
            <Settings2 size={13} /> Fields
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {tab === 'contacts' && (
          <>
            {/* Search */}
            <input
              className="input mb-3 w-full"
              placeholder="Search contacts…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="glass rounded-card p-4 animate-pulse space-y-2">
                    <div className="h-3 bg-white/5 rounded w-1/3" />
                    <div className="h-2 bg-white/5 rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 gap-3">
                <Database size={36} className="text-slate-700" />
                <p className="text-slate-500 text-sm">{search ? 'No matches' : 'No contacts yet'}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map((c) => (
                  <div key={c.id} className="glass rounded-card p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white">{c.name}</p>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                          {c.phone && <span className="text-xs text-slate-500">{c.phone}</span>}
                          {c.email && <span className="text-xs text-slate-500">{c.email}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                          className="text-[10px] text-slate-500 px-2 py-1 rounded-lg hover:bg-white/5"
                        >
                          {expandedId === c.id ? 'Less' : 'More'}
                        </button>
                        {c.phone && (
                          <button
                            onClick={() => setSendModal(c)}
                            title="Send WhatsApp message"
                            className="p-1.5 text-slate-500 hover:text-teal transition-colors"
                          >
                            <MessageCircle size={13} />
                          </button>
                        )}
                        <button
                          onClick={() => setContactModal({ open: true, contact: c })}
                          className="p-1.5 text-slate-500 hover:text-white transition-colors"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteContact(c.id)}
                          className="p-1.5 text-slate-500 hover:text-coral transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                    {/* Custom fields preview */}
                    {fields.length > 0 && (
                      <div className={`mt-2 flex flex-wrap gap-x-4 gap-y-1 ${expandedId !== c.id ? 'max-h-5 overflow-hidden' : ''}`}>
                        {fields.map((f) => {
                          const val = c.custom_data?.[f.key]
                          if (val === undefined || val === null || val === '') return null
                          return (
                            <span key={f.key} className="text-[11px] text-slate-400">
                              <span className="text-slate-600">{f.name}: </span>
                              {f.type === 'boolean' ? (val === 'true' || val === true ? 'Yes' : 'No') : String(val)}
                            </span>
                          )
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'fields' && (
          <div className="space-y-2 mt-1">
            {fields.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 gap-3">
                <Settings2 size={36} className="text-slate-700" />
                <p className="text-slate-500 text-sm">No custom fields yet</p>
                <p className="text-slate-600 text-xs text-center max-w-xs">
                  Add fields to capture extra info like company, status, or any data you need.
                </p>
              </div>
            ) : (
              fields.map((f) => (
                <div key={f.id} className="glass rounded-card p-4 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white">{f.name}</p>
                      <FieldTypeBadge type={f.type} />
                      {f.required && <span className="text-[10px] text-coral">required</span>}
                    </div>
                    <p className="text-[11px] text-slate-600 font-mono mt-0.5">{f.key}</p>
                    {f.type === 'select' && f.options.length > 0 && (
                      <p className="text-[11px] text-slate-500 mt-0.5">{f.options.join(' · ')}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setFieldModal({ open: true, field: f })}
                      className="p-1.5 text-slate-500 hover:text-white transition-colors"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={() => handleDeleteField(f.id)}
                      className="p-1.5 text-slate-500 hover:text-coral transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))
            )}

            {/* n8n tip */}
            <div className="glass rounded-card p-4 mt-4 border border-teal/10">
              <p className="text-xs text-slate-400 font-medium mb-2">n8n Integration</p>
              <p className="text-[11px] text-slate-500 mb-1">Create a contact from n8n via HTTP Request:</p>
              <pre className="text-[10px] text-teal/80 bg-black/30 rounded-xl p-3 overflow-x-auto whitespace-pre-wrap">{`POST /api/crm/contacts
Authorization: Bearer <API_KEY>

{
  "name": "John Doe",
  "phone": "+60123456789",
  "email": "john@example.com",
  "custom_data": {
${fields.map((f) => `    "${f.key}": "value"`).join(',\n') || '    "your_field": "value"'}
  }
}`}</pre>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {contactModal.open && (
        <ContactModal
          contact={contactModal.contact}
          fields={fields}
          onSave={(saved) => {
            setContacts((prev) =>
              contactModal.contact
                ? prev.map((c) => (c.id === saved.id ? saved : c))
                : [saved, ...prev]
            )
            setContactModal({ open: false, contact: null })
          }}
          onClose={() => setContactModal({ open: false, contact: null })}
        />
      )}
      {fieldModal.open && (
        <FieldModal
          field={fieldModal.field}
          sortOrder={fields.length}
          onSave={(saved) => {
            setFields((prev) =>
              fieldModal.field
                ? prev.map((f) => (f.id === saved.id ? saved : f))
                : [...prev, saved]
            )
            setFieldModal({ open: false, field: null })
          }}
          onClose={() => setFieldModal({ open: false, field: null })}
        />
      )}
      {sendModal && (
        <SendModal
          contact={sendModal}
          templates={templates}
          onClose={() => setSendModal(null)}
        />
      )}
    </div>
  )
}
