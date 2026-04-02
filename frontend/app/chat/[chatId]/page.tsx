'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import type { Chat, Message } from '@/lib/types'
import { ArrowLeft, Send, Bot } from 'lucide-react'

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDateDivider(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const diff = Math.floor((today.getTime() - d.getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })
}

export default function ChatThreadPage() {
  const { chatId: rawChatId } = useParams<{ chatId: string }>()
  const chatId = decodeURIComponent(rawChatId)
  const router = useRouter()
  const [chat, setChat] = useState<Chat | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    // Load chat info and messages
    Promise.all([
      api.chats.list() as Promise<Chat[]>,
      api.chats.messages(chatId) as Promise<Message[]>,
    ]).then(([chats, msgs]) => {
      const found = chats.find((c) => c.id === chatId) ?? null
      setChat(found)
      setMessages(msgs)
      setTimeout(scrollToBottom, 50)
    })

    // Clear unread count
    api.chats.update(chatId, { unread_count: 0 })

    // Realtime subscription for new messages
    const channel = supabase
      .channel('messages:' + chatId)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          setMessages((prev) => {
            // Avoid duplicates (we optimistically add outbound messages)
            const msg = payload.new as Message
            if (prev.some((m) => m.id === msg.id)) return prev
            return [...prev, msg]
          })
          setTimeout(scrollToBottom, 50)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [chatId, scrollToBottom])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || sending) return
    const text = input.trim()
    setInput('')
    setSending(true)

    // Optimistic message
    const optimistic: Message = {
      id: `optimistic-${Date.now()}`,
      chat_id: chatId,
      wa_message_id: null,
      body: text,
      direction: 'outbound',
      status: 'sent',
      timestamp: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimistic])
    setTimeout(scrollToBottom, 50)

    try {
      await api.send(chatId, text)
    } catch (err) {
      // Mark optimistic message as failed
      setMessages((prev) =>
        prev.map((m) =>
          m.id === optimistic.id ? { ...m, status: 'failed' } : m
        )
      )
    } finally {
      setSending(false)
    }
  }

  async function toggleAutoReply() {
    if (!chat) return
    const updated = { ...chat, auto_reply_enabled: !chat.auto_reply_enabled }
    setChat(updated)
    await api.chats.update(chatId, { auto_reply_enabled: updated.auto_reply_enabled })
  }

  // Group messages by date
  const groupedMessages: { date: string; msgs: Message[] }[] = []
  for (const msg of messages) {
    const date = new Date(msg.timestamp).toDateString()
    const last = groupedMessages[groupedMessages.length - 1]
    if (last?.date === date) {
      last.msgs.push(msg)
    } else {
      groupedMessages.push({ date, msgs: [msg] })
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="glass border-b border-white/[0.06] px-4 py-3 flex items-center gap-3 shrink-0">
        <button
          onClick={() => router.back()}
          className="text-slate-400 hover:text-white transition-colors p-1"
        >
          <ArrowLeft size={20} />
        </button>

        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-coral/30 to-teal/30 flex items-center justify-center text-white font-display font-semibold text-sm shrink-0">
          {(chat?.name ?? chat?.phone ?? '?')[0]?.toUpperCase() ?? '?'}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">
            {chat?.name ?? chat?.phone ?? chatId}
          </p>
          {chat?.phone && chat.name && (
            <p className="text-xs text-slate-500">{chat.phone}</p>
          )}
        </div>

        <button
          onClick={toggleAutoReply}
          title={chat?.auto_reply_enabled ? 'Auto-reply on — tap to disable' : 'Auto-reply off — tap to enable'}
          className={`p-2 rounded-full transition-colors ${
            chat?.auto_reply_enabled
              ? 'bg-teal/20 text-teal'
              : 'bg-white/5 text-slate-500'
          }`}
        >
          <Bot size={16} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {groupedMessages.map(({ date, msgs }) => (
          <div key={date} className="space-y-2">
            {/* Date divider */}
            <div className="flex items-center gap-3 my-3">
              <div className="flex-1 h-px bg-white/5" />
              <span className="text-[11px] text-slate-600 font-medium">
                {formatDateDivider(msgs[0].timestamp)}
              </span>
              <div className="flex-1 h-px bg-white/5" />
            </div>

            {msgs.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[75%] px-4 py-2.5 rounded-[1.25rem] text-sm leading-relaxed ${
                    msg.direction === 'outbound'
                      ? 'bg-gradient-to-br from-coral/80 to-teal/80 text-white rounded-br-sm'
                      : 'glass text-slate-100 rounded-bl-sm'
                  } ${msg.status === 'failed' ? 'opacity-50' : ''}`}
                >
                  <p className="break-words whitespace-pre-wrap">{msg.body}</p>
                  <p className={`text-[10px] mt-1 ${msg.direction === 'outbound' ? 'text-white/60 text-right' : 'text-slate-500'}`}>
                    {formatTime(msg.timestamp)}
                    {msg.status === 'failed' && ' · failed'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSend}
        className="px-4 py-3 glass border-t border-white/[0.06] flex items-end gap-2 shrink-0"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend(e as unknown as React.FormEvent)
            }
          }}
          placeholder="Type a message…"
          rows={1}
          className="input resize-none flex-1 max-h-32 overflow-y-auto"
          style={{ lineHeight: '1.5' }}
        />
        <button
          type="submit"
          disabled={!input.trim() || sending}
          className="btn-primary p-2.5 rounded-full aspect-square flex items-center justify-center shrink-0"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  )
}
