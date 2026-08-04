'use client'

// ============================================================
// ScadenzeHomeCard — card unica "In scadenza" della Home (mockup
// approvato da Eli il 2 ago sera, con 2 modifiche sue: SOLLECITA
// anche per la fattura e tasti in fondo COMPRESSI).
// - Blocco PREVENTIVO: numero · cliente + importo (grigio), scadenza
//   ambra, bottoni Sollecita/WhatsApp/chiama.
// - Blocco FATTURA DA INCASSARE: stessa struttura e stessi bottoni.
// - In fondo due tasti compatti "Preventivi (N)" / "Fatture (N)":
//   sostituiscono la voce "Scadenze" di Altro.
// Se una categoria è vuota il suo blocco non compare.
// ============================================================

import { useState } from 'react'
import { runAction } from '@/lib/run-action'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Bell, Phone, Loader2, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react'
import { sendReminderAction } from '@/lib/actions/documents'
import { formatCurrency } from '@/lib/utils'
import { normalizePhoneForWhatsApp } from '@/lib/whatsapp'

const SH = '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)'

export interface ScadenzaDocInfo {
  documentId: string
  /** Numero già formattato per la UI (fatture con "Fatt.", B.3) */
  numberLabel: string | null
  clientName: string | null
  clientEmail: string | null
  clientPhone: string | null
  total: number | null
  /** "Scade tra 3 giorni" / "Da incassare entro 5 giorni" */
  expiresLabel: string
  expiresAt?: string | null
  publicToken?: string | null
  /** Solo preventivi: modificato dopo l'invio */
  isModified?: boolean
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" width="19" height="19" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.693.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885M20.52 3.449C18.24 1.245 15.24 0 12.045 0 5.463 0 .104 5.334.101 11.892c0 2.096.549 4.142 1.595 5.945L0 24l6.335-1.652a12.062 12.062 0 005.71 1.447h.006c6.585 0 11.946-5.336 11.949-11.896 0-3.18-1.26-6.165-3.55-8.448z"/></svg>
  )
}

