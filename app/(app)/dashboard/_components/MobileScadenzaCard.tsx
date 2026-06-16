'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, MessageCircle, Phone, Loader2, CheckCircle2, Clock, AlertTriangle } from 'lucide-react'
import { sendReminderAction } from '@/lib/actions/documents'
import { formatCurrency } from '@/lib/utils'

const SH = '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)'

interface Props {
  documentId: string
  docNumber: string | null
  clientName: string | null
  clientEmail: string | null
  clientPhone: string | null
  total: number | null
  expiresLabel: string
  isModified: boolean
}

export function MobileScadenzaCard({
  documentId,
  docNumber,
  clientName,
  clientEmail,
  clientPhone,
  total,
  expiresLabel,
  isModified,
}: Props) {
  const router = useRouter()
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSollecita(e: React.MouseEvent) {
    e.stopPropagation()
    setSending(true)
    setError(null)
    const result = await sendReminderAction(documentId)
    if (result.error) setError(result.error)
    else setSent(true)
    setSending(false)
  }

  const rowLabel = [docNumber, clientName].filter(Boolean).join(' · ')
  const phoneDigits = clientPhone?.replace(/\D/g, '') ?? ''
  const whatsappHref = phoneDigits ? `https://wa.me/${phoneDigits}` : undefined
  const phoneHref = clientPhone ? `tel:${clientPhone.replace(/\s/g, '')}` : undefined

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => router.push(`/preventivi/${documentId}`)}
      onKeyDown={(e) => { if (e.key === 'Enter') router.push(`/preventivi/${documentId}`) }}
      style={{
        display: 'block',
        margin: '13px 15px 0',
        background: '#fff',
        borderRadius: 14,
        boxShadow: SH,
        padding: '15px 16px',
        cursor: 'pointer',
      }}
    >
      {/* Urgency header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 11 }}>
        <Clock size={16} style={{ color: '#b08d3e', flexShrink: 0 }} aria-hidden="true" />
        <span style={{ fontSize: 15, fontWeight: 600, color: '#b08d3e' }}>{expiresLabel}</span>
      </div>

      {/* Number · client + amount */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 500, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {rowLabel || '—'}
        </span>
        <span style={{ fontSize: 18, fontWeight: 600, whiteSpace: 'nowrap' }}>
          {formatCurrency(total ?? 0)}
        </span>
      </div>

      {/* Modified badge */}
      {isModified && (
        <div style={{ marginTop: 9, background: '#e9e0f7', borderRadius: 8, padding: '7px 10px', fontSize: 12, color: '#2b2b2b', display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertTriangle size={16} style={{ color: '#6a44b5', flexShrink: 0 }} aria-hidden="true" />
          Modificato — cliente non aggiornato
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, marginTop: 13 }} onClick={(e) => e.stopPropagation()}>
        {clientEmail && (
          <button
            onClick={handleSollecita}
            disabled={sending || sent}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              background: sent ? '#3b3b5a' : '#1a1a2e',
              color: '#fff', borderRadius: 10, padding: '12px',
              fontSize: 14, fontWeight: 500, border: 'none', cursor: sending || sent ? 'default' : 'pointer',
              boxShadow: '0 6px 16px -6px rgba(26,26,46,.5)',
              opacity: sending ? 0.8 : 1,
            }}
          >
            {sending ? (
              <Loader2 size={17} className="animate-spin" />
            ) : sent ? (
              <CheckCircle2 size={17} />
            ) : (
              <Bell size={17} aria-hidden="true" />
            )}
            {sent ? 'Sollecito inviato ✓' : 'Sollecita per mail'}
          </button>
        )}
        {clientPhone && (
          <>
            {whatsappHref && (
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                aria-label="WhatsApp"
                style={{
                  width: 48, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '0.5px solid #dcdbd7', borderRadius: 10, padding: '12px 0',
                  color: '#1a1a2e', textDecoration: 'none', flexShrink: 0,
                }}
              >
                <MessageCircle size={19} aria-hidden="true" />
              </a>
            )}
            <a
              href={phoneHref}
              onClick={(e) => e.stopPropagation()}
              aria-label="Chiama"
              style={{
                width: 48, display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '0.5px solid #dcdbd7', borderRadius: 10, padding: '12px 0',
                color: '#1a1a2e', textDecoration: 'none', flexShrink: 0,
              }}
            >
              <Phone size={19} aria-hidden="true" />
            </a>
          </>
        )}
      </div>

      {/* Hint */}
      <div style={{ textAlign: 'center', fontSize: 11, color: '#8a887f', marginTop: 9 }}>
        Tocca la card per aprire il preventivo
      </div>

      {error && (
        <div style={{ marginTop: 8, fontSize: 12, color: '#dc2626', background: '#fef2f2', borderRadius: 6, padding: '6px 10px' }}>
          {error}
        </div>
      )}
    </div>
  )
}
