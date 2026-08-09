'use client'

// ============================================================
// Acconto proposto sui NUOVI preventivi (077) — campo delle Impostazioni.
//
// PERCHÉ È UN COMPONENTE A SÉ (Eli, 9 ago): *"le selezioni non si vedono per
// intero: «percentuale del totale» è troncato… e poi se seleziono importo
// fisso, cosa significa? affianco c'è la possibilità di inserire un numero
// ma cos'è?"*.
//
// Tre correzioni, tutte alla stessa domanda «che cosa sto scrivendo qui»:
//  1. la tendina sta su una RIGA TUTTA SUA e le voci sono CORTE — accanto a un
//     campo numerico «Percentuale del totale» veniva tagliata a metà parola, e
//     misurando si vede che non ci sta comunque a 320px in «Testo grande». Il
//     dettaglio («percentuale di che cosa») sta nel punto ⓘ, che ha spazio;
//  2. il campo del valore porta l'unità VISIBILE — **%** o **€** — che cambia
//     con la scelta: senza, quel numero non ha significato;
//  3. scegliendo «Nessuno» il campo del valore sparisce, invece di restare lì
//     a chiedere un numero che non serve a niente.
// ============================================================

import { useState } from 'react'

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

  const unita = tipo === 'percent' ? '%' : '€'
  const esempio = tipo === 'percent' ? '30' : '500'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <select
        id="deposit_default_type"
        name="deposit_default_type"
        value={tipo}
        onChange={(e) => setTipo(e.target.value)}
        style={{ ...fieldStyle, width: '100%' }}
      >
        <option value="">Nessun acconto</option>
        <option value="percent">Una percentuale</option>
        <option value="fixed">Una cifra fissa</option>
      </select>

      {tipo !== '' && (
        <div style={{ position: 'relative' }}>
          <input
            id="deposit_default_value"
            name="deposit_default_value"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            placeholder={esempio}
            defaultValue={valoreIniziale ?? ''}
            aria-label={tipo === 'percent' ? 'Percentuale dell’acconto' : 'Importo dell’acconto in euro'}
            style={{ ...fieldStyle, width: '100%', paddingRight: 44 }}
          />
          <span
            aria-hidden
            style={{
              position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
              fontSize: 15, fontWeight: 600, color: 'var(--cc-muted)', pointerEvents: 'none',
            }}
          >
            {unita}
          </span>
        </div>
      )}

      {/* Con «Nessuno» il valore non deve restare scritto nel database:
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
