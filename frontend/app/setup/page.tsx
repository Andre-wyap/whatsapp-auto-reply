'use client'

import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import type { ConnectionStatus } from '@/lib/types'
import { Wifi, WifiOff, Loader2, RefreshCw, LogOut } from 'lucide-react'

export default function SetupPage() {
  const [status, setStatus] = useState<ConnectionStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)

  const fetchStatus = useCallback(async () => {
    try {
      const data = await api.status() as ConnectionStatus
      setStatus(data)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reach backend')
    }
  }, [])

  useEffect(() => {
    fetchStatus()
    // Poll every 3s while not connected
    const interval = setInterval(() => {
      if (status?.status !== 'open') fetchStatus()
    }, 3000)
    return () => clearInterval(interval)
  }, [fetchStatus, status?.status])

  return (
    <div className="h-full flex flex-col items-center justify-center p-6 gap-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="font-display text-3xl font-bold text-white mb-2">
          WhatsApp Setup
        </h1>
        <p className="text-slate-400 text-sm">
          Scan the QR code with your WhatsApp to connect
        </p>
      </div>

      {/* Status card */}
      <div className="glass rounded-card p-6 w-full max-w-sm flex flex-col items-center gap-6">

        {/* Connection badge */}
        <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
          status?.status === 'open'
            ? 'bg-teal/20 text-teal border border-teal/30'
            : status?.status === 'connecting' || status?.status === 'close'
            ? 'bg-amber/20 text-amber border border-amber/30'
            : 'bg-white/5 text-slate-400 border border-white/10'
        }`}>
          {status?.status === 'open' ? (
            <><Wifi size={14} /> Connected</>
          ) : status?.status === 'connecting' || status?.status === 'close' ? (
            <><Loader2 size={14} className="animate-spin" /> Waiting for scan…</>
          ) : (
            <><WifiOff size={14} /> Not connected</>
          )}
        </div>

        {/* QR code */}
        {status?.qr ? (
          <div className="bg-white p-3 rounded-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={status.qr}
              alt="WhatsApp QR Code"
              width={220}
              height={220}
              className="block"
            />
          </div>
        ) : status?.status === 'open' ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="w-16 h-16 rounded-full bg-teal/20 flex items-center justify-center">
              <Wifi size={32} className="text-teal" />
            </div>
            <p className="text-slate-300 text-sm text-center">
              WhatsApp is connected and running.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-4">
            <Loader2 size={36} className="text-slate-500 animate-spin" />
            <p className="text-slate-500 text-sm">Loading QR code…</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="text-coral text-xs text-center bg-coral/10 rounded-xl px-4 py-2 border border-coral/20">
            {error}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-2 w-full">
          <button
            onClick={fetchStatus}
            className="btn-ghost flex-1 flex items-center justify-center gap-2 text-sm"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
          {status?.status === 'open' && (
            <button
              disabled={loggingOut}
              onClick={async () => {
                if (!confirm('Logout and re-scan QR? This will sync all your WhatsApp contacts.')) return
                setLoggingOut(true)
                try { await api.logout() } catch { /* ignore */ }
                setTimeout(fetchStatus, 2000)
                setLoggingOut(false)
              }}
              className="btn-ghost flex-1 flex items-center justify-center gap-2 text-sm text-coral hover:text-coral"
            >
              {loggingOut ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
              Re-sync
            </button>
          )}
        </div>
      </div>

      <p className="text-slate-600 text-xs text-center max-w-xs">
        Open WhatsApp on your phone → Linked Devices → Link a Device → Scan
      </p>
    </div>
  )
}
