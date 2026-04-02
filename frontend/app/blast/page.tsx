'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import type { BlastCampaign, Contact, MessageTemplate } from '@/lib/types'
import { Send, Plus, Play, Pause, X, Check, ChevronDown, ChevronUp } from 'lucide-react'

const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-white/5 text-slate-400 border-white/10',
  running: 'bg-teal/15 text-teal border-teal/25',
  paused: 'bg-amber/15 text-amber border-amber/25',
  completed: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  failed: 'bg-coral/15 text-coral border-coral/25',
}

function Progress({ sent, total }: { sent: number; total: number }) {
  const pct = total > 0 ? Math.round((sent / total) * 100) : 0
  return (
    <div className="mt-2">
      <div className="flex justify-between text-[11px] text-slate-500 mb-1">
        <span>{sent} / {total} sent</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1 bg-white/5 rounded-full overflow-hidden">
        <div className="h-full bg-gradient-cta rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function BlastPage() {
  const [campaigns, setCampaigns] = useState<BlastCampaign[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [templates, setTemplates] = useState<MessageTemplate[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [mode, setMode] = useState<'template' | 'custom'>('template')
  const [templateId, setTemplateId] = useState('')
  const [customMsg, setCustomMsg] = useState('')
  const [selectedContacts, setSelectedContacts] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.blast.list().then((d) => { setCampaigns(d as BlastCampaign[]); setLoading(false) })

    const channel = supabase
      .channel('blast-campaigns')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'blast_campaigns' }, (payload) => {
        setCampaigns((prev) => prev.map((c) => c.id === (payload.new as BlastCampaign).id ? payload.new as BlastCampaign : c))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  async function openModal() {
    setModalOpen(true)
    const [c, t] = await Promise.all([
      api.contacts.list() as Promise<Contact[]>,
      api.templates.list() as Promise<MessageTemplate[]>,
    ])
    setContacts(c)
    setTemplates(t)
    if (t.length > 0) setTemplateId(t[0].id)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const campaign = await api.blast.create({
        name,
        template_id: mode === 'template' ? templateId : null,
        custom_message: mode === 'custom' ? customMsg : null,
        contact_ids: selectedContacts,
      }) as BlastCampaign
      setCampaigns((prev) => [campaign, ...prev])
      setModalOpen(false)
      setName(''); setCustomMsg(''); setSelectedContacts([])
    } finally {
      setSaving(false)
    }
  }

  async function handleStart(id: string) {
    await api.blast.start(id)
    setCampaigns((prev) => prev.map((c) => c.id === id ? { ...c, status: 'running' } : c))
  }

  async function handlePause(id: string) {
    await api.blast.pause(id)
    setCampaigns((prev) => prev.map((c) => c.id === id ? { ...c, status: 'paused' } : c))
  }

  function toggleContact(id: string) {
    setSelectedContacts((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-5 pt-6 pb-4 shrink-0 flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Blast</h1>
          <p className="text-slate-500 text-sm mt-1">{campaigns.length} campaigns</p>
        </div>
        <button onClick={openModal} className="btn-primary flex items-center gap-1.5 text-sm">
          <Plus size={15} />
          New
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-2 space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="glass rounded-card p-4 animate-pulse space-y-2">
              <div className="h-3 bg-white/5 rounded w-1/3" />
              <div className="h-2 bg-white/5 rounded w-full" />
            </div>
          ))
        ) : campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3">
            <Send size={40} className="text-slate-700" />
            <p className="text-slate-500 text-sm">No campaigns yet</p>
          </div>
        ) : (
          campaigns.map((c) => (
            <div key={c.id} className="glass rounded-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{c.name}</p>
                  {c.message_templates && (
                    <p className="text-xs text-slate-500 mt-0.5">Template: {c.message_templates.name}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[11px] px-2.5 py-0.5 rounded-full border font-medium capitalize ${STATUS_STYLE[c.status] ?? ''}`}>
                    {c.status}
                  </span>
                  {(c.status === 'draft' || c.status === 'paused') && (
                    <button onClick={() => handleStart(c.id)} className="p-1.5 bg-teal/15 text-teal rounded-full hover:bg-teal/25 transition-colors">
                      <Play size={13} fill="currentColor" />
                    </button>
                  )}
                  {c.status === 'running' && (
                    <button onClick={() => handlePause(c.id)} className="p-1.5 bg-amber/15 text-amber rounded-full hover:bg-amber/25 transition-colors">
                      <Pause size={13} fill="currentColor" />
                    </button>
                  )}
                  <button
                    onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                    className="p-1.5 text-slate-500 hover:text-white transition-colors"
                  >
                    {expandedId === c.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>
              </div>
              <Progress sent={c.sent_count} total={c.total_recipients} />
              {expandedId === c.id && (
                <div className="mt-3 pt-3 border-t border-white/5 text-xs text-slate-500 space-y-1">
                  {c.started_at && <p>Started: {new Date(c.started_at).toLocaleString()}</p>}
                  {c.completed_at && <p>Completed: {new Date(c.completed_at).toLocaleString()}</p>}
                  <p>Created: {new Date(c.created_at).toLocaleString()}</p>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* New campaign modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4">
          <div className="glass-high rounded-card w-full max-w-md p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-lg font-semibold text-white">New Campaign</h2>
              <button onClick={() => setModalOpen(false)} className="text-slate-500 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="label">Campaign Name</label>
                <input className="input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="March Promo" />
              </div>

              {/* Message source toggle */}
              <div>
                <label className="label">Message</label>
                <div className="flex rounded-xl overflow-hidden border border-white/8 mb-3">
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
                    <p className="text-xs text-slate-500">No templates yet — create one in Settings.</p>
                  ) : (
                    <select
                      className="input"
                      value={templateId}
                      onChange={(e) => setTemplateId(e.target.value)}
                      required={mode === 'template'}
                    >
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  )
                ) : (
                  <textarea
                    className="input resize-none"
                    rows={4}
                    required={mode === 'custom'}
                    value={customMsg}
                    onChange={(e) => setCustomMsg(e.target.value)}
                    placeholder="Hello {{name}}, your order is ready!"
                  />
                )}
              </div>

              {/* Contact selection */}
              <div>
                <label className="label">Recipients ({selectedContacts.length} selected)</label>
                <div className="space-y-1 max-h-44 overflow-y-auto">
                  {contacts.length === 0 ? (
                    <p className="text-xs text-slate-500 py-2">No contacts. Add some first.</p>
                  ) : (
                    contacts.map((c) => (
                      <label key={c.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedContacts.includes(c.id)}
                          onChange={() => toggleContact(c.id)}
                          className="accent-teal"
                        />
                        <span className="flex-1 min-w-0">
                          <span className="text-sm text-white">{c.name}</span>
                          <span className="text-xs text-slate-500 ml-2">{c.phone}</span>
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setModalOpen(false)} className="btn-ghost flex-1">Cancel</button>
                <button type="submit" disabled={saving || selectedContacts.length === 0} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check size={14} />}
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
