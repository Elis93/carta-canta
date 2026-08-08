'use client'

// ============================================================
// «Posticipa il sollecito» (074) + «Non ricordarmelo più» e «Archivia» (075).
//
// PERCHÉ: *"se un preventivo è in scadenza e lo vedo nella Home ma per il
// momento non voglio mandare il sollecito, voglio poterlo posticipare,
// altrimenti continuo a vedere sempre e solo quello in Home"* (Eli, 8 ago) e,
// subito dopo, *"aggiungiamo anche l'opzione per non sollecitare più, e
// archiviare il documento"*.
//
// Le tre cose stanno insieme perché nascono dallo stesso momento — «questo
// documento non è roba di oggi» — ma fanno tre cose diverse, e l'interfaccia lo
// dice:
//   • RIMANDA di 3 giorni / 1 settimana / 2 settimane → torna da solo.
//   • NON RICORDARMELO PIÙ → resta in tutte le liste, ma non avvisa più.
//   • ARCHIVIA → esce dalle liste attive e va dietro il tasto «Archivio».
//
// ⚠️ Nessuna delle tre tocca la scadenza vera del documento e nessuna ha
// effetti fiscali: archiviare NON è cancellare — il documento resta nel
// Bilancio, negli export e nel registro fatture.
// ============================================================

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Clock, Loader2, Undo2, BellOff, Archive } from 'lucide-react'
import { runAction } from '@/lib/run-action'
import {
  posticipaSollecitoAction,
  riprendiSollecitoAction,
  spegniSollecitiAction,
  riattivaSollecitiAction,
  archiviaDocumentoAction,
} from '@/lib/actions/documents'

const OPZIONI = [
  { giorni: 3,  label: '3 giorni'    },
  { giorni: 7,  label: '1 settimana' },
  { giorni: 14, label: '2 settimane' },
] as const

type Attesa = number | 'riprendi' | 'spegni' | 'riattiva' | 'archivia' | null

