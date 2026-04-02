'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MessageCircle, Users, Send, Settings, QrCode, Database } from 'lucide-react'

const tabs = [
  { href: '/chat', icon: MessageCircle, label: 'Chats' },
  { href: '/contacts', icon: Users, label: 'Contacts' },
  { href: '/crm', icon: Database, label: 'CRM' },
  { href: '/blast', icon: Send, label: 'Blast' },
  { href: '/settings', icon: Settings, label: 'Settings' },
  { href: '/setup', icon: QrCode, label: 'Setup' },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="glass border-t border-white/[0.06] flex items-center justify-around px-2 py-2 shrink-0">
      {tabs.map(({ href, icon: Icon, label }) => {
        const active = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link
            key={href}
            href={href}
            className="flex flex-col items-center gap-1 px-4 py-1 group"
          >
            <Icon
              size={20}
              className={active ? 'text-teal' : 'text-slate-500 group-hover:text-slate-300 transition-colors'}
            />
            <span className={`text-[10px] font-medium transition-colors ${active ? 'text-teal' : 'text-slate-500 group-hover:text-slate-300'}`}>
              {label}
            </span>
            {active && (
              <span className="h-[3px] w-5 bg-teal rounded-full" />
            )}
          </Link>
        )
      })}
    </nav>
  )
}
