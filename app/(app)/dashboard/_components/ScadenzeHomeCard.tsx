'use client'

// ============================================================
// ScadenzeHomeCard — la sezione "In scadenza" della Home.
// UNA CARD PER DOCUMENTO, vicine fra loro (10px) perché sono la stessa
// sezione: il preventivo da sollecitare e la fattura da incassare.
// Ogni card: categoria + scadenza sulla prima riga, numero · cliente +
// importo sulla seconda, i bottoni Sollecita/WhatsApp/Chiama, e in fondo
// il proprio collegamento "vedi tutti" separato da un filetto.
// Se una categoria è vuota la sua card non compare.
// ============================================================

import { useState } from 'react'
import { runAction } from '@/lib/run-action'
import { useRouter } from 'next/navigation'
import { Mail, Phone, Loader2, CheckCircle2, Info } from 'lucide-react'
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
  const [infoOpen, setInfoOpen] = useState(false)

  const href = kind === 'fattura' ? `/fatture/${doc.documentId}` : `/preventivi/${doc.documentId}`

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

  // Redesign 19-20 ago (mockup approvato): il CLIENTE è la riga grande; il
  // documento («Preventivo 023/2026») scende sotto, piccolo, con la scadenza
  // colorata. Un filetto verticale a sinistra dà l'urgenza a colpo d'occhio.
  const scaduto = /^scadut/i.test(doc.expiresLabel)
  const urgColor = scaduto ? '#a5564e' : '#a5793a'
  // Abbreviato (variante B, Eli 20 ago): la riga ora convive coi tasti.
  const docLabel = `${kind === 'fattura' ? 'Fatt.' : 'Prev.'} ${doc.numberLabel ?? '—'}`
  const mainLabel = doc.clientName?.trim() || `${kind === 'fattura' ? 'Fattura' : 'Preventivo'} ${doc.numberLabel ?? '—'}`

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => router.push(href)}
      onKeyDown={(e) => { if (e.key === 'Enter') router.push(href) }}
      style={{ cursor: 'pointer' }}
    >
      {/* Filetto d'urgenza al FILO del bordo sinistro della card (la card è
          position:relative): stessa colonna del filetto di «Lavoro in corso»
          (Eli 20 ago: «devono essere tutte nella stessa identica posizione»). */}
      <span aria-hidden style={{ position: 'absolute', left: 0, top: 8, bottom: 8, width: 3, borderRadius: 3, background: urgColor }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#161616', minWidth: 0, lineHeight: 1.25, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {mainLabel}
        </span>
        <span style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 16, fontWeight: 600, color: '#161616', whiteSpace: 'nowrap', flexShrink: 0 }}>
          {formatCurrency(doc.total ?? 0)}
        </span>
      </div>
      {/* Riga 2 — variante B (scelta Eli 20 ago): a SINISTRA due righe di
          testo — identificativo del documento sopra, scadenza sotto — a
          DESTRA i tre tasti quadrati piccoli (busta = Sollecita,
          WhatsApp, Chiama). Via la riga dei tasti a tutta larghezza e la
          riga dedicata a «Modificato», che ora sta in coda al documento. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {(doc.clientName?.trim() || doc.isModified) && (
            <div style={{ fontSize: 12.5, color: 'var(--cc-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {doc.clientName?.trim() ? docLabel : null}
              {doc.isModified && (
                <>
                  {doc.clientName?.trim() ? ' · ' : null}
                  <span style={{ color: '#6a44b5', fontWeight: 600 }}>Mod.</span>{' '}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setInfoOpen((o) => !o) }}
                    aria-expanded={infoOpen}
                    aria-label="Cosa vuol dire che il documento è modificato"
                    style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: 18, height: 18, borderRadius: '50%', border: '1px solid #d9d7d0',
                      background: infoOpen ? '#f2f2f4' : '#fff', color: '#6f6d64',
                      cursor: 'pointer', padding: 0, verticalAlign: '-4px',
                    }}
                  >
                    <Info size={11} />
                  </button>
                </>
              )}
            </div>
          )}
          <div style={{ fontSize: 12.5, fontWeight: 600, color: urgColor, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {doc.expiresLabel}
          </div>
        </div>
        {/* Tasti quadrati piccoli — 38×34 come nel mockup approvato */}
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
          {doc.clientEmail && (
            <button
              onClick={handleSollecita}
              disabled={sending || sent}
              aria-label={sent ? 'Sollecito inviato' : 'Sollecita per email'}
              style={{
                width: 38, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: '#fff', color: sent ? '#2f8a63' : '#b0863e', borderRadius: 9,
                border: sent ? '1px solid #bce3d2' : '1px solid #e0c98a',
                cursor: sending || sent ? 'default' : 'pointer', opacity: sending ? 0.8 : 1, flexShrink: 0,
              }}
            >
              {sending ? <Loader2 size={15} className="animate-spin" /> : sent ? <CheckCircle2 size={16} /> : <Mail size={16} aria-hidden="true" />}
            </button>
          )}
          {doc.clientPhone && (
            <>
              {whatsappHref && (
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="WhatsApp"
                  style={{
                    width: 38, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '1px solid #d9d7d0', borderRadius: 9,
                    color: '#1a1a2e', textDecoration: 'none', flexShrink: 0,
                  }}
                >
                  <WhatsAppIcon />
                </a>
              )}
              <a
                href={phoneHref}
                aria-label="Chiama"
                style={{
                  width: 38, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '1px solid #d9d7d0', borderRadius: 9,
                  color: '#1a1a2e', textDecoration: 'none', flexShrink: 0,
                }}
              >
                <Phone size={16} aria-hidden="true" />
              </a>
            </>
          )}
        </div>
      </div>

      {/* Pannello ⓘ «Modificato» — a tutta larghezza, sotto la riga */}
      {doc.isModified && infoOpen && (
        <div onClick={(e) => e.stopPropagation()} style={{ background: '#f7f6f2', border: '1px solid #e8e6e0', borderRadius: 10, padding: '10px 12px', marginTop: 7, fontSize: 12.5, color: '#3f3d36', lineHeight: 1.55 }}>
          <p style={{ margin: 0, fontWeight: 600, color: '#161616' }}>Cosa vuol dire &laquo;Modificato&raquo;?</p>
          <p style={{ margin: '6px 0 0' }}>
            Hai cambiato qualcosa dopo averlo mandato al cliente: importi, voci o
            condizioni.
          </p>
          <p style={{ margin: '6px 0 0' }}>
            Chi riapre il link vede <b>già la versione nuova</b> — ma il cliente
            <b>{' '}non è stato avvisato</b>: se l&rsquo;aveva letto prima, sta ragionando
            sui numeri vecchi.
          </p>
          <p style={{ margin: '6px 0 0' }}>
            Se la modifica conta, <b>rimandaglielo</b>.
          </p>
        </div>
      )}

      {error && (
        <div style={{ marginTop: 8, fontSize: 12, color: '#dc2626', background: '#fef2f2', borderRadius: 6, padding: '6px 10px' }}>
          {error}
        </div>
      )}
    </div>
  )
}

