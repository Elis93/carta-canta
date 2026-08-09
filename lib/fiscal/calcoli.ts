// ============================================================
// CARTA CANTA — Motore Fiscale
// Implementazione completa arriva allo Step 6.
// Qui le costanti e l'arrotondamento base.
// ============================================================

import type { FiscalOptions, FiscalResult } from '@/types/index'
import type { Database } from '@/types/database'

type DocumentItemRow = Database['public']['Tables']['document_items']['Row']

// ── ARROTONDAMENTO ────────────────────────────────────────────
// Round half up — MAI toFixed() — MAI banker's rounding
export function roundFiscale(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

// ── STRINGA LEGALE FORFETTARIO ────────────────────────────────
// Non modificabile — obbligatoria per legge IT
export const FORFETTARIO_LEGAL_NOTICE =
  "Operazione effettuata ai sensi dell'art. 1, commi 54-89, L. 190/2014 " +
  '(Regime Forfettario) – Operazione fuori campo IVA ai sensi del comma 58, ' +
  "lettera a), del medesimo articolo"

// ── ALIQUOTE IVA DISPONIBILI ──────────────────────────────────
export const VAT_RATES = [
  { value: 22, label: '22% — Standard' },
  { value: 10, label: '10% — Ristrutturazioni su abitazioni' },
  { value: 5,  label: '5% — Servizi sociali' },
  { value: 4,  label: '4% — Prima necessità' },
  { value: 0,  label: '0% — Esente' },
] as const

// ── CALCOLO DOCUMENTO ─────────────────────────────────────────
// Ordine OBBLIGATORIO per conformità legge IT
export function calcolaDocumento(
  items: DocumentItemRow[],
  opts: FiscalOptions
): FiscalResult {
  // 1. Totale per voce
  const itemTotals = items.map((item) => ({
    ...item,
    total: roundFiscale(
      item.quantity * item.unit_price * (1 - ((item.discount_pct ?? 0) / 100))
    ),
  }))

  // 2. Subtotale
  const subtotal = roundFiscale(itemTotals.reduce((s, i) => s + i.total, 0))

  // 3. Sconto globale
  // Mai negativo: uno sconto (% e/o fisso) che superi il subtotale azzera
  // l'imponibile invece di produrre un totale negativo.
  const afterDiscount = Math.max(
    0,
    roundFiscale(
      subtotal * (1 - ((opts.discount_pct ?? 0) / 100)) - (opts.discount_fixed ?? 0)
    )
  )

  // 4. IVA PER VOCE, sull'imponibile GIÀ SCONTATO (obbligatorio per legge IT)
  //
  // ⚠️ CAMBIATO l'8 ago 2026 (decisione di Eli, dopo verifica su fonti
  // ufficiali). Prima l'IVA si calcolava sul totale di riga PIENO anche in
  // presenza di uno sconto sul documento: 100 con sconto 10% dava imponibile
  // 90 ma IVA 22 → totale 112 invece di 109,80.
  //
  // Perché è sbagliato: uno sconto incondizionato indicato in fattura fa parte
  // del corrispettivo pattuito, quindi abbassa la BASE IMPONIBILE (art. 13 DPR
  // 633/1972), e l'IVA si applica sull'importo scontato. Lo conferma il
  // tracciato FatturaPA: nei DatiRiepilogo l'`ImponibileImporto` dev'essere al
  // netto dello sconto di documento, e lo SdI ha un controllo apposta (errore
  // 00422) per chi sbaglia questo calcolo.
  // ⚠️ Nessuna fattura è però mai stata scartata per questo: `lib/sdi/doc-xml.ts`
  // RIFIUTA da sempre le fatture con sconti (non ancora rappresentabili
  // nell'XML), quindi il caso non arrivava allo SdI. Il danno era un altro e
  // non meno serio: il totale mostrato al cliente sul PDF e sul link era
  // gonfiato dell'IVA calcolata sull'importo pieno.
  //
  // COME: lo sconto globale si ripartisce sulle voci **in proporzione** al loro
  // importo, così ogni aliquota vede la propria base ridotta della stessa
  // quota. L'arrotondamento residuo va sull'ULTIMA voce, altrimenti la somma
  // delle basi scontate non tornerebbe con `afterDiscount` (e il riepilogo IVA
  // per aliquota non quadrerebbe al centesimo).
  const aliquota = (i: { vat_rate: number | null }) =>
    (i.vat_rate ?? opts.vat_rate_default ?? 22) / 100

  let taxAmount = 0
  if (opts.fiscal_regime !== 'forfettario') {
    // Quanto è stato tolto in tutto dallo sconto di documento
    const scontoTotale = roundFiscale(subtotal - afterDiscount)
    if (scontoTotale <= 0 || subtotal <= 0) {
      taxAmount = roundFiscale(
        itemTotals.reduce((s, i) => s + roundFiscale(i.total * aliquota(i)), 0)
      )
    } else {
      let scontoAssegnato = 0
      const basi = itemTotals.map((i, idx) => {
        const ultima = idx === itemTotals.length - 1
        const quota = ultima
          ? roundFiscale(scontoTotale - scontoAssegnato)
          : roundFiscale((scontoTotale * i.total) / subtotal)
        scontoAssegnato = roundFiscale(scontoAssegnato + quota)
        // Mai sotto zero: con importi molto diversi l'ultima quota potrebbe
        // eccedere la riga più piccola.
        return { imponibile: Math.max(0, roundFiscale(i.total - quota)), vat: aliquota(i) }
      })
      taxAmount = roundFiscale(
        basi.reduce((s, b) => s + roundFiscale(b.imponibile * b.vat), 0)
      )
    }
  }

  // 5. Ritenuta d'acconto (opzionale)
  const ritenuta = opts.ritenuta_pct
    ? roundFiscale(afterDiscount * opts.ritenuta_pct / 100)
    : 0

  // 6. Marca da bollo (forfettari con totale > 77.47)
  const bollo =
    opts.fiscal_regime === 'forfettario' && afterDiscount > 77.47 ? 2.0 : 0

  // 7. Totale finale
  const total = roundFiscale(afterDiscount + taxAmount + bollo - ritenuta)

  return { subtotal, afterDiscount, taxAmount, ritenuta, bollo, total, itemTotals }
}
