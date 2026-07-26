'use client'

import { useState } from 'react'
import { runAction } from '@/lib/run-action'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Bell, Phone, Loader2, CheckCircle2, Clock, AlertTriangle, ArrowRight } from 'lucide-react'
import { sendReminderAction } from '@/lib/actions/documents'
import { formatCurrency } from '@/lib/utils'
import { normalizePhoneForWhatsApp } from '@/lib/whatsapp'

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
  expiresAt?: string | null
  publicToken?: string | null
  workspaceName?: string | null
  otherPendingCount?: number
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
  expiresAt,
  publicToken,
  workspaceName,
  otherPendingCount = 0,
}: Props) {
  const router = useRouter()
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSollecita(e: React.MouseEvent) {
    e.stopPropagation()
    setSending(true)
    setError(null)
    const result = await runAction(() => sendReminderAction(documentId), 'inviare il sollecito')
    if (result.error) setError(result.error)
    else setSent(true)
    setSending(false)
  }

  const rowLabel = [docNumber, clientName].filter(Boolean).join(' · ')
  const phoneDigits = clientPhone?.replace(/\D/g, '') ?? ''
  const phoneHref = clientPhone ? `tel:${clientPhone.replace(/\s/g, '')}` : undefined

  // WhatsApp con messaggio precompilato
  const dataScadenza = expiresAt
    ? new Date(expiresAt).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })
    : undefined

  let whatsappHref: string | undefined
  if (phoneDigits) {
    const base = `https://wa.me/${normalizePhoneForWhatsApp(phoneDigits)}`
    if (publicToken) {
      const pubLink = `https://cartacanta.app/p/${publicToken}`
      const msg = `Buongiorno${clientName ? ' ' + clientName : ''}, le ricordo il preventivo ${docNumber ?? ''}${dataScadenza ? ' in scadenza il ' + dataScadenza : ''}. Può visionarlo e accettarlo direttamente qui: ${pubLink}. Resto a disposizione per qualsiasi chiarimento. Cordiali saluti, ${workspaceName ?? ''}`
      whatsappHref = `${base}?text=${encodeURIComponent(msg)}`
    } else {
      whatsappHref = base
    }
  }

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => router.push(`/preventivi/${documentId}`)}
      onKeyDown={(e) => { if (e.key === 'Enter') router.push(`/preventivi/${documentId}`) }}
      style={{
        display: 'block',
        margin: '18px 15px 0',
        background: '#fff',
        borderRadius: 14,
        boxShadow: SH,
        // Bordo oro leggero su un lato: separa le card della Home (Eli 18 lug)
        borderLeft: '2px solid #e5d3a1',
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
                  width: 60, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '0.5px solid #dcdbd7', borderRadius: 10, padding: '12px 0',
                  color: '#1a1a2e', textDecoration: 'none', flexShrink: 0,
                }}
              >
                <svg viewBox="0 0 24 24" width="19" height="19" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.693.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885M20.52 3.449C18.24 1.245 15.24 0 12.045 0 5.463 0 .104 5.334.101 11.892c0 2.096.549 4.142 1.595 5.945L0 24l6.335-1.652a12.062 12.062 0 005.71 1.447h.006c6.585 0 11.946-5.336 11.949-11.896 0-3.18-1.26-6.165-3.55-8.448z"/></svg>
              </a>
            )}
            <a
              href={phoneHref}
              onClick={(e) => e.stopPropagation()}
              aria-label="Chiama"
              style={{
                width: 60, display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '0.5px solid #dcdbd7', borderRadius: 10, padding: '12px 0',
                color: '#1a1a2e', textDecoration: 'none', flexShrink: 0,
              }}
            >
              <Phone size={19} aria-hidden="true" />
            </a>
          </>
        )}
      </div>

      {/* "Altri N in scadenza" — dentro la card, separato da linea grigia */}
      {otherPendingCount > 0 && (
        <>
          <div style={{ height: 1, background: '#efefef', margin: '13px -16px 0' }} />
          <Link
            href="/preventivi/scadenze"
            onClick={(e) => e.stopPropagation()}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, textDecoration: 'none', color: 'inherit' }}
          >
            <span style={{ fontSize: 13, color: '#55534b', display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={18} style={{ color: '#c4791a' }} aria-hidden="true" />
              Altri {otherPendingCount} {otherPendingCount === 1 ? 'preventivo in scadenza' : 'preventivi in scadenza'}
            </span>
            <ArrowRight size={17} style={{ color: 'var(--cc-muted)' }} />
          </Link>
        </>
      )}

      {error && (
        <div style={{ marginTop: 8, fontSize: 12, color: '#dc2626', background: '#fef2f2', borderRadius: 6, padding: '6px 10px' }}>
          {error}
        </div>
      )}
    </div>
  )
}
