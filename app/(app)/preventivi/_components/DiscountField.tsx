'use client'

// ============================================================
// DiscountField — lo sconto di documento, compatto e su una riga.
//
// PERCHÉ (Eli 15 ago, #3): il riepilogo doveva mostrare «Subtotale → poi la
// possibilità di inserire uno sconto a mano → poi imponibile, IVA, totale», e
// lo sconto occupava troppo spazio (un blocco con DUE campi etichettati «% ed
// €» in cima alla card). Ora è UN solo campo con un interruttore %/€, sulla
// riga tra Subtotale e Imponibile.
//
// ⚠️ Il MOTORE resta intatto (regola F): applica sia `discount_pct` sia
// `discount_fixed` (`subtotale × (1−%) − €`). Perciò NON si perde mai un
// valore: l'interruttore cambia solo QUALE campo modifichi; l'altro resta in
// stato e viene comunque inviato (input nascosto). Un documento vecchio con
// entrambi impostati non cambia totale.
// ============================================================

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { CampoConUnita, CAMPO_UNITA_INPUT } from '@/components/shared/CampoConUnita'

// L'unità %/€ è la PILLOLA-TENDINA dentro il campo (CampoConUnita, proposta C
// del mockup «Stato, sconto e acconto» — scelta di Eli, 9 set 2026): stesso
// schema dell'unità di misura nella Quantità della voce. Prima qui c'era la
// striscia grigia con due mini-pillole 32×30, un controllo diverso da quello
// dell'Acconto per la stessa identica scelta.

export function DiscountField({
  pct, setPct, fixed, setFixed, open, setOpen, error, onDirty,
}: {
  pct: string
  setPct: (v: string) => void
  fixed: string
  setFixed: (v: string) => void
  open: boolean
  setOpen: (v: boolean) => void
  error?: string | null
  /** Segnala al form che c'è una modifica non salvata (solo dove serve). */
  onDirty?: () => void
}) {
  // Modo iniziale: € solo se c'è un fisso e NON una percentuale; altrimenti %.
  const [mode, setMode] = useState<'pct' | 'fixed'>(
    Number(fixed) > 0 && !(Number(pct) > 0) ? 'fixed' : 'pct',
  )

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 14, fontWeight: 500, color: 'var(--cc-navy)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
      >
        <Plus size={14} /> Aggiungi sconto
      </button>
    )
  }

  const value = mode === 'pct' ? pct : fixed
  const setValue = (v: string) => { (mode === 'pct' ? setPct : setFixed)(v); onDirty?.() }

  // ⚠️ Cambiare %↔€ SPOSTA il valore nel modo nuovo e svuota l'altro (Eli,
  // 20 ago: «inserisco 10 e cambio da % a €, i valori non si aggiornano nel
  // riepilogo»). Prima l'interruttore cambiava solo QUALE campo modifichi:
  // il 10% restava vivo in stato — e applicato dal motore — mentre il campo
  // mostrava il fisso vuoto: riepilogo e margine sembravano fermi. Il campo
  // ora mostra sempre esattamente lo sconto che verrà applicato.
  function switchMode(m: 'pct' | 'fixed') {
    if (m === mode) return
    let v = mode === 'pct' ? pct : fixed
    if (m === 'pct' && Number(v) > 100) v = '100'  // una % oltre 100 non esiste
    if (m === 'pct') { setPct(v); setFixed('') } else { setFixed(v); setPct('') }
    setMode(m)
    onDirty?.()
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--cc-text)' }}>Sconto</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
          <CampoConUnita
            unita={mode === 'pct' ? '%' : '€'}
            onUnitaChange={(u) => switchMode(u === '%' ? 'pct' : 'fixed')}
            ariaLabelUnita="Unità dello sconto: percentuale o euro"
          >
            {/* Campo valore — solo il modo attivo ha il name di submit; l'altro
                valore resta in un input nascosto, così non si perde mai. */}
            <input
              name={mode === 'pct' ? 'discount_pct' : 'discount_fixed'}
              type="number"
              min="0"
              max={mode === 'pct' ? '100' : undefined}
              step="0.01"
              inputMode="decimal"
              placeholder={mode === 'pct' ? '0' : '0,00'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => { if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault() }}
              style={{ ...CAMPO_UNITA_INPUT, width: 72 }}
              aria-label={mode === 'pct' ? 'Sconto in percentuale' : 'Sconto in euro'}
            />
          </CampoConUnita>
          <input type="hidden" name={mode === 'pct' ? 'discount_fixed' : 'discount_pct'} value={mode === 'pct' ? fixed : pct} />
          <button
            type="button"
            onClick={() => { setPct(''); setFixed(''); setOpen(false); onDirty?.() }}
            aria-label="Rimuovi sconto"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--cc-text-3)', padding: 4 }}
          >
            <X size={16} />
          </button>
        </div>
      </div>
      {error && (
        <p className="text-sm text-destructive" role="alert" style={{ marginTop: 6 }}>{error}</p>
      )}
    </div>
  )
}
