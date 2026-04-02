'use client'

import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import type { Contact, ContactGroup } from '@/lib/types'
import {
  Users, Plus, Pencil, Trash2, X, Check, RefreshCw,
  FolderOpen, ChevronRight, UserMinus, Link,
} from 'lucide-react'

// ─── helpers ────────────────────────────────────────────────
function memberCount(g: ContactGroup) {
  return g.contact_group_members?.[0]?.count ?? 0
}

function initials(name: string) {
  return name.trim()[0]?.toUpperCase() ?? '?'
}

// ─── types ──────────────────────────────────────────────────
type ContactForm = { name: string; phone: string; remark: string }
type GroupForm   = { name: string; sheet_url: string; description: string }

const emptyContact: ContactForm = { name: '', phone: '', remark: '' }
const emptyGroup: GroupForm     = { name: '', sheet_url: '', description: '' }

// ─── page ───────────────────────────────────────────────────
export default function ContactsPage() {
  const [groups, setGroups]               = useState<ContactGroup[]>([])
  const [selectedId, setSelectedId]       = useState<string | null>(null) // null = All
  const [contacts, setContacts]           = useState<Contact[]>([])
  const [loadingGroups, setLoadingGroups] = useState(true)
  const [loadingContacts, setLoadingContacts] = useState(false)
  const [search, setSearch]               = useState('')
  const [syncing, setSyncing]             = useState<string | null>(null)
  const [groupStatuses, setGroupStatuses] = useState<string[]>([])

  // Contact modal
  const [contactModal, setContactModal]   = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const [contactForm, setContactForm]     = useState<ContactForm>(emptyContact)
  const [savingContact, setSavingContact] = useState(false)

  // Group modal
  const [groupModal, setGroupModal]       = useState(false)
  const [editingGroup, setEditingGroup]   = useState<ContactGroup | null>(null)
  const [groupForm, setGroupForm]         = useState<GroupForm>(emptyGroup)
  const [savingGroup, setSavingGroup]     = useState(false)

  // ── load groups on mount ──
  useEffect(() => {
    api.contactGroups.list().then((d) => {
      setGroups(d as ContactGroup[])
      setLoadingGroups(false)
    })
  }, [])

  // ── load contacts when selection changes ──
  const loadContacts = useCallback(async (groupId: string | null) => {
    setLoadingContacts(true)
    setSearch('')
    try {
      if (groupId) {
        const [c, s] = await Promise.all([
          api.contactGroups.contacts(groupId) as Promise<Contact[]>,
          api.contactGroups.statuses(groupId),
        ])
        setContacts(c)
        setGroupStatuses(s)
      } else {
        const c = await api.contacts.list() as Contact[]
        setContacts(c)
        setGroupStatuses([])
      }
    } finally {
      setLoadingContacts(false)
    }
  }, [])

  useEffect(() => { loadContacts(selectedId) }, [selectedId, loadContacts])

  // ── sync a group's sheet ──
  async function handleSync(groupId: string) {
    setSyncing(groupId)
    try {
      await api.contactGroups.sync(groupId)
      await loadContacts(selectedId)
      // Refresh group counts
      const fresh = await api.contactGroups.list() as ContactGroup[]
      setGroups(fresh)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Sync failed')
    } finally {
      setSyncing(null)
    }
  }

  // ── contact modal ──
  function openNewContact() {
    setEditingContact(null)
    setContactForm(emptyContact)
    setContactModal(true)
  }

  function openEditContact(c: Contact) {
    setEditingContact(c)
    setContactForm({ name: c.name, phone: c.phone, remark: c.remark ?? '' })
    setContactModal(true)
  }

  async function handleSaveContact(e: React.FormEvent) {
    e.preventDefault()
    setSavingContact(true)
    const payload = {
      name: contactForm.name.trim(),
      phone: contactForm.phone.trim(),
      remark: contactForm.remark.trim() || null,
      groupId: selectedId ?? undefined,
    }
    try {
      if (editingContact) {
        await api.contacts.update(editingContact.id, payload)
      } else {
        await api.contacts.create(payload)
      }
      await loadContacts(selectedId)
      setContactModal(false)
    } finally {
      setSavingContact(false)
    }
  }

  async function handleDeleteContact(id: string) {
    if (!confirm('Delete this contact entirely?')) return
    await api.contacts.delete(id)
    setContacts((prev) => prev.filter((c) => c.id !== id))
  }

  async function handleRemoveFromGroup(contactId: string) {
    if (!selectedId) return
    if (!confirm('Remove this contact from the group?')) return
    await api.contactGroups.removeMember(selectedId, contactId)
    setContacts((prev) => prev.filter((c) => c.id !== contactId))
    // Refresh group count
    const fresh = await api.contactGroups.list() as ContactGroup[]
    setGroups(fresh)
  }

  async function handleStatusChange(contactId: string, status: string) {
    if (!selectedId) return
    await api.contacts.updateMembership(contactId, { groupId: selectedId, status: status || null })
    setContacts((prev) =>
      prev.map((c) => c.id === contactId ? { ...c, status } : c)
    )
  }

  // ── group modal ──
  function openNewGroup() {
    setEditingGroup(null)
    setGroupForm(emptyGroup)
    setGroupModal(true)
  }

  function openEditGroup(g: ContactGroup, e: React.MouseEvent) {
    e.stopPropagation()
    setEditingGroup(g)
    setGroupForm({ name: g.name, sheet_url: g.sheet_url ?? '', description: g.description ?? '' })
    setGroupModal(true)
  }

  async function handleSaveGroup(e: React.FormEvent) {
    e.preventDefault()
    setSavingGroup(true)
    const payload = {
      name: groupForm.name.trim(),
      sheet_url: groupForm.sheet_url.trim() || null,
      description: groupForm.description.trim() || null,
    }
    try {
      if (editingGroup) {
        const updated = await api.contactGroups.update(editingGroup.id, payload) as ContactGroup
        setGroups((prev) => prev.map((g) => g.id === editingGroup.id ? { ...g, ...updated } : g))
      } else {
        const created = await api.contactGroups.create(payload) as ContactGroup
        setGroups((prev) => [...prev, created])
      }
      setGroupModal(false)
    } finally {
      setSavingGroup(false)
    }
  }

  async function handleDeleteGroup(g: ContactGroup, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm(`Delete group "${g.name}" and all its memberships?`)) return
    await api.contactGroups.delete(g.id)
    setGroups((prev) => prev.filter((x) => x.id !== g.id))
    if (selectedId === g.id) setSelectedId(null)
  }

  // ── filtered contacts ──
  const filtered = contacts.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search)
  )

  const selectedGroup = groups.find((g) => g.id === selectedId) ?? null

  // ──────────────────────────────────────────────────────────
  return (
    <div className="h-full flex overflow-hidden">

      {/* ── LEFT: Groups sidebar ── */}
      <div className="w-56 shrink-0 flex flex-col border-r border-white/6 bg-black/20">
        <div className="px-4 pt-5 pb-3 shrink-0">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Groups</p>
        </div>

        <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
          {/* All contacts */}
          <button
            onClick={() => setSelectedId(null)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors ${
              selectedId === null
                ? 'bg-teal/15 text-teal'
                : 'text-slate-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <Users size={14} />
            <span className="flex-1 text-left truncate">All Contacts</span>
            <span className="text-[10px] text-slate-600">{contacts.length || ''}</span>
          </button>

          {/* Group rows */}
          {loadingGroups ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-9 mx-1 rounded-xl bg-white/5 animate-pulse" />
            ))
          ) : (
            groups.map((g) => (
              <div
                key={g.id}
                onClick={() => setSelectedId(g.id)}
                className={`group w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors cursor-pointer ${
                  selectedId === g.id
                    ? 'bg-teal/15 text-teal'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <FolderOpen size={14} className="shrink-0" />
                <span className="flex-1 text-left truncate">{g.name}</span>
                <span className="text-[10px] text-slate-600">{memberCount(g) || ''}</span>

                {/* Edit/delete revealed on hover */}
                <span className="hidden group-hover:flex items-center gap-0.5">
                  <button
                    onClick={(e) => openEditGroup(g, e)}
                    className="p-0.5 hover:text-amber transition-colors"
                  >
                    <Pencil size={11} />
                  </button>
                  <button
                    onClick={(e) => handleDeleteGroup(g, e)}
                    className="p-0.5 hover:text-coral transition-colors"
                  >
                    <Trash2 size={11} />
                  </button>
                </span>
              </div>
            ))
          )}
        </div>

        {/* New group button */}
        <div className="px-3 py-3 shrink-0 border-t border-white/6">
          <button
            onClick={openNewGroup}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-slate-500 hover:text-white hover:bg-white/5 transition-colors"
          >
            <Plus size={14} />
            New Group
          </button>
        </div>
      </div>

      {/* ── RIGHT: Contacts panel ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="px-5 pt-6 pb-3 shrink-0 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {selectedGroup ? (
              <>
                <FolderOpen size={16} className="text-teal shrink-0" />
                <h1 className="font-display text-xl font-bold text-white truncate">{selectedGroup.name}</h1>
                {selectedGroup.sheet_url && (
                  <a
                    href={selectedGroup.sheet_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-600 hover:text-teal transition-colors shrink-0"
                    title="Open sheet"
                  >
                    <Link size={13} />
                  </a>
                )}
              </>
            ) : (
              <>
                <Users size={16} className="text-teal shrink-0" />
                <h1 className="font-display text-xl font-bold text-white">All Contacts</h1>
              </>
            )}
            <ChevronRight size={14} className="text-slate-700 shrink-0" />
            <span className="text-slate-500 text-sm shrink-0">{filtered.length}</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {selectedGroup && (
              <button
                onClick={() => handleSync(selectedGroup.id)}
                disabled={syncing === selectedGroup.id}
                className="btn-ghost flex items-center gap-1.5 text-sm"
              >
                <RefreshCw size={13} className={syncing === selectedGroup.id ? 'animate-spin' : ''} />
                {syncing === selectedGroup.id ? 'Syncing…' : 'Sync Sheet'}
              </button>
            )}
            <button onClick={openNewContact} className="btn-primary flex items-center gap-1.5 text-sm">
              <Plus size={14} />
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

        {/* Contact list */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1">
          {loadingContacts ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 animate-pulse">
                <div className="w-10 h-10 rounded-full bg-white/5 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-white/5 rounded w-1/3" />
                  <div className="h-2.5 bg-white/5 rounded w-1/2" />
                </div>
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3">
              <Users size={40} className="text-slate-700" />
              <p className="text-slate-500 text-sm">
                {selectedGroup ? 'No contacts in this group yet' : 'No contacts found'}
              </p>
            </div>
          ) : (
            filtered.map((c) => (
              <div key={c.id} className="flex items-center gap-3 p-3 rounded-2xl glass-high">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal/30 to-coral/20 flex items-center justify-center text-white font-display font-semibold text-sm shrink-0">
                  {initials(c.name)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-white">{c.name}</p>
                    {/* Per-group status — only shown in group view */}
                    {selectedId && (
                      <select
                        value={c.status ?? ''}
                        onChange={(e) => handleStatusChange(c.id, e.target.value)}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-teal/10 text-teal border border-teal/20 cursor-pointer focus:outline-none focus:ring-1 focus:ring-teal/40"
                      >
                        <option value="">— no status —</option>
                        {groupStatuses.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                        {/* Allow typing a value not yet in the list */}
                        {c.status && !groupStatuses.includes(c.status) && (
                          <option value={c.status}>{c.status}</option>
                        )}
                      </select>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">{c.phone}</p>
                  {c.remark && (
                    <p className="text-[11px] text-slate-600 mt-0.5 truncate">{c.remark}</p>
                  )}
                </div>

                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => openEditContact(c)}
                    className="p-2 text-slate-500 hover:text-amber transition-colors rounded-xl hover:bg-amber/10"
                    title="Edit contact"
                  >
                    <Pencil size={14} />
                  </button>
                  {selectedId ? (
                    <button
                      onClick={() => handleRemoveFromGroup(c.id)}
                      className="p-2 text-slate-500 hover:text-coral transition-colors rounded-xl hover:bg-coral/10"
                      title="Remove from group"
                    >
                      <UserMinus size={14} />
                    </button>
                  ) : (
                    <button
                      onClick={() => handleDeleteContact(c.id)}
                      className="p-2 text-slate-500 hover:text-coral transition-colors rounded-xl hover:bg-coral/10"
                      title="Delete contact"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Contact modal ── */}
      {contactModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4">
          <div className="glass-high rounded-card w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-lg font-semibold text-white">
                {editingContact ? 'Edit Contact' : 'New Contact'}
              </h2>
              <button onClick={() => setContactModal(false)} className="text-slate-500 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveContact} className="space-y-4">
              <div>
                <label className="label">Name</label>
                <input className="input" required value={contactForm.name}
                  onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                  placeholder="John Doe" />
              </div>
              <div>
                <label className="label">Phone (E.164)</label>
                <input className="input" required value={contactForm.phone}
                  onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                  placeholder="+6512345678" />
              </div>
              <div>
                <label className="label">Remark</label>
                <input className="input" value={contactForm.remark}
                  onChange={(e) => setContactForm({ ...contactForm, remark: e.target.value })}
                  placeholder="Optional note" />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setContactModal(false)} className="btn-ghost flex-1">Cancel</button>
                <button type="submit" disabled={savingContact} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {savingContact ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check size={14} />}
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Group modal ── */}
      {groupModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4">
          <div className="glass-high rounded-card w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-lg font-semibold text-white">
                {editingGroup ? 'Edit Group' : 'New Group'}
              </h2>
              <button onClick={() => setGroupModal(false)} className="text-slate-500 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveGroup} className="space-y-4">
              <div>
                <label className="label">Group Name</label>
                <input className="input" required value={groupForm.name}
                  onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                  placeholder="Product A Leads" />
              </div>
              <div>
                <label className="label">Google Sheet URL</label>
                <input className="input" value={groupForm.sheet_url}
                  onChange={(e) => setGroupForm({ ...groupForm, sheet_url: e.target.value })}
                  placeholder="https://docs.google.com/spreadsheets/d/…" />
                <p className="text-[11px] text-slate-600 mt-1">
                  Paste your sheet URL — used when you click Sync Sheet
                </p>
              </div>
              <div>
                <label className="label">Description (optional)</label>
                <input className="input" value={groupForm.description}
                  onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
                  placeholder="e.g. Leads from the Jan campaign" />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setGroupModal(false)} className="btn-ghost flex-1">Cancel</button>
                <button type="submit" disabled={savingGroup} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {savingGroup ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check size={14} />}
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