export function PosticipaSollecito({ documentId, snoozeUntil, remindersOff, docType = 'preventivo' }: {
  documentId: string
  /** Data del rinvio in corso, se c'è */
  snoozeUntil?: string | null
  /** true = solleciti spenti per sempre su questo documento */
  remindersOff?: boolean
  docType?: 'preventivo' | 'fattura'
}) {
  const router = useRouter()
  const [aperto, setAperto] = useState(false)
  // ⚠️ NON un booleano: con un interruttore solo lo spinner si accendeva su
  // TUTTI i tasti insieme (Eli, 8 ago). Qui dentro c'è QUALE azione è in
  // corso, così la rotella compare sul tasto che hai toccato e gli altri
  // restano fermi (ma disabilitati, perché un secondo tocco durante la
  // scrittura scriverebbe due volte).
  const [attesa, setAttesa] = useState<Attesa>(null)
  const [errore, setErrore] = useState<string | null>(null)
  const inCorso = attesa !== null

  const nome = docType === 'fattura' ? 'la fattura' : 'il preventivo'
  const rinvioAttivo = !!snoozeUntil && new Date(snoozeUntil).getTime() > Date.now()

  async function esegui(quale: Exclude<Attesa, null>, fn: () => Promise<{ error?: string }>, cosa: string, ok?: string) {
    if (inCorso) return
    setAttesa(quale)
    setErrore(null)
    const res = await runAction(fn, cosa)
    if (res.error) setErrore(res.error)
    else {
      setAperto(false)
      if (ok) toast.success(ok)
      router.refresh()
    }
    setAttesa(null)
  }

  const chip: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    border: '1px solid #e3e3e6', borderRadius: 10, background: '#fff',
    color: '#55534b', fontSize: 12.5, fontWeight: 600,
    padding: '7px 11px', cursor: inCorso ? 'default' : 'pointer',
    fontFamily: 'inherit',
  }

  // ── Rinvio a tempo in corso ──────────────────────────────────────────────
  if (rinvioAttivo) {
    const quando = new Date(snoozeUntil!).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', timeZone: 'Europe/Rome' })
    return (
      <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 10 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--cc-muted)' }}>
          <Clock size={14} aria-hidden />
          Sollecito rimandato al <b style={{ color: '#55534b' }}>{quando}</b>
        </span>
        <button
          type="button"
          onClick={() => esegui('riprendi', () => riprendiSollecitoAction(documentId), 'riprendere il sollecito')}
          disabled={inCorso}
          style={{ ...chip, marginLeft: 8, verticalAlign: 'middle' }}
        >
          {attesa === 'riprendi' ? <Loader2 size={13} className="animate-spin" /> : <Undo2 size={13} />}
          Riprendi
        </button>
        {errore && <div style={{ marginTop: 6, fontSize: 12, color: '#b05656' }}>{errore}</div>}
      </div>
    )
  }

  // ── Solleciti spenti per sempre ──────────────────────────────────────────
  if (remindersOff) {
    return (
      <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 10 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--cc-muted)' }}>
          <BellOff size={14} aria-hidden />
          Non te lo ricordo più
        </span>
        <button
          type="button"
          onClick={() => esegui('riattiva', () => riattivaSollecitiAction(documentId), 'riattivare i solleciti')}
          disabled={inCorso}
          style={{ ...chip, marginLeft: 8, verticalAlign: 'middle' }}
        >
          {attesa === 'riattiva' ? <Loader2 size={13} className="animate-spin" /> : <Undo2 size={13} />}
          Riattiva i promemoria
        </button>
        {errore && <div style={{ marginTop: 6, fontSize: 12, color: '#b05656' }}>{errore}</div>}
      </div>
    )
  }

  return (
    <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 10 }}>
      {!aperto ? (
        <button type="button" onClick={() => setAperto(true)} style={chip}>
          <Clock size={14} aria-hidden />
          Posticipa il sollecito
        </button>
      ) : (
        <div>
          <div style={{ fontSize: 12, color: 'var(--cc-muted)', marginBottom: 7 }}>
            Non farmelo più vedere in Home per…
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {OPZIONI.map((o) => (
              <button
                key={o.giorni}
                type="button"
                onClick={() => esegui(o.giorni, () => posticipaSollecitoAction(documentId, o.giorni), 'posticipare il sollecito')}
                disabled={inCorso}
                style={chip}
              >
                {attesa === o.giorni ? <Loader2 size={13} className="animate-spin" /> : null}
                {o.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => esegui('spegni', () => spegniSollecitiAction(documentId), 'spegnere i solleciti')}
              disabled={inCorso}
              style={chip}
            >
              {attesa === 'spegni' ? <Loader2 size={13} className="animate-spin" /> : <BellOff size={13} />}
              Non ricordarmelo più
            </button>
            <button
              type="button"
              onClick={() => setAperto(false)}
              disabled={inCorso}
              style={{ ...chip, border: 'none', color: 'var(--cc-muted)' }}
            >
              Annulla
            </button>
          </div>
          <p style={{ fontSize: 11.5, color: 'var(--cc-muted)', margin: '8px 0 0', lineHeight: 1.45 }}>
            La scadenza del documento non cambia: rimandi solo il promemoria.
          </p>

          {/* Archiviare è un'altra cosa dal rimandare: sta sotto un filetto, con
              scritto cosa comporta. Senza quella riga «Archivia» si legge come
              un modo gentile di dire «Elimina» — e non lo è. */}
          <div style={{ borderTop: '0.5px solid #eee', margin: '10px 0 0', paddingTop: 10 }}>
            <button
              type="button"
              onClick={() => esegui(
                'archivia',
                () => archiviaDocumentoAction(documentId),
                'archiviare il documento',
                docType === 'fattura' ? 'Fattura archiviata' : 'Preventivo archiviato',
              )}
              disabled={inCorso}
              style={chip}
            >
              {attesa === 'archivia' ? <Loader2 size={13} className="animate-spin" /> : <Archive size={13} />}
              Archivia {nome}
            </button>
            <p style={{ fontSize: 11.5, color: 'var(--cc-muted)', margin: '7px 0 0', lineHeight: 1.45 }}>
              Esce da questa lista e {docType === 'fattura' ? 'la trovi' : 'lo trovi'} in{' '}
              <b style={{ color: '#55534b', fontWeight: 600 }}>
                {docType === 'fattura' ? 'Fatture › Archivio' : 'Preventivi › Archivio'}
              </b>.{' '}
              Non viene {docType === 'fattura' ? 'cancellata' : 'cancellato'}: resta nel Bilancio e nei conti.
            </p>
          </div>
        </div>
      )}
      {errore && <div style={{ marginTop: 6, fontSize: 12, color: '#b05656' }}>{errore}</div>}
    </div>
  )
}
