'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import type { Chat } from '@/lib/types'
import { MessageCircle, Bot } from 'lucide-react'

function timeAgo(iso: string | null) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}

export default function ChatListPage() {
  const [chats, setChats] = useState<Chat[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.chats.list().then((data) => {
      setChats(data as Chat[])
      setLoading(false)
    })

    const channel = supabase
      .channel('chats-list')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chats' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setChats((prev) => [payload.new as Chat, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            setChats((prev) =>
              prev
                .map((c) => (c.id === (payload.new as Chat).id ? (payload.new as Chat) : c))
                .sort((a, b) =>
                  new Date(b.last_message_at ?? 0).getTime() -
                  new Date(a.last_message_at ?? 0).getTime()
                )
            )
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-5 pt-6 pb-4 shrink-0">
        <h1 className="font-display text-2xl font-bold text-white">Chats</h1>
        <p className="text-slate-500 text-sm mt-1">{chats.length} conversations</p>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-3 pb-2 space-y-1">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-2xl animate-pulse">
              <div className="w-11 h-11 rounded-full bg-white/5 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-white/5 rounded w-1/3" />
                <div className="h-2.5 bg-white/5 rounded w-2/3" />
              </div>
            </div>
          ))
        ) : chats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3">
            <MessageCircle size={40} className="text-slate-700" />
            <p className="text-slate-500 text-sm">No chats yet</p>
          </div>
        ) : (
          chats.map((chat) => (
            <Link
              key={chat.id}
              href={`/chat/${chat.id}`}
              className="flex items-center gap-3 p-3 rounded-2xl hover:bg-white/5 transition-colors active:bg-white/8"
            >
              {/* Avatar */}
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-coral/30 to-teal/30 flex items-center justify-center shrink-0 text-white font-display font-semibold text-base">
                {(chat.name ?? chat.phone ?? '?')[0].toUpperCase()}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-white truncate">
                    {chat.name ?? chat.phone}
                  </span>
                  <span className="text-[11px] text-slate-500 shrink-0 ml-2">
                    {timeAgo(chat.last_message_at)}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-xs text-slate-500 truncate">
                    {chat.last_message ?? 'No messages'}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    <Bot size={12} className={chat.auto_reply_enabled ? 'text-teal' : 'text-slate-600 opacity-40'} />
                    {chat.unread_count > 0 && (
                      <span className="text-[10px] bg-coral text-white rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 font-medium">
                        {chat.unread_count > 99 ? '99+' : chat.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
