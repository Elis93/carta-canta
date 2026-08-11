'use client'

import { useEffect, useRef, useState } from 'react'
import { SpiegaCampo } from '@/components/shared/SpiegaCampo'

// ── Inversione contabile in EDILIZIA (081) ──────────────────────────────────
//
// Art. 17, comma 6, lett. a-ter DPR 633/1972: fra soggetti IVA, per pulizia,
// demolizione, installazione di impianti e completamento relativi a EDIFICI,
// la fattura si emette SENZA IVA — l'imposta la assolve il committente.
// Non serve un subappalto (quella è la lett. a): basta che il committente sia
// un soggetto IVA.
//
// ⚠️ Un FORFETTARIO non applica MAI il reverse charge in USCITA: le sue
// operazioni restano fuori campo con natura N2.2. Per questo la spunta non
// gli si mostra.
//
// ⚠️ PERCHÉ LA SCELTA È MANUALE E NON DEDOTTA DALL'ATECO. La prassi
// dell'Agenzia (circ. 14/E/2015) mappa il reverse charge sui codici ATECO
// 2007, ma dal 2025 la classificazione è cambiata e quella mappatura non è
// stata aggiornata. Dedurre il regime da un codice che non corrisponde più
// significherebbe togliere l'IVA a una fattura che la deve avere — o il
// contrario. Meglio una spunta consapevole che un automatismo che sbaglia.

export function ReverseCharge({
  defaultAttivo,
  onChange,
}: {
  defaultAttivo?: boolean | null
  /** Avvisa il form, così il riepilogo azzera l'IVA mentre si scrive. */
  onChange?: (attivo: boolean) => void
}) {
  const [attivo, setAttivo] = useState(defaultAttivo === true)
  const wrapRef = useRef<HTMLDivElement>(null)
  const boxRef = useRef<HTMLInputElement>(null)
  const attivoRef = useRef(attivo)
  attivoRef.current = attivo
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  useEffect(() => { onChangeRef.current?.(attivo) }, [])

  // ⚠️ React 19 chiama `form.reset()` dopo ogni submit di una Server Action e
  // riporta il DOM al valore iniziale senza far ri-renderizzare React: senza
  // questo ascoltatore la spunta «tornerebbe indietro da sola» (regola §B.2).
  useEffect(() => {
    const form = wrapRef.current?.closest('form')
    if (!form) return
    const onReset = () => {
      requestAnimationFrame(() => {
        if (boxRef.current) boxRef.current.checked = attivoRef.current
      })
    }
    form.addEventListener('reset', onReset)
    return () => form.removeEventListener('reset', onReset)
  }, [])

  return (
    <div ref={wrapRef} style={{ marginTop: 12 }}>
      <input type="hidden" name="reverse_charge" value={attivo ? 'on' : ''} />
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
        <input
          ref={boxRef}
          type="checkbox"
          checked={attivo}
          onChange={(e) => { setAttivo(e.target.checked); onChange?.(e.target.checked) }}
          style={{ width: 18, height: 18, marginTop: 1, flexShrink: 0, accentColor: '#1a1a2e' }}
        />
        <span style={{ fontSize: 14, color: '#1a1a2e', lineHeight: 1.35 }}>
          Lavoro edile per un’altra <b>impresa o professionista</b>: fattura senza IVA
          {' '}(inversione contabile)
        </span>
      </label>
      <div style={{ marginLeft: 28, marginTop: 5 }}>
        <SpiegaCampo etichetta="Quando si usa" style={{ fontSize: 12, color: 'var(--cc-muted)' }}>
          Vale per pulizia, demolizione, installazione di impianti e
          completamento <b>su edifici</b>, quando il cliente è a sua volta
          {' '}<b>titolare di partita IVA</b>. In quel caso non addebiti l’IVA:
          la versa lui.
          <br /><br />
          Serve la partita IVA del cliente in rubrica. Se il cliente è un
          {' '}<b>privato</b> — anche per lo stesso lavoro — l’IVA va addebitata
          normalmente e questa casella non va spuntata.
          <br /><br />
          Non serve essere in subappalto: basta che il committente sia un
          soggetto IVA. Nel dubbio su un lavoro specifico, chiedi al tuo
          commercialista: qui l’app fa quello che le dici, non indovina.
        </SpiegaCampo>
      </div>
      {attivo && (
        <div style={{
          marginLeft: 28, marginTop: 8, borderRadius: 10, padding: '9px 11px',
          background: '#fdf6e7', color: '#8a6d1f', fontSize: 12.5, lineHeight: 1.4,
        }}>
          La fattura uscirà <b>senza IVA</b>, con la dicitura «inversione contabile».
          {' '}Sopra 77,47 € porta la <b>marca da bollo di 2 €</b>, come tutte le
          fatture senza imposta.
        </div>
      )}
    </div>
  )
}
