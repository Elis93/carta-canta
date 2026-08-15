'use client'

// Suggerimento gentile ad attivare la verifica in due passaggi, mostrato a chi
// è su un piano a pagamento (decisione Eli: proporlo «al passaggio a Pro», con
// la spiegazione che è per sicurezza). Si nasconde da solo se il 2FA è già
// attivo o se il piano è Free.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ShieldCheck } from 'lucide-react'
import { getMfaStatus } from '@/lib/actions/mfa'

export function TwoFactorNudge({ plan }: { plan: string }) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    if (plan === 'free') return
    getMfaStatus().then((s) => setShow(!s.enabled)).catch(() => {})
  }, [plan])

  if (!show) return null
  return (
    <Link
      href="/account/sicurezza"
      style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '1px solid #e8d6ad', borderRadius: 14, padding: '13px 14px', textDecoration: 'none', boxShadow: '0 1px 2px rgba(20,20,40,.05)' }}
    >
      <ShieldCheck size={20} style={{ color: '#c9a44c', flexShrink: 0 }} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <b style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#161616' }}>Proteggi il tuo account</b>
        <span style={{ fontSize: 12.5, color: 'var(--cc-muted)' }}>Attiva la verifica in due passaggi: un secondo codice all&rsquo;accesso, per sicurezza.</span>
      </span>
      <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', flexShrink: 0 }}>Attiva →</span>
    </Link>
  )
}
