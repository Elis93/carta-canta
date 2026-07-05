'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, ChevronRight, X } from 'lucide-react'

export interface ProfileItem {
  key: string
  label: string
  done: boolean
  href: string
}

// Ricomparsa dopo la ✕: 3 giorni (decisione Eli — è un promemoria, non deve sparire per sempre)
const DISMISS_MS = 3 * 24 * 60 * 60 * 1000
const STORAGE_KEY = 'cc_profile_reminder_dismissed_at'

/**
 * Card "Completa il tuo profilo" (Home): progresso calcolato dai dati reali del
 * workspace. Il server la renderizza solo se manca qualcosa; a profilo completo
 * sparisce per sempre. La ✕ la nasconde per 3 giorni (localStorage).
 */
export function CompleteProfileCard({ items }: { items: ProfileItem[] }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      const ts = Number(localStorage.getItem(STORAGE_KEY) ?? 0)
      setVisible(!ts || Date.now() - ts > DISMISS_MS)
    } catch {
      setVisible(true)
    }
  }, [])

  if (!visible) return null

  const done = items.filter((i) => i.done).length
  const total = items.length
  const pct = Math.round((done / total) * 100)

  function dismiss() {
    try { localStorage.setItem(STORAGE_KEY, String(Date.now())) } catch { /* noop */ }
    setVisible(false)
  }

  return (
    <div style={{ margin: '18px 15px 0', background: '#fff', borderRadius: 12, boxShadow: '0 1px 2px rgba(20,20,40,.04), 0 6px 16px -8px rgba(20,20,40,.13)', borderLeft: '3px solid #c9a44c', padding: '13px 14px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ flex: 1, fontSize: 15, fontWeight: 600, color: '#161616' }}>Completa il tuo profilo</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#b08d3e', whiteSpace: 'nowrap' }}>{done} di {total} fatto</span>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Nascondi promemoria"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#8a887f', lineHeight: 0, flexShrink: 0 }}
        >
          <X size={17} />
        </button>
      </div>

      {/* Barra di avanzamento */}
      <div style={{ marginTop: 9, height: 6, borderRadius: 999, background: '#ececef', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 999, background: '#c9a44c' }} />
      </div>

      {/* Voci */}
      <div style={{ marginTop: 6 }}>
        {items.map((item) => (
          item.done ? (
            <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 0', fontSize: 14, color: '#8a887f' }}>
              <CheckCircle2 size={17} style={{ color: '#2f8a63', flexShrink: 0 }} />
              {item.label}
            </div>
          ) : (
            <Link key={item.key} href={item.href} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 0', fontSize: 14, fontWeight: 500, color: '#161616', textDecoration: 'none' }}>
              <span style={{ width: 17, height: 17, borderRadius: '50%', border: '1.5px solid #d7d4cb', flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{item.label}</span>
              <ChevronRight size={16} style={{ color: '#8a887f', flexShrink: 0 }} />
            </Link>
          )
        ))}
      </div>

      {/* Perché serve */}
      <div style={{ fontSize: 12, color: '#8a887f', lineHeight: 1.45, marginTop: 4 }}>
        Servono per i tuoi documenti e per farti contattare dai clienti.
      </div>
    </div>
  )
}