function ScadenzaBlock({ doc, kind, workspaceName }: {
  doc: ScadenzaDocInfo
  kind: 'preventivo' | 'fattura'
  workspaceName?: string | null
}) {
  const router = useRouter()
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const href = kind === 'fattura' ? `/fatture/${doc.documentId}` : `/preventivi/${doc.documentId}`
  const rowLabel = [doc.numberLabel, doc.clientName].filter(Boolean).join(' · ')

  async function handleSollecita(e: React.MouseEvent) {
    e.stopPropagation()
    setSending(true)
    setError(null)
    const result = await runAction(
      () => sendReminderAction(doc.documentId, kind),
      'inviare il sollecito'
    )
    if (result.error) setError(result.error)
    else setSent(true)
    setSending(false)
  }

  // WhatsApp con messaggio precompilato (il testo dice la cosa giusta per tipo)
  const phoneDigits = doc.clientPhone?.replace(/\D/g, '') ?? ''
  const phoneHref = doc.clientPhone ? `tel:${doc.clientPhone.replace(/\s/g, '')}` : undefined
  const dataScadenza = doc.expiresAt
    ? new Date(doc.expiresAt).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })
    : undefined
  let whatsappHref: string | undefined
  if (phoneDigits) {
    const base = `https://wa.me/${normalizePhoneForWhatsApp(phoneDigits)}`
    if (doc.publicToken) {
      const pubLink = `https://cartacanta.app/p/${doc.publicToken}`
      const msg = kind === 'fattura'
        ? `Buongiorno${doc.clientName ? ' ' + doc.clientName : ''}, le ricordo la fattura ${doc.numberLabel ?? ''}${dataScadenza ? ' da saldare entro il ' + dataScadenza : ''}. La trova qui: ${pubLink}. Resto a disposizione per qualsiasi chiarimento. Cordiali saluti, ${workspaceName ?? ''}`
        : `Buongiorno${doc.clientName ? ' ' + doc.clientName : ''}, le ricordo il preventivo ${doc.numberLabel ?? ''}${dataScadenza ? ' in scadenza il ' + dataScadenza : ''}. Può visionarlo e accettarlo direttamente qui: ${pubLink}. Resto a disposizione per qualsiasi chiarimento. Cordiali saluti, ${workspaceName ?? ''}`
      whatsappHref = `${base}?text=${encodeURIComponent(msg)}`
    } else {
      whatsappHref = base
    }
  }

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => router.push(href)}
      onKeyDown={(e) => { if (e.key === 'Enter') router.push(href) }}
      style={{ cursor: 'pointer' }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: '#b0863e', marginBottom: 5 }}>
        {kind === 'fattura' ? 'Fattura da incassare' : 'Preventivo'}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#6f6d64', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {rowLabel || '—'}
        </span>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#6f6d64', whiteSpace: 'nowrap' }}>
          {formatCurrency(doc.total ?? 0)}
        </span>
      </div>
      <div style={{ fontSize: 13, color: '#b08d3e', marginTop: 3 }}>{doc.expiresLabel}</div>

      {doc.isModified && (
        <div style={{ marginTop: 9, background: '#e9e0f7', borderRadius: 8, padding: '7px 10px', fontSize: 12, color: '#2b2b2b', display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertTriangle size={16} style={{ color: '#6a44b5', flexShrink: 0 }} aria-hidden="true" />
          Modificato — cliente non aggiornato
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 11 }} onClick={(e) => e.stopPropagation()}>
        {/* Sollecita: morbido, non navy pieno (Eli 3 ago sera: "molto
            appariscente") — bianco bordato come i gemelli WhatsApp/Chiama;
            l'importanza la danno l'icona, la larghezza piena e il peso. */}
        {doc.clientEmail && (
          <button
            onClick={handleSollecita}
            disabled={sending || sent}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              background: '#fff',
              color: sent ? '#2f8a63' : '#1a1a2e', borderRadius: 10, padding: '12px',
              fontSize: 14, fontWeight: 600,
              border: '0.5px solid #dcdbd7', cursor: sending || sent ? 'default' : 'pointer',
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
        {doc.clientPhone && (
          <>
            {whatsappHref && (
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                aria-label="WhatsApp"
                style={{
                  width: 56, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '0.5px solid #dcdbd7', borderRadius: 10, padding: '12px 0',
                  color: '#1a1a2e', textDecoration: 'none', flexShrink: 0,
                }}
              >
                <WhatsAppIcon />
              </a>
            )}
            <a
              href={phoneHref}
              onClick={(e) => e.stopPropagation()}
              aria-label="Chiama"
              style={{
                width: 56, display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '0.5px solid #dcdbd7', borderRadius: 10, padding: '12px 0',
                color: '#1a1a2e', textDecoration: 'none', flexShrink: 0,
              }}
            >
              <Phone size={19} aria-hidden="true" />
            </a>
          </>
        )}
      </div>

      {error && (
        <div style={{ marginTop: 8, fontSize: 12, color: '#dc2626', background: '#fef2f2', borderRadius: 6, padding: '6px 10px' }}>
          {error}
        </div>
      )}
    </div>
  )
}

export function ScadenzeHomeCard({ preventivo, fattura, prevCount, fattCount, workspaceName }: {
  preventivo: ScadenzaDocInfo | null
  fattura: ScadenzaDocInfo | null
  prevCount: number
  fattCount: number
  workspaceName?: string | null
}) {
  if (!preventivo && !fattura) return null

  const badge = (n: number) => (
    <span style={{ background: '#c9a44c', color: '#fff', borderRadius: 999, padding: '0 7px', fontSize: 11, fontWeight: 700, lineHeight: 1.7, flexShrink: 0 }}>
      {n}
    </span>
  )
  const footBtn: React.CSSProperties = {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    border: '1px solid #e3e3e6', borderRadius: 10, padding: '11px 6px',
    fontSize: 13, fontWeight: 600, color: '#1a1a2e', textDecoration: 'none',
    background: '#fff', whiteSpace: 'nowrap',
  }

  return (
    <div style={{ margin: '18px 15px 0' }}>
      {/* Titoletto FUORI dalla card, stile Altro */}
      <div className="cc-section-label" style={{ margin: '0 2px 8px' }}>
        In scadenza
      </div>
      <div style={{ background: '#fff', borderRadius: 14, boxShadow: SH, padding: '15px 16px' }}>
        {preventivo && <ScadenzaBlock doc={preventivo} kind="preventivo" workspaceName={workspaceName} />}
        {preventivo && fattura && <div style={{ height: 1, background: '#efefef', margin: '14px -16px' }} />}
        {fattura && <ScadenzaBlock doc={fattura} kind="fattura" workspaceName={workspaceName} />}

        {/* Due tasti compatti: sostituiscono la voce "Scadenze" di Altro.
            Etichette CORTE (Eli: "ho paura che non ci stiano"): il contesto
            lo dà il titoletto "In scadenza". */}
        <div style={{ height: 1, background: '#efefef', margin: '14px -16px 12px' }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/preventivi/scadenze" style={footBtn}>
            Preventivi {prevCount > 0 && badge(prevCount)} <ArrowRight size={14} style={{ color: 'var(--cc-muted)' }} />
          </Link>
          <Link href="/fatture/scadenze" style={footBtn}>
            Fatture {fattCount > 0 && badge(fattCount)} <ArrowRight size={14} style={{ color: 'var(--cc-muted)' }} />
          </Link>
        </div>
      </div>
    </div>
  )
}
