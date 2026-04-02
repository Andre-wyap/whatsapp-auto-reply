import type { Metadata } from 'next'
import './globals.css'
import BottomNav from '@/components/BottomNav'

export const metadata: Metadata = {
  title: 'WA Auto-Reply',
  description: 'WhatsApp auto-reply & blast tool',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-void text-slate-200 font-body h-screen flex flex-col overflow-hidden">
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
        <BottomNav />
      </body>
    </html>
  )
}