/** Nessun documento dentro la finestra di preavviso: si dice, non si nasconde. */
function VuotoBlock({ kind }: { kind: 'preventivo' | 'fattura' }) {
  return (
    <div style={{ fontSize: 13.5, color: 'var(--cc-muted)' }}>
      {kind === 'fattura'
        ? 'Nessuna fattura in imminente scadenza.'
        : 'Nessun preventivo in imminente scadenza.'}
    </div>
  )
}

export function ScadenzeHomeCard({ preventivo, fattura, workspaceName }: {
  preventivo: ScadenzaDocInfo | null
  fattura: ScadenzaDocInfo | null
  workspaceName?: string | null
}) {
  // ⚠️ La sezione c'è SEMPRE, anche quando non c'è niente in scadenza (Eli,
  // 8 ago: *"deve comparire sempre e se non ci sono documenti, dire che non ci
  // sono"*): una sezione che sparisce non si legge come "nessuna scadenza",
  // si legge come "dov'è finita?".
  // Redesign 19-20 ago: UN solo titolo «In scadenza», prima il preventivo poi
  // la fattura (il tipo lo dice la riga «Preventivo 023/2026»); i «vedi
  // tutti» coi conteggi vivono ora nei riquadri della TESTATA navy
  // (Preventivi in scadenza / Fatture da incassare), non più qui in piede.
  return (
    <div style={{ margin: '18px 15px 0' }}>
      <div className="cc-section-label" style={{ margin: '0 2px 8px' }}>
        In scadenza
      </div>
      <div style={{ position: 'relative', background: '#fff', borderRadius: 14, boxShadow: SH, padding: '13px 15px' }}>
        {preventivo
          ? <ScadenzaBlock doc={preventivo} kind="preventivo" workspaceName={workspaceName} />
          : <VuotoBlock kind="preventivo" />}
      </div>
      <div style={{ position: 'relative', background: '#fff', borderRadius: 14, boxShadow: SH, padding: '13px 15px', marginTop: 10 }}>
        {fattura
          ? <ScadenzaBlock doc={fattura} kind="fattura" workspaceName={workspaceName} />
          : <VuotoBlock kind="fattura" />}
      </div>
    </div>
  )
}
