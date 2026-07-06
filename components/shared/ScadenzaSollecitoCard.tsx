'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Clock, Phone, Mail, Loader2, CheckCircle2 } from 'lucide-react'
import { StatusBadge } from '@/app/(app)/preventivi/_components/StatusBadge'
import { sendReminderAction } from '@/lib/actions/documents'
import { formatCurrency, formatDocNumber } from '@/lib/utils'

const SH = '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)'

type Urgency = 'overdue' | 'soon' | 'open'

interface Props {
  docType: 'preventivo' | 'fattura'
  documentId: string
  docNumber: string | null
  status: string
  isModified: boolean
  clientName: string | null
  clientEmail: string | null
  clientPhone: string | null
  total: number | null
  expiresAt: string | null
  /** Giorni alla scadenza calcolati server-side (negativo = scaduto, null = senza scadenza) */
  daysLeft: number | null
  publicToken: string | null
  workspaceName: string | null
}

// Colori dal mockup "Fatture — Da incassare / Solleciti"
const URGENCY_STYLE: Record<Urgency, { border: string; text: string }> = {
  overdue: { border: '#e7bcbc', text: '#b05656' },
  soon:    { border: '#e3cc9c', text: '#b0863e' },
  open:    { border: '#b4cae9', text: '#3f6fb0' },
}

const WHATSAPP_SVG = (
  <svg viewBox="0 0 24 24" width="19" height="19" fill="#1a1a2e" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.693.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885M20.52 3.449C18.24 1.245 15.24 0 12.045 0 5.463 0 .104 5.334.101 11.892c0 2.096.549 4.142 1.595 5.945L0 24l6.335-1.652a12.062 12.062 0 005.71 1.447h.006c6.585 0 11.946-5.336 11.949-11.896 0-3.18-1.26-6.165-3.55-8.448z"/></svg>
)

