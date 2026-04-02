'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import type { Settings, MessageTemplate } from '@/lib/types'
import { Bot, Plus, Pencil, Trash2, X, Check, FileText, RefreshCw } from 'lucide-react'

type TemplateForm = { name: string; body: string }

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [templates, setTemplates] = useState<MessageTemplate[]>([])
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingTpl, setEditingTpl] = useState<MessageTemplate | null>(null)
  const [tplForm, setTplForm] = useState<TemplateForm>({ name: '', body: '' })
  const [tplSaving, setTplSaving] = useState(false)


  useEffect(() => {
    Promise.all([
      api.settings.get() as Promise<Settings>,
      api.templates.list() as Promise<MessageTemplate[]>,
    ]).then(([s, t]) => {
      setSettings(s)
      setTemplates(t)
    })
  }, [])

  async function toggleGlobalAutoReply() {
    if (!settings) return
    const next = settings.global_auto_reply !== 'true' ? 'true' : 'false'
    setSettings({ ...settings, global_auto_reply: next })
    setSaving(true)
    await api.settings.update({ global_auto_reply: next })
    setSaving(false)
  }

  async function handleSyncSheet() {
    setSyncing(true)
    setSyncMsg(null)
    try {
      await api.contacts.sync()
      setSyncMsg('Sync triggered — contacts will update shortly')
    } catch (err: unknown) {
      setSyncMsg(err instanceof Error ? err.message : 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  function openNewTemplate() {
    setEditingTpl(null)
    setTplForm({ name: '', body: '' })
    setModalOpen(true)
  }

  function openEditTemplate(t: MessageTemplate) {
    setEditingTpl(t)
    setTplForm({ name: t.name, body: t.body })
    setModalOpen(true)
  }

  async function handleTemplateSave(e: React.FormEvent) {
    e.preventDefault()
    setTplSaving(true)
    try {
      if (editingTpl) {
        const updated = await api.templates.update(editingTpl.id, tplForm) as MessageTemplate
        setTemplates((prev) => prev.map((t) => (t.id === editingTpl.id ? updated : t)))
      } else {
        const created = await api.templates.create(tplForm) as MessageTemplate
        setTemplates((prev) => [created, ...prev])
      }
      setModalOpen(false)
    } finally {
      setTplSaving(false)
    }
  }

  async function handleTemplateDelete(id: string) {
    if (!confirm('Delete this template?')) return
    await api.templates.delete(id)
    setTemplates((prev) => prev.filter((t) => t.id !== id))
  }

  const globalOn = settings?.global_auto_reply === 'true'

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      <div className="px-5 pt-6 pb-4 shrink-0">
        <h1 className="font-display text-2xl font-bold text-white">Settings</h1>
      </div>

      <div className="px-5 space-y-6 pb-8">
        {/* Auto-reply toggle */}
        <div className="glass rounded-card p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${globalOn ? 'bg-teal/20 text-teal' : 'bg-white/5 text-slate-500'}`}>
                <Bot size={18} />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Global Auto-Reply</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {globalOn ? 'n8n receives all messages' : 'Auto-reply disabled for all chats'}
                </p>
              </div>
            </div>
            <button
              onClick={toggleGlobalAutoReply}
              disabled={saving || !settings}
              className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${globalOn ? 'bg-teal' : 'bg-white/10'}`}
            >
              <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${globalOn ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
          </div>
        </div>

        {/* Google Sheet sync */}
        <div className="glass rounded-card p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 text-slate-400">
                <RefreshCw size={18} />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Sync Contacts</p>
                <p className="text-xs text-slate-500 mt-0.5">Import contacts from your WhatsApp</p>
              </div>
            </div>
            <button
              onClick={handleSyncSheet}
              disabled={syncing}
              className="btn-primary flex items-center gap-2 text-sm"
            >
              {syncing
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <RefreshCw size={13} />}
              {syncing ? 'Syncing…' : 'Sync Now'}
            </button>
          </div>
          {syncMsg && (
            <p className={`text-xs mt-3 ${syncMsg.includes('failed') || syncMsg.includes('Failed') ? 'text-coral' : 'text-emerald-400'}`}>
              {syncMsg}
            </p>
          )}
        </div>

        {/* Message templates */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-base font-semibold text-white">Message Templates</h2>
            <button onClick={openNewTemplate} className="btn-ghost flex items-center gap-1.5 text-sm py-1.5 px-3">
              <Plus size={13} />
              New
            </button>
          </div>

          <div className="space-y-2">
            {templates.length === 0 ? (
              <div className="glass rounded-2xl p-6 flex flex-col items-center gap-2">
                <FileText size={28} className="text-slate-700" />
                <p className="text-slate-500 text-sm">No templates yet</p>
                <p className="text-slate-600 text-xs text-center">
                  Templates support <code className="text-amber/80">{'{{name}}'}</code> and <code className="text-amber/80">{'{{phone}}'}</code> placeholders
                </p>
              </div>
            ) : (
              templates.map((t) => (
                <div key={t.id} className="glass rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">{t.name}</p>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">{t.body}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => openEditTemplate(t)} className="p-2 text-slate-500 hover:text-amber transition-colors rounded-xl hover:bg-amber/10">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => handleTemplateDelete(t.id)} className="p-2 text-slate-500 hover:text-coral transition-colors rounded-xl hover:bg-coral/10">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Placeholder legend */}
        <div className="glass rounded-2xl p-4">
          <p className="text-xs font-medium text-slate-400 mb-2">Blast placeholders</p>
          <div className="space-y-1.5">
            {[['{{name}}', "Contact's name"], ['{{phone}}', "Contact's phone number"]].map(([ph, desc]) => (
              <div key={ph} className="flex items-center gap-3">
                <code className="text-xs text-amber/80 bg-amber/10 px-2 py-0.5 rounded-lg">{ph}</code>
                <span className="text-xs text-slate-500">{desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Template modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4">
          <div className="glass-high rounded-card w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-lg font-semibold text-white">
                {editingTpl ? 'Edit Template' : 'New Template'}
              </h2>
              <button onClick={() => setModalOpen(false)} className="text-slate-500 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleTemplateSave} className="space-y-4">
              <div>
                <label className="label">Template Name</label>
                <input className="input" required value={tplForm.name} onChange={(e) => setTplForm({ ...tplForm, name: e.target.value })} placeholder="Welcome Message" />
              </div>
              <div>
                <label className="label">Body</label>
                <textarea
                  className="input resize-none"
                  rows={5}
                  required
                  value={tplForm.body}
                  onChange={(e) => setTplForm({ ...tplForm, body: e.target.value })}
                  placeholder={'Hi {{name}}, thanks for reaching out! We\'ll get back to you shortly.'}
                />
                <p className="text-[11px] text-slate-600 mt-1.5">
                  Use <code className="text-amber/70">{'{{name}}'}</code> and <code className="text-amber/70">{'{{phone}}'}</code> for personalization
                </p>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setModalOpen(false)} className="btn-ghost flex-1">Cancel</button>
                <button type="submit" disabled={tplSaving} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {tplSaving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check size={14} />}
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
