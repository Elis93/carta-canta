// ── IVA EFFETTIVA PER VOCE — rappresentazione, mai calcolo ──────────────────
//
// La regola unica del 12 set (mockup «Sconto e IVA voce per voce», ok Eli):
// ogni voce delle superfici di LETTURA dichiara la sua aliquota con una
// pillola («IVA 22%»), e sulla voce marcata come bene significativo la
// pillola dice l'aliquota EFFETTIVA dopo lo split del DM 29.12.1999 —
// «22%» quando l'intero bene scivola al 22, «10% + 22%» quando si divide.
// La voce nel documento resta QUELLA VERA (quantità, prezzo, sconto): la
// parte fiscale sta in una riga di dettaglio sotto (`notaBeneSplit`).
//
// ⚠️ QUESTO MODULO NON CALCOLA NIENTE: deriva le etichette DALLO STESSO
// split del motore (`espandiBeniSignificativi`, idempotente), taggando le
// voci con il loro indice e raggruppando le righe prodotte. Per costruzione
// non può divergere dai totali né dall'XML — se domani la formula dello
// split cambia, le pillole cambiano da sole.
//
// Modulo PURO: voci dentro, etichette fuori. Testato.

import {
  espandiBeniSignificativi,
  ALIQUOTA_AGEVOLATA,
  ALIQUOTA_ORDINARIA,
  type VoceSplittabile,
} from './beni-significativi'

export interface IvaVoceInfo {
  /** Etichetta dell'aliquota effettiva: '22%', '10%', '10% + 22%'.
   *  Null in regime forfettario (lì l'IVA non si addebita: nessuna pillola). */
  etichetta: string | null
  /** Dettaglio dello split del bene significativo (imponibili in euro),
   *  solo quando la voce è stata davvero spezzata — serve alla riga grigia. */
  split: { al10: number; al22: number } | null
}

function fmtRate(r: number): string {
  return Number.isInteger(r) ? String(r) : r.toLocaleString('it-IT')
}

function fmtEuro(v: number): string {
  return `€ ${v.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * Per ogni voce (nell'ordine ricevuto): etichetta dell'aliquota effettiva e,
 * per i beni significativi spezzati, il dettaglio delle due quote.
 *
 * ⚠️ Con più proposte va chiamata PER PROPOSTA (come l'espansione): lo split
 * dipende dal rapporto bene/prestazione DENTRO la singola proposta.
 */
export function ivaEffettivaVoci(
  items: VoceSplittabile[],
  fiscalRegime: string | null | undefined,
  vatRateDefault?: number | null,
  reverseCharge?: boolean,
): IvaVoceInfo[] {
  // Forfettario: l'IVA non si addebita. Inversione contabile (081): l'IVA la
  // versa il committente, in fattura non c'è aliquota (natura N6.7) — la
  // pillola «22%» sarebbe una bugia. In entrambi i casi: nessuna pillola,
  // come `riepilogoIva` che per gli stessi casi restituisce [].
  if (fiscalRegime === 'forfettario' || reverseCharge) {
    return items.map(() => ({ etichetta: null, split: null }))
  }
  const vatDef = vatRateDefault ?? ALIQUOTA_ORDINARIA
  type Tagged = VoceSplittabile & { __ccIdx: number }
  const tagged: Tagged[] = items.map((v, i) => ({ ...v, __ccIdx: i }))
  const expanded = espandiBeniSignificativi(tagged, fiscalRegime, vatRateDefault)
  const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100

  return items.map((voce, i) => {
    const rows = expanded.filter((r) => r.__ccIdx === i)
    const etichettaImpostata = `${fmtRate(Number(voce.vat_rate ?? vatDef))}%`
    // Voce non toccata dallo split: l'espansione ripassa lo STESSO oggetto.
    if (rows.length === 0 || (rows.length === 1 && rows[0] === tagged[i])) {
      return { etichetta: etichettaImpostata, split: null }
    }
    // Voce spezzata (o interamente spostata al 22, caso P=0): l'etichetta
    // elenca le aliquote effettive, la più bassa per prima («10% + 22%»).
    const rates = [...new Set(rows.map((r) => Number(r.vat_rate ?? vatDef)))].sort((a, b) => a - b)
    const al10 = round2(rows
      .filter((r) => Number(r.vat_rate ?? vatDef) === ALIQUOTA_AGEVOLATA)
      .reduce((s, r) => s + Number(r.total ?? 0), 0))
    const al22 = round2(rows
      .filter((r) => Number(r.vat_rate ?? vatDef) === ALIQUOTA_ORDINARIA)
      .reduce((s, r) => s + Number(r.total ?? 0), 0))
    return {
      etichetta: rates.map((r) => `${fmtRate(r)}%`).join(' + '),
      split: { al10, al22 },
    }
  })
}

/**
 * La riga grigia di dettaglio sotto la voce del bene significativo — UNA
 * copy sola per tutte le superfici (pagina cliente, PDF, fogli interni,
 * card proposte). Dice DOVE sono finiti i soldi, non rifà i conti.
 */
export function notaBeneSplit(split: { al10: number; al22: number }): string {
  if (split.al10 > 0 && split.al22 > 0) {
    return `Bene significativo: ${fmtEuro(split.al10)} al ${ALIQUOTA_AGEVOLATA}% + ${fmtEuro(split.al22)} al ${ALIQUOTA_ORDINARIA}% (quota eccedente la prestazione)`
  }
  if (split.al22 > 0) {
    return `Bene significativo: quota eccedente la prestazione — per intero al ${ALIQUOTA_ORDINARIA}%`
  }
  return `Bene significativo: ${fmtEuro(split.al10)} al ${ALIQUOTA_AGEVOLATA}%`
}
