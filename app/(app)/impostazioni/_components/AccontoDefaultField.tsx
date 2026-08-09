'use client'

// ============================================================
// Acconto proposto sui NUOVI preventivi (077) — campo delle Impostazioni.
//
// PERCHÉ È UN COMPONENTE A SÉ (Eli, 9 ago): *"le selezioni non si vedono per
// intero… e poi se seleziono importo fisso, cosa significa? affianco c'è la
// possibilità di inserire un numero ma cos'è?"*.
//
//  1. le voci della tendina sono CORTE («Percentuale» / «Cifra fissa»): la
//     dicitura lunga non ci stava nemmeno su una riga intera a 320px in
//     «Testo grande» — misurato, non stimato;
//  2. l'unità sta ALLA DESTRA del campo (**%** o **€**) e cambia con la
//     scelta: senza, quel numero non ha significato;
//  3. con «Nessun acconto» il campo del valore sparisce, invece di restare lì
//     a chiedere un numero che non serve.
//
// ⚠️ REACT 19 CHIAMA `form.reset()` DOPO OGNI SUBMIT (è annotato anche più su,
// in questo tab, per il file del logo). Su un campo governato dallo stato il
// reset riporta il DOM al valore iniziale SENZA che React se ne accorga: non
// cambiando nessuno stato non c'è un nuovo render che lo rimetta a posto, e
// la tendina «tornava da sola su Nessun acconto» pur avendo salvato bene
// (Eli, 9 ago). Il componente si difende da solo: ascolta l'evento `reset`
// del proprio form e rimette i valori scelti.
// ============================================================

import { useEffect, useRef, useState } from 'react'

export function AccontoDefaultField({
  tipoIniziale,
  valoreIniziale,
  fieldStyle,
}: {
  tipoIniziale: string | null
  valoreIniziale: number | null
  fieldStyle: React.CSSProperties
}) {
  const [tipo, setTipo] = useState(tipoIniziale ?? '')
  const [valore, setValore] = useState(valoreIniziale != null ? String(valoreIniziale) : '')

  const selRef = useRef<HTMLSelectElement>(null)
  const valRef = useRef<HTMLInputElement>(null)
  // I valori correnti in un ref: così l'ascoltatore si aggancia UNA volta
  // sola e legge sempre l'ultimo valore, senza riagganciarsi a ogni tasto.
  const correnti = useRef({ tipo, valore })
  correnti.current = { tipo, valore }

  useEffect(() => {
    const form = selRef.current?.form
    if (!form) return
    const onReset = () => {
      // Il reset svuota i campi DOPO l'evento: si rimette a posto al giro dopo.
      requestAnimationFrame(() => {
        if (selRef.current) selRef.current.value = correnti.current.tipo
        if (valRef.current) valRef.current.value = correnti.current.valore
      })
    }
    form.addEventListener('reset', onReset)
    return () => form.removeEventListener('reset', onReset)
  }, [])

  const unita = tipo === 'percent' ? '%' : '€'
  const esempio = tipo === 'percent' ? '30' : '500'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* ⚠️ Tendina e valore AFFIANCATI (Eli, 9 ago: *"percentuale non è
          affianco alla scelta ma è ancora sotto"*), con `flexWrap`: quando non
          ci stanno — schermo stretto o «Testo grande» — il valore scende su una
          riga propria invece di far troncare la tendina. Misurato: con la base
          a 185px la tendina non si tronca in nessuna delle 6 combinazioni di
          larghezza e zoom, e restano affiancati nei casi normali. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <select
        ref={selRef}
        id="deposit_default_type"
        name="deposit_default_type"
        value={tipo}
        onChange={(e) => setTipo(e.target.value)}
        style={{ ...fieldStyle, flex: '1 1 185px', minWidth: 0 }}
      >
        <option value="">Nessun acconto</option>
        <option value="percent">Percentuale</option>
        <option value="fixed">Cifra fissa</option>
      </select>

      {tipo !== '' && (
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 110px', minWidth: 0 }}>
          <input
            ref={valRef}
            id="deposit_default_value"
            name="deposit_default_value"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            placeholder={esempio}
            value={valore}
            onChange={(e) => setValore(e.target.value)}
            aria-label={tipo === 'percent' ? 'Percentuale dell’acconto' : 'Importo dell’acconto in euro'}
            style={{ ...fieldStyle, flex: 1, minWidth: 0 }}
          />
          <span
            aria-hidden
            style={{ fontSize: 17, fontWeight: 700, color: '#55534b', flexShrink: 0, width: 18, textAlign: 'center' }}
          >
            {unita}
          </span>
        </span>
      )}
      </div>

      {/* Con «Nessun acconto» il valore non deve restare scritto nel database:
          senza questo campo nascosto il form non manderebbe nulla e la
          colonna terrebbe il vecchio importo insieme a un tipo vuoto. */}
      {tipo === '' && <input type="hidden" name="deposit_default_value" value="" />}

      {tipo === 'fixed' && (
        <p style={{ fontSize: 12.5, color: '#8a6a2f', background: '#f5e9d0', borderRadius: 10, padding: '9px 11px', margin: 0, lineHeight: 1.45 }}>
          Su un preventivo più piccolo della cifra fissa, l&rsquo;acconto{' '}
          <b>si ferma al totale</b>: con 500&nbsp;€ di acconto su un preventivo da
          300&nbsp;€, al cliente vengono chiesti 300&nbsp;€ e il saldo è zero. Non gli
          verrà mai chiesto più del dovuto.
        </p>
      )}
    </div>
  )
}
