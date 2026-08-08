'use client'

// ============================================================
// «Posticipa il sollecito» (074, Eli 8 ago 2026).
//
// PERCHÉ: *"se un preventivo è in scadenza e lo vedo nella Home ma per il
// momento non voglio mandare il sollecito, voglio poterlo posticipare,
// altrimenti continuo a vedere sempre e solo quello in Home"*.
//
// Cosa fa: il documento sparisce dalla sezione «In scadenza» della Home e dai
// due conteggi fino alla data scelta, poi torna da solo.
//
// ⚠️ Cosa NON fa, ed è scritto anche nell'interfaccia: non tocca la scadenza
// vera del documento e non ha nessun effetto fiscale. Il documento resta in
// tutte le liste — a essere rimandato è il promemoria, non la scadenza.
// ============================================================

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Clock, Loader2, Undo2 } from 'lucide-react'
import { runAction } from '@/lib/run-action'
import { posticipaSollecitoAction, riprendiSollecitoAction } from '@/lib/actions/documents'

const OPZIONI = [
  { giorni: 3,  label: '3 giorni'    },
  { giorni: 7,  label: '1 settimana' },
  { giorni: 14, label: '2 settimane' },
] as const

export function PosticipaSollecito({ documentId, snoozeUntil }: {
  documentId: string
  /** Data del rinvio in corso, se c'è */
  snoozeUntil?: string | null
}) {
  const router = useRouter()
  const [aperto, setAperto] = useState(false)
  // ⚠️ NON un booleano: con un interruttore solo lo spinner si accendeva su
  // TUTTI e tre i tasti insieme (Eli, 8 ago). Qui dentro c'è QUALE azione è in
  // corso — i giorni scelti, oppure 'riprendi' — così la rotella compare sul
  // tasto che hai toccato e gli altri restano fermi (ma disabilitati, perché
  // un secondo tocco durante la scrittura scriverebbe due volte).
  const [attesa, setAttesa] = useState<number | 'riprendi' | null>(null)
  const [errore, setErrore] = useState<string | null>(null)
  const inCorso = attesa !== null

  const rinvioAttivo = !!snoozeUntil && new Date(snoozeUntil).getTime() > Date.now()

  async function posticipa(giorni: number) {
    if (inCorso) return
    setAttesa(giorni)
    setErrore(null)
    const res = await runAction(() => posticipaSollecitoAction(documentId, giorni), 'posticipare il sollecito')
    if (res.error) setErrore(res.error)
    else { setAperto(false); router.refresh() }
    setAttesa(null)
  }

  async function riprendi() {
    if (inCorso) return
    setAttesa('riprendi')
    setErrore(null)
    const res = await runAction(() => riprendiSollecitoAction(documentId), 'riprendere il sollecito')
    if (res.error) setErrore(res.error)
    else router.refresh()
    setAttesa(null)
  }

  const chip: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    border: '1px solid #e3e3e6', borderRadius: 10, background: '#fff',
    color: '#55534b', fontSize: 12.5, fontWeight: 600,
    padding: '7px 11px', cursor: inCorso ? 'default' : 'pointer',
    fontFamily: 'inherit',
  }

  if (rinvioAttivo) {
    const quando = new Date(snoozeUntil!).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', timeZone: 'Europe/Rome' })
    return (
      <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 10 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--cc-muted)' }}>
          <Clock size={14} aria-hidden />
          Sollecito rimandato al <b style={{ color: '#55534b' }}>{quando}</b>
        </span>
        <button type="button" onClick={riprendi} disabled={inCorso} style={{ ...chip, marginLeft: 8, verticalAlign: 'middle' }}>
          {attesa === 'riprendi' ? <Loader2 size={13} className="animate-spin" /> : <Undo2 size={13} />}
          Riprendi
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
              <button key={o.giorni} type="button" onClick={() => posticipa(o.giorni)} disabled={inCorso} style={chip}>
                {attesa === o.giorni ? <Loader2 size={13} className="animate-spin" /> : null}
                {o.label}
              </button>
            ))}
            <button type="button" onClick={() => setAperto(false)} disabled={inCorso} style={{ ...chip, border: 'none', color: 'var(--cc-muted)' }}>
              Annulla
            </button>
          </div>
          <p style={{ fontSize: 11.5, color: 'var(--cc-muted)', margin: '8px 0 0', lineHeight: 1.45 }}>
            La scadenza del documento non cambia: rimandi solo il promemoria.
          </p>
        </div>
      )}
      {errore && <div style={{ marginTop: 6, fontSize: 12, color: '#b05656' }}>{errore}</div>}
    </div>
  )
}
