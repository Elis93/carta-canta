'use client'

// Riga richiesta marketplace: tocca per aprire i dettagli (→ segna Letta),
// bottone "Segna come risposta" quando hai ricontattato il cliente.

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import { markRequestStatusAction } from '@/lib/actions/marketplace'

export interface RequestData {
  id: string
  customer_name: string
  customer_contact: string
  customer_city: string | null
  message: string
  status: 'new' | 'read' | 'replied'
  created_at: string
}

function fmtWhen(iso: string): string {
  const d = new Date(iso)
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000)
  const time = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
  if (days <= 0) return `oggi, ${time}`
  if (days === 1) return `ieri, ${time}`
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }).replace('.', '')
}

const STATUS_PILL: Record<RequestData['status'], { label: string; border: string; color: string }> = {
  new: { label: 'Nuova', border: '#b9c2e2', color: '#1a1a2e' },
  read: { label: 'Letta', border: '#e3e3e6', color: '#8a887f' },
  replied: { label: 'Risposta', border: '#bce3d2', color: '#2f8a63' },
}

export function RequestRow({ request, last }: { request: RequestData; last: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState(request.status)
  const [, startTransition] = useTransition()

  function toggle() {
    const next = !open
    setOpen(next)
    if (next && status === 'new') {
      setStatus('read')
      startTransition(async () => { await markRequestStatusAction(request.id, 'read') })
    }
  }

  function markReplied() {
    setStatus('replied')
    startTransition(async () => {
      await markRequestStatusAction(request.id, 'replied')
      router.refresh()
    })
  }

  const pill = STATUS_PILL[status]
  const initials = request.customer_name.split(/\s+/).slice(0, 2).map((w) => w[0] ?? '').join('').toUpperCase() || '?'
  const isPhone = /^[\d\s+()-]{6,}$/.test(request.customer_contact)

  return (
    <div style={{ borderBottom: last ? 'none' : '0.5px solid #eee' }}>
      <button
        type="button"
        onClick={toggle}
        style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', padding: '12px 0', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
      >
        <span style={{ width: 36, height: 36, borderRadius: '50%', background: '#f2f2f5', color: '#55534b', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {initials}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#161616' }}>{request.customer_name}</span>
          <span style={{ display: 'block', fontSize: 12, color: '#8a887f', marginTop: 1 }}>
            {[request.customer_city, fmtWhen(request.created_at)].filter(Boolean).join(' · ')}
          </span>
        </span>
        <span style={{ border: `1px solid ${pill.border}`, color: pill.color, borderRadius: 999, padding: '3px 9px', fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
          {pill.label}
        </span>
        <ChevronDown size={16} style={{ color: '#c2c1bd', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
      </button>

      {open && (
        <div style={{ padding: '0 0 13px 47px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: '#8a887f' }}>Che lavoro serve</div>
          <p style={{ fontSize: 13, color: '#161616', lineHeight: 1.55, margin: '5px 0 0', whiteSpace: 'pre-wrap' }}>{request.message}</p>
          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: '#8a887f', marginTop: 11 }}>Contatto</div>
          <p style={{ fontSize: 13, margin: '5px 0 0' }}>
            <a
              href={isPhone ? `tel:${request.customer_contact.replace(/\s/g, '')}` : `mailto:${request.customer_contact}`}
              style={{ color: '#1a1a2e', fontWeight: 600, textDecoration: 'none' }}
            >
              {request.customer_contact}
            </a>
          </p>
          <div style={{ display: 'flex', gap: 9, marginTop: 12 }}>
            <Link
              href="/preventivi/nuovo"
              style={{ flex: 1, height: 40, borderRadius: 11, background: '#1a1a2e', color: '#fff', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', boxShadow: '0 6px 16px -6px rgba(26,26,46,.5)' }}
            >
              Crea preventivo
            </Link>
            {status !== 'replied' && (
              <button
                type="button"
                onClick={markReplied}
                style={{ flex: 1, height: 40, borderRadius: 11, border: '1px solid #e7e7ea', background: '#fff', color: '#1a1a2e', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Segna come risposta
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
