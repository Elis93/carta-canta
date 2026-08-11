'use client'

import { useEffect, useRef, useState } from 'react'
import { SpiegaCampo } from '@/components/shared/SpiegaCampo'

// ── Ritenuta d'acconto del CONDOMINIO (081) ─────────────────────────────────
//
// Il condominio è **sostituto d'imposta**: sui corrispettivi per contratti di
// appalto trattiene il 4% e lo versa lui all'Agenzia (art. 25-ter DPR
// 600/1973). L'artigiano incassa 4% in meno, e se in fattura non è scritto la
// telefonata «perché mi hai bonificato di meno?» arriva puntuale.
//
// ⚠️ Un FORFETTARIO è ESENTE (art. 1, comma 67, L. 190/2014): a lui questa
// spunta non si mostra, e il suo PDF porta già la dicitura di esenzione — che
// serve proprio a impedire al condominio di trattenere per sbaglio.
//
// ⚠️ 4% e 11% NON si cumulano: se il pagamento arriva con bonifico parlante
// (lavori agevolati), la banca opera l'11% e il condominio NON applica il 4%
// (circ. AdE 40/E/2010). È scritto nel ⓘ perché è il caso in cui l'artigiano
// rischia di vedersi trattenere due volte.

export function RitenutaCondominio({
  defaultPct,
  defaultCausale,
  onChange,
}: {
  /** Percentuale già salvata sul documento (0/null = nessuna ritenuta). */
  defaultPct?: number | null
  /** Causale del tracciato FatturaPA già salvata ('W' per l'appalto). */
  defaultCausale?: string | null
  /** Avvisa il form della percentuale scelta, così il riepilogo la mostra
   *  mentre si scrive invece che solo dopo il salvataggio. */
  onChange?: (pct: number) => void
}) {
  const [attiva, setAttiva] = useState((defaultPct ?? 0) > 0)
  const wrapRef = useRef<HTMLDivElement>(null)
  const boxRef = useRef<HTMLInputElement>(null)
  // Lo stato corrente letto dentro il gestore del reset: senza il ref, il
  // gestore registrato al primo render vedrebbe per sempre il valore iniziale.
  const attivaRef = useRef(attiva)
  attivaRef.current = attiva
  // Il form parte già allineato quando si riapre una fattura con la ritenuta.
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  useEffect(() => { onChangeRef.current?.(attiva ? 4 : 0) }, [])

  // ⚠️ React 19 chiama `form.reset()` dopo OGNI submit di una Server Action:
  // su un campo governato dallo stato il reset riporta il DOM al valore
  // iniziale SENZA far ri-renderizzare React, e la spunta «torna indietro da
  // sola». È il difetto già visto sulla tendina dell'acconto (9 ago) e
  // sull'interruttore della trasmissione automatica (11 ago) — regola §B.2:
  // ogni campo controllato dentro un form con Server Action ha bisogno di
  // questo ascoltatore.
  useEffect(() => {
    const form = wrapRef.current?.closest('form')
    if (!form) return
    // Il reset del DOM avviene DOPO l'evento: si rimette la spunta al giro
    // successivo. Si scrive sul nodo, non nello stato — lo stato è già
    // quello giusto, ed è il DOM ad essere stato riportato indietro.
    const onReset = () => {
      requestAnimationFrame(() => {
        if (boxRef.current) boxRef.current.checked = attivaRef.current
      })
    }
    form.addEventListener('reset', onReset)
    return () => form.removeEventListener('reset', onReset)
  }, [])

  return (
    <div ref={wrapRef} style={{ marginTop: 14 }}>
      <input type="hidden" name="ritenuta_pct" value={attiva ? '4' : ''} />
      <input type="hidden" name="ritenuta_causale" value={attiva ? (defaultCausale || 'W') : ''} />
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
        <input
          ref={boxRef}
          type="checkbox"
          checked={attiva}
          onChange={(e) => { setAttiva(e.target.checked); onChange?.(e.target.checked ? 4 : 0) }}
          style={{ width: 18, height: 18, marginTop: 1, flexShrink: 0, accentColor: '#1a1a2e' }}
        />
        <span style={{ fontSize: 14, color: '#1a1a2e', lineHeight: 1.35 }}>
          Il cliente è un <b>condominio</b>: trattiene la ritenuta del 4%
        </span>
      </label>
      <div style={{ marginLeft: 28, marginTop: 5 }}>
        <SpiegaCampo etichetta="Cosa cambia in fattura" style={{ fontSize: 12, color: 'var(--cc-muted)' }}>
          L’amministratore non ti paga tutto: trattiene il 4% dell’imponibile e
          lo versa lui all’Agenzia per conto tuo, come acconto sulle tue tasse.
          {' '}Non è un costo — te lo ritrovi come credito nella dichiarazione.
          <br /><br />
          Spuntando la casella la fattura mostra la trattenuta e il totale da
          bonificare, così tu e l’amministratore vedete la stessa cifra.
          <br /><br />
          <b>Attenzione:</b> se il condominio paga con <b>bonifico parlante</b>
          {' '}per un lavoro agevolato, la banca trattiene già l’11% e il 4%
          {' '}<b>non</b> si applica — le due ritenute non si sommano mai.
        </SpiegaCampo>
      </div>
    </div>
  )
}
