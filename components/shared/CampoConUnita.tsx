'use client'

// ============================================================
// CampoConUnita — IL controllo %/€ dell'app (proposta C del mockup «Stato,
// sconto e acconto», scelta di Eli il 9 set 2026): un riquadro unico alto 44
// col valore a sinistra e la PILLOLA-TENDINA dell'unità dentro il campo a
// destra — lo stesso schema dell'unità di misura nella Quantità della voce
// (approvato l'8 set). Il tocco sulla pillola apre la scelta % / €.
//
// PERCHÉ: per la stessa scelta %/€ esistevano DUE controlli diversi (striscia
// grigia con mini-pillole 32×30 nello Sconto · pillola tonda 110px
// nell'Acconto) con misure scoordinate e l'attiva «bianca in rilievo» che si
// leggeva poco. Ora il controllo è UNO, qui: Sconto nel Riepilogo, Acconto
// del preventivo e campo gemello in Impostazioni › Generale.
//
// Il CAMPO lo passa il chiamante come children (ognuno ha il suo input, coi
// suoi name/ref/sanitizzazioni): deve essere SENZA bordo — il bordo è del
// riquadro. La Select è quella vera di shadcn vestita da pillola (mai testo
// finto: tastiera e screen reader gratis), come nella Quantità.
// ============================================================

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export type Unita = '%' | '€'

/** Stile-base per l'input dentro il riquadro: il chiamante lo estende. */
export const CAMPO_UNITA_INPUT: React.CSSProperties = {
  width: 56, height: '100%', boxSizing: 'border-box', textAlign: 'right',
  border: 'none', outline: 'none', padding: '0 4px 0 12px', fontSize: 16,
  fontWeight: 500, background: 'transparent', fontFamily: 'inherit', minWidth: 0,
}

export function CampoConUnita({
  unita,
  onUnitaChange,
  ariaLabelUnita,
  children,
  style,
}: {
  unita: Unita
  onUnitaChange: (u: Unita) => void
  /** Es. «Unità dello sconto: percentuale o euro». */
  ariaLabelUnita: string
  /** L'input del valore (senza bordo: il bordo è del riquadro). */
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: '1px solid #e3e3e6', borderRadius: 11, background: '#fff', height: 44, padding: '0 5px 0 0', boxSizing: 'border-box', ...style }}>
      {children}
      <Select value={unita} onValueChange={(v) => onUnitaChange(v as Unita)}>
        <SelectTrigger
          aria-label={ariaLabelUnita}
          style={{ height: 32, minHeight: 32, borderRadius: 8, border: '1px solid #e6e1d5', background: '#f4f3ef', padding: '0 7px 0 9px', fontSize: 13, fontWeight: 600, color: '#55534b', gap: 3, boxShadow: 'none', flexShrink: 0 }}
        >
          <SelectValue />
        </SelectTrigger>
        {/* Tendina SU MISURA (proposta A del mockup «Tendina dell'unità»,
            scelta di Eli l'11 set): il pannello standard di shadcn ha
            min-w-36 (144px) e la spunta assoluta a destra — per due voci da
            un carattere usciva un pannello largo sette volte il contenuto.
            Qui: largo quanto la pillola, sotto di lei allineato a destra,
            voci centrate, l'unità IN USO in navy, niente spunta (il colore
            dice già qual è). ⚠️ Lo stato attivo è dato con lo STILE INLINE
            calcolato da `unita` (non con data-[state=checked]): Radix mette
            il fuoco sulla voce selezionata all'apertura e il focus:bg-accent
            della classe base coprirebbe il navy — l'inline vince sempre. */}
        <SelectContent
          position="popper"
          side="bottom"
          align="end"
          // La classe base aggiunge già translate-y-1 (4px) in popper → 5px totali come il mockup.
          sideOffset={1}
          className="min-w-0 p-1"
          style={{ width: 46, borderRadius: 10, border: '1px solid #e6e1d5', boxShadow: '0 6px 18px -6px rgba(20,20,40,.22)' }}
        >
          {/* ⚠️ Il BIANCO della voce attiva è la classe `**:text-white!`, non un
              color inline: la classe base di SelectItem ha
              focus:**:text-accent-foreground, che al fuoco (Radix lo mette
              proprio sulla voce selezionata all'apertura) colora DIRETTAMENTE
              lo span del testo — e una classe sul figlio vince sul colore
              EREDITATO dalla voce, inline compreso. Risultato visto da Eli
              l'11 set: «%» navy su fondo navy, illeggibile. L'important della
              classe discendente vince sempre. NON spostare il colore su uno
              span inline dentro la voce: SelectValue rende una copia dei figli
              dell'ItemText e la pillola del trigger diventerebbe bianca su
              beige — le classi della voce invece NON viaggiano nel trigger. */}
          {(['%', '€'] as const).map((u, i) => (
            <SelectItem
              key={u}
              value={u}
              className={
                'h-9 justify-center p-0 rounded-[7px] text-[15px] [&>span:first-child]:hidden'
                + (u === unita ? ' **:text-white!' : '')
              }
              style={u === unita
                ? { background: '#1a1a2e', color: '#fff', fontWeight: 600, marginTop: i > 0 ? 3 : 0 }
                : { color: '#55534b', fontWeight: 600, marginTop: i > 0 ? 3 : 0 }}
            >
              {u}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
