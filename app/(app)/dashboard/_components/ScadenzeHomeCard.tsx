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
import { Bell, Phone, Loader2, CheckCircle2, AlertTriangle, Info } from 'lucide-react'
import { HomeCardFootLink } from './HomeSectionLink'
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
      {/* Testata: COSA a sinistra, QUANDO a destra — sulla stessa riga.
          Prima erano due righe distinte e la scadenza (l'informazione per cui
          la card esiste) finiva terza, sotto l'importo. Così si legge subito
          e la card perde una riga. */}
      {/* ⚠️ `flexWrap` + `marginLeft: auto` sulla scadenza: quando titoletto ed
          etichetta ci stanno, restano sulla stessa riga (è il caso di
          «Scaduta»); quando l'etichetta è lunga — «fra 13 giorni · 20 ago» —
          scende su una riga propria, allineata a destra, INVECE di spezzare a
          metà il titoletto. Prima avevo accorciato il titoletto per farceli
          stare tutti e due: Eli lo rivuole per esteso, e questo lo permette
          senza rompere nulla a nessuna larghezza. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '2px 10px', marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: '#6f6d64', flexShrink: 0 }}>
          {kind === 'fattura' ? 'Fatture da incassare' : 'Preventivo'}
        </span>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: '#b08d3e', whiteSpace: 'nowrap', flexShrink: 0, marginLeft: 'auto' }}>
          {doc.expiresLabel}
        </span>
      </div>
      {/* ⚠️ Numero e cliente in `var(--cc-muted)`, più chiaro dell'importo
          (Eli 7 ago: "facciamoli meno vistosi"): sono l'etichetta di CHI, non
          il dato per cui la card esiste — quelli sono la scadenza e l'importo.
          La variabile, non il letterale: in "Testo grande" si scurisce da sola
          per tenere il contrasto leggibile. */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--cc-muted)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {rowLabel || '—'}
        </span>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#6f6d64', whiteSpace: 'nowrap' }}>
          {formatCurrency(doc.total ?? 0)}
        </span>
      </div>

      {/* Avviso "modificato": una RIGA, non un blocco pieno. Il riquadro viola
          a tutta larghezza pesava più della scadenza e portava un terzo colore
          dentro una card che ne ha già due (feedback Eli 7 ago: "confusionario"). */}
      {/* "Modificato" + punto ⓘ, come sulla card SdI (feedback Eli 7 ago:
          "cliente non aggiornato" non dice niente a chi apre l'app la prima
          volta). La parola corta resta in vista, la spiegazione si apre solo
          a chi la cerca — senza occupare la Home a tutti gli altri. */}
      {doc.isModified && (
        <div style={{ marginTop: 6 }} onClick={(e) => e.stopPropagation()}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6a44b5' }}>
            <AlertTriangle size={14} style={{ flexShrink: 0 }} aria-hidden="true" />
            Modificato
            <button
              type="button"
              onClick={() => setInfoOpen((o) => !o)}
              aria-expanded={infoOpen}
              aria-label="Cosa vuol dire che il documento è modificato"
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 20, height: 20, borderRadius: '50%', border: '1px solid #d9d7d0',
                background: infoOpen ? '#f2f2f4' : '#fff', color: '#6f6d64',
                cursor: 'pointer', padding: 0, flexShrink: 0,
              }}
            >
              <Info size={12} />
            </button>
          </span>
          {infoOpen && (
            <div style={{ background: '#f7f6f2', border: '1px solid #e8e6e0', borderRadius: 10, padding: '10px 12px', marginTop: 7, fontSize: 12.5, color: '#3f3d36', lineHeight: 1.55 }}>
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
                Se la modifica conta, <b>rimandaglielo</b>: apri il documento e usa
                &laquo;Invia al cliente&raquo;. L&rsquo;avviso sparisce da solo dopo il nuovo invio.
              </p>
            </div>
          )}
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
              border: sent ? '0.5px solid #bce3d2' : '1px solid #e0c98a', cursor: sending || sent ? 'default' : 'pointer',
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

