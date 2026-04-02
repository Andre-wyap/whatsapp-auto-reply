'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import type { Contact } from '@/lib/types'
import { Users, Plus, Pencil, Trash2, X, Check, RefreshCw } from 'lucide-react'

type Form = { name: string; phone: string; tags: string }

const emptyForm: Form = { name: '', phone: '', tags: '' }

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Contact | null>(null)
  const [form, setForm] = useState<Form>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    api.contacts.list().then((d) => { setContacts(d as Contact[]); setLoading(false) })
  }, [])

  async function handleSync() {
    setSyncing(true)
    try {
      const result = await api.contacts.sync() as { synced: number }
      const fresh = await api.contacts.list() as Contact[]
      setContacts(fresh)
      alert(`Synced ${result.synced} contacts from WhatsApp`)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  function openNew() {
    setEditing(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  function openEdit(c: Contact) {
    setEditing(c)
    setForm({ name: c.name, phone: c.phone, tags: c.tags.join(', ') })
    setModalOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
    }
    try {
      if (editing) {
        const updated = await api.contacts.update(editing.id, payload) as Contact
        setContacts((prev) => prev.map((c) => (c.id === editing.id ? updated : c)))
      } else {
        const created = await api.contacts.create(payload) as Contact
        setContacts((prev) => [created, ...prev])
      }
      setModalOpen(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this contact?')) return
    await api.contacts.delete(id)
    setContacts((prev) => prev.filter((c) => c.id !== id))
  }

  const filtered = contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search)
  )

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-5 pt-6 pb-4 shrink-0 flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Contacts</h1>
          <p className="text-slate-500 text-sm mt-1">{contacts.length} contacts</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleSync} disabled={syncing} className="btn-ghost flex items-center gap-1.5 text-sm">
            <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing…' : 'Sync'}
          </button>
          <button onClick={openNew} className="btn-primary flex items-center gap-1.5 text-sm">
            <Plus size={15} />
            Add
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-5 pb-3 shrink-0">
        <input
          className="input"
          placeholder="Search name or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 pb-2 space-y-1">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 animate-pulse">
              <div className="w-10 h-10 rounded-full bg-white/5" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-white/5 rounded w-1/3" />
                <div className="h-2.5 bg-white/5 rounded w-1/2" />
              </div>
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3">
            <Users size={40} className="text-slate-700" />
            <p className="text-slate-500 text-sm">No contacts found</p>
          </div>
        ) : (
          filtered.map((c) => (
            <div key={c.id} className="flex items-center gap-3 p-3 rounded-2xl glass-high">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal/30 to-coral/20 flex items-center justify-center text-white font-display font-semibold text-sm shrink-0">
                {c.name[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{c.name}</p>
                <p className="text-xs text-slate-500">{c.phone}</p>
                {c.tags.length > 0 && (
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {c.tags.map((tag) => (
                      <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-teal/15 text-teal border border-teal/20">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => openEdit(c)}
                  className="p-2 text-slate-500 hover:text-amber transition-colors rounded-xl hover:bg-amber/10"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => handleDelete(c.id)}
                  className="p-2 text-slate-500 hover:text-coral transition-colors rounded-xl hover:bg-coral/10"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4">
          <div className="glass-high rounded-card w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-lg font-semibold text-white">
                {editing ? 'Edit Contact' : 'New Contact'}
              </h2>
              <button onClick={() => setModalOpen(false)} className="text-slate-500 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="label">Name</label>
                <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="John Doe" />
              </div>
              <div>
                <label className="label">Phone (E.164)</label>
                <input className="input" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+6512345678" />
              </div>
              <div>
                <label className="label">Tags (comma separated)</label>
                <input className="input" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="vip, singapore" />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setModalOpen(false)} className="btn-ghost flex-1">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check size={14} />}
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