function ChannelCircle({ children, disabled }: { children: React.ReactNode; disabled?: boolean }) {
  return (
    <div
      style={{
        width: 40, height: 40, borderRadius: '50%',
        background: '#f7f7f8', border: '1px solid #ededf0',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </div>
  )
}

export function ScadenzaSollecitoCard({
  docType,
  documentId,
  docNumber,
  status,
  isModified,
  clientName,
  clientEmail,
  clientPhone,
  total,
  expiresAt,
  daysLeft,
  publicToken,
  workspaceName,
}: Props) {
  const router = useRouter()
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isFattura = docType === 'fattura'
  const detailHref = `/${isFattura ? 'fatture' : 'preventivi'}/${documentId}`

  const urgency: Urgency =
    daysLeft === null ? 'open' : daysLeft < 0 ? 'overdue' : daysLeft <= 7 ? 'soon' : 'open'
  const st = URGENCY_STYLE[urgency]

  // Etichetta pillola scadenza (genere per doc type)
  const pillLabel =
    urgency === 'overdue'
      ? (isFattura ? 'Scaduta' : 'Scaduto')
      : urgency === 'soon'
        ? 'In scadenza'
        : (isFattura ? 'Aperta' : 'Aperto')

  // Riga scadenza: "Scaduta da 5 giorni · scad. 28 giu" / "Scade tra 2 giorni · 5 lug" / "Scade il 22 lug"
  const shortDate = expiresAt
    ? new Date(expiresAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
    : null
  let dueLine: string
  if (daysLeft === null || !shortDate) {
    dueLine = 'Senza scadenza'
  } else if (daysLeft < 0) {
    const n = Math.abs(daysLeft)
    dueLine = `${isFattura ? 'Scaduta' : 'Scaduto'} da ${n} giorn${n === 1 ? 'o' : 'i'} · scad. ${shortDate}`
  } else if (daysLeft === 0) {
    dueLine = `Scade oggi · ${shortDate}`
  } else if (daysLeft === 1) {
    dueLine = `Scade domani · ${shortDate}`
  } else if (urgency === 'soon') {
    dueLine = `Scade tra ${daysLeft} giorni · ${shortDate}`
  } else {
    dueLine = `Scade il ${shortDate}`
  }
  // Nel mockup la riga della card "Aperta" è grigia (#8a887f), non blu
  const dueLineColor = urgency === 'open' ? '#8a887f' : st.text

  const numClean = formatDocNumber(docNumber)

  // ── Canali sollecito ──────────────────────────────────────────────
  const phoneHref = clientPhone ? `tel:${clientPhone.replace(/\s/g, '')}` : undefined
  const phoneDigits = clientPhone?.replace(/\D/g, '') ?? ''

  const dataScadenza = expiresAt
    ? new Date(expiresAt).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })
    : undefined
  const pubLink = publicToken ? `https://cartacanta.app/p/${publicToken}` : undefined

  // Messaggio precompilato (stesso pattern della MobileScadenzaCard, adattato per le fatture)
  const reminderMsg = isFattura
    ? `Buongiorno${clientName ? ' ' + clientName : ''}, le ricordo il pagamento della fattura ${numClean}${dataScadenza ? (daysLeft !== null && daysLeft < 0 ? ' scaduta il ' + dataScadenza : ' in scadenza il ' + dataScadenza) : ''}.${pubLink ? ' Può visualizzarla direttamente qui: ' + pubLink + '.' : ''} Resto a disposizione per qualsiasi chiarimento. Cordiali saluti, ${workspaceName ?? ''}`
    : `Buongiorno${clientName ? ' ' + clientName : ''}, le ricordo il preventivo ${numClean}${dataScadenza ? ' in scadenza il ' + dataScadenza : ''}.${pubLink ? ' Può visionarlo e accettarlo direttamente qui: ' + pubLink + '.' : ''} Resto a disposizione per qualsiasi chiarimento. Cordiali saluti, ${workspaceName ?? ''}`

  let whatsappHref: string | undefined
  if (phoneDigits) {
    whatsappHref = `https://wa.me/${phoneDigits}?text=${encodeURIComponent(reminderMsg)}`
  }

  // Email: sollecito in-app per ENTRAMBI i tipi (prima le fatture usavano un
  // mailto: — stessa etichetta, comportamento diverso; unificato 5 lug)
  async function handleEmailSollecito(e: React.MouseEvent) {
    e.stopPropagation()
    if (sending || sent) return
    setSending(true)
    setError(null)
    const result = await sendReminderAction(documentId, docType)
    if (result.error) setError(result.error)
    else setSent(true)
    setSending(false)
  }

  const channelLabelStyle: React.CSSProperties = { fontSize: 11, color: '#8a887f' }
  const channelColStyle: React.CSSProperties = {
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
    textDecoration: 'none',
  }

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => router.push(detailHref)}
      onKeyDown={(e) => { if (e.key === 'Enter') router.push(detailHref) }}
      style={{
        margin: '14px 15px 0',
        background: '#fff',
        borderRadius: 14,
        boxShadow: SH,
        borderLeft: `3px solid ${st.border}`,
        padding: '15px 16px 16px',
        cursor: 'pointer',
      }}
    >
      {/* Riga badge: scadenza a sinistra, stato a destra */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <span
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: 11, fontWeight: 600, color: st.text,
            background: '#fff', border: `1px solid ${st.border}`,
            borderRadius: 999, padding: '3px 10px', flex: '0 0 auto',
          }}
        >
          {urgency === 'overdue'
            ? <AlertTriangle size={13} aria-hidden="true" />
            : <Clock size={13} aria-hidden="true" />}
          {pillLabel}
        </span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <StatusBadge status={status} docType={docType} showTooltip={false} />
          {isModified && (
            <span
              style={{
                display: 'inline-flex', alignItems: 'center',
                fontSize: 11, fontWeight: 600, color: '#2b2b2b',
                background: '#e9e0f7', borderRadius: 999, padding: '3px 10px',
              }}
            >
              {isFattura ? 'Modificata' : 'Modificato'}
            </span>
          )}
        </div>
      </div>

      {/* Cliente · numero + importo — il nome lungo si tronca con … (non si
          sovrappone mai all'importo, feedback Eli 6 lug) */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginTop: 12 }}>
        <div style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 600, color: '#161616', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {clientName ?? '—'} <span style={{ color: '#a5a39b', fontWeight: 500 }}>· {numClean}</span>
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#161616', flex: '0 0 auto' }}>
          {formatCurrency(total ?? 0)}
        </div>
      </div>

      {/* Riga scadenza */}
      <div style={{ fontSize: 12, fontWeight: 600, color: dueLineColor, marginTop: 6 }}>
        {dueLine}
      </div>

      {/* Sezione SOLLECITA */}
      <div style={{ marginTop: 15, paddingTop: 14, borderTop: '0.5px solid #f0f0f0' }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: '#a5a39b', marginBottom: 12 }}>
          Sollecita
        </div>
        <div style={{ display: 'flex', padding: '0 4px' }} onClick={(e) => e.stopPropagation()}>
          {/* Chiama */}
          {phoneHref ? (
            <a href={phoneHref} aria-label="Chiama" style={channelColStyle}>
              <ChannelCircle><Phone size={19} style={{ color: '#1a1a2e' }} aria-hidden="true" /></ChannelCircle>
              <span style={channelLabelStyle}>Chiama</span>
            </a>
          ) : (
            <div style={channelColStyle} aria-disabled="true">
              <ChannelCircle disabled><Phone size={19} style={{ color: '#1a1a2e' }} aria-hidden="true" /></ChannelCircle>
              <span style={channelLabelStyle}>Chiama</span>
            </div>
          )}

          {/* WhatsApp */}
          {whatsappHref ? (
            <a href={whatsappHref} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" style={channelColStyle}>
              <ChannelCircle>{WHATSAPP_SVG}</ChannelCircle>
              <span style={channelLabelStyle}>WhatsApp</span>
            </a>
          ) : (
            <div style={channelColStyle} aria-disabled="true">
              <ChannelCircle disabled>{WHATSAPP_SVG}</ChannelCircle>
              <span style={channelLabelStyle}>WhatsApp</span>
            </div>
          )}

          {/* Email — sollecito in-app (preventivi E fatture) */}
          {(
            <button
              type="button"
              onClick={handleEmailSollecito}
              disabled={!clientEmail || sending || sent}
              aria-label="Sollecita via email"
              style={{
                ...channelColStyle,
                background: 'none', border: 'none', padding: 0,
                cursor: !clientEmail || sending || sent ? 'default' : 'pointer',
                font: 'inherit',
              }}
            >
              <ChannelCircle disabled={!clientEmail}>
                {sending ? (
                  <Loader2 size={19} className="animate-spin" style={{ color: '#1a1a2e' }} aria-hidden="true" />
                ) : sent ? (
                  <CheckCircle2 size={19} style={{ color: '#2f8a63' }} aria-hidden="true" />
                ) : (
                  <Mail size={19} style={{ color: '#1a1a2e' }} aria-hidden="true" />
                )}
              </ChannelCircle>
              <span style={{ ...channelLabelStyle, color: sent ? '#2f8a63' : '#8a887f' }}>
                {sent ? 'Inviato ✓' : 'Email'}
              </span>
            </button>
          )}
        </div>

        {error && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ marginTop: 10, fontSize: 12, color: '#b05656', background: '#f5dede', borderRadius: 8, padding: '6px 10px' }}
          >
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