/** Nessun documento dentro la finestra di preavviso: si dice, non si nasconde. */
function VuotoBlock({ kind }: { kind: 'preventivo' | 'fattura' }) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: '#6f6d64', marginBottom: 6 }}>
        {kind === 'fattura' ? 'Fatture da incassare' : 'Preventivi'}
      </div>
      <div style={{ fontSize: 14, color: 'var(--cc-muted)' }}>
        {kind === 'fattura'
          ? 'Non ci sono fatture in imminente scadenza.'
          : 'Non ci sono preventivi in imminente scadenza.'}
      </div>
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
  // ⚠️ La sezione c'è SEMPRE, anche quando non c'è niente in scadenza (Eli,
  // 8 ago: *"deve comparire sempre e se non ci sono documenti, dire che non ci
  // sono"*). Prima spariva del tutto quando entrambi i tipi erano vuoti — e
  // una sezione che sparisce non si legge come "nessuna scadenza", si legge
  // come "dov'è finita?", soprattutto ora che archiviare o spegnere i
  // solleciti può svuotarla da un momento all'altro. Dirlo è più tranquillo
  // che non dire niente.

  return (
    <div style={{ margin: '18px 15px 0' }}>
      {/* Titoletto FUORI dalla card, stile Altro */}
      <div className="cc-section-label" style={{ margin: '0 2px 8px' }}>
        In scadenza
      </div>
      {/* ⚠️ Una card PER DOCUMENTO, non una card sola con i divisori dentro.
          Prima erano quattro zone impilate separate da linee: i due blocchi
          hanno per forza forma diversa (chi non ha l'email del cliente non ha
          il bottone Sollecita) e dentro un unico riquadro quella differenza
          sembrava un errore. Separati, sono semplicemente due cose distinte. */}
      {/* ⚠️ Il collegamento sta DENTRO la sua card, come piede col filetto
          (mockup approvato da Eli, 7 ago — proposta A). Prima galleggiava fuori,
          fra una card e l'altra: contandolo, le due card della STESSA sezione
          distavano ~43px, più di quanto disti una sezione dalla successiva, e
          si leggevano come due cose separate. Dentro la card appartiene
          visibilmente al documento a cui si riferisce, e le due card possono
          stare vicine (10px) come si conviene a chi fa parte dello stesso
          gruppo. ⚠️ Il piede è FRATELLO di ScadenzaBlock, non un suo figlio:
          il blocco è cliccabile (apre il documento) e un collegamento dentro
          farebbe partire due navigazioni. */}
      {/* ⚠️ La card resta anche QUANDO NON C'È NULLA in scadenza (Eli, 7 ago):
          senza, la sezione mostrava solo le fatture e sembrava che i preventivi
          fossero spariti. Dire "non ce ne sono" è un'informazione, il vuoto no.
          Il collegamento alla lista resta comunque, perché è la via per andare
          a controllare. */}
      <div style={{ background: '#fff', borderRadius: 14, boxShadow: SH, padding: '14px 16px' }}>
        {preventivo
          ? <ScadenzaBlock doc={preventivo} kind="preventivo" workspaceName={workspaceName} />
          : <VuotoBlock kind="preventivo" />}
        <HomeCardFootLink href="/preventivi/scadenze" label="Preventivi in scadenza" count={prevCount} />
      </div>
      <div style={{ background: '#fff', borderRadius: 14, boxShadow: SH, padding: '14px 16px', marginTop: 10 }}>
        {fattura
          ? <ScadenzaBlock doc={fattura} kind="fattura" workspaceName={workspaceName} />
          : <VuotoBlock kind="fattura" />}
        <HomeCardFootLink href="/fatture/scadenze" label="Fatture in scadenza" count={fattCount} />
      </div>
    </div>
  )
}
