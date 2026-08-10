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

  // 4. IVA PER ALIQUOTA, sull'imponibile GIÀ SCONTATO
  //
  // ⚠️ Due decisioni, entrambe verificate su fonti ufficiali:
  //
  // ① LO SCONTO ABBASSA LA BASE (8 ago, decisione di Eli): uno sconto
  //   incondizionato indicato in fattura fa parte del corrispettivo pattuito,
  //   quindi abbassa la BASE IMPONIBILE (art. 13 DPR 633/1972) — 100 con
  //   sconto 10% dà imponibile 90 e IVA 19,80, non 22. Nei DatiRiepilogo
  //   FatturaPA l'`ImponibileImporto` va al netto dello sconto di documento
  //   (controllo 00422, tolleranza ±1 euro).
  //
  // ② L'IVA SI CALCOLA PER ALIQUOTA, NON PER VOCE (10 ago, rilettura delle
  //   specifiche). Lo SdI ricalcola l'imposta del riepilogo come
  //   `ImponibileImporto × Aliquota / 100`, arrotondata al centesimo
  //   (mezzo in su), con tolleranza di ±1 CENTESIMO — controllo 00421. La
  //   causa nota di quello scarto è proprio «IVA calcolata riga per riga e
  //   poi sommata»: con 5 voci da 10,11 € al 22% la somma per voce dà 11,10,
  //   il ricalcolo dello SdI 11,12 → fattura SCARTATA. Sommando prima le
  //   basi per aliquota e moltiplicando UNA volta per aliquota, lo scarto è
  //   impossibile per costruzione — e il totale del PDF coincide con l'XML.
  //
  // COME: lo sconto globale si ripartisce sulle voci **in proporzione** al
  // loro importo (residuo di arrotondamento sull'ULTIMA voce, altrimenti la
  // somma delle basi non tornerebbe con `afterDiscount`); poi le basi si
  // raggruppano per aliquota e l'imposta si calcola sul totale di ciascuna.
  const aliquota = (i: { vat_rate: number | null }) =>
    (i.vat_rate ?? opts.vat_rate_default ?? 22) / 100

  let taxAmount = 0
  if (opts.fiscal_regime !== 'forfettario') {
    // Quanto è stato tolto in tutto dallo sconto di documento (0 se nessuno)
    const scontoTotale = roundFiscale(subtotal - afterDiscount)
    const conSconto = scontoTotale > 0 && subtotal > 0
    let scontoAssegnato = 0
    const basi = itemTotals.map((i, idx) => {
      const ultima = idx === itemTotals.length - 1
      const quota = conSconto
        ? (ultima
            ? roundFiscale(scontoTotale - scontoAssegnato)
            : roundFiscale((scontoTotale * i.total) / subtotal))
        : 0
      scontoAssegnato = roundFiscale(scontoAssegnato + quota)
      // Mai sotto zero: con importi molto diversi l'ultima quota potrebbe
      // eccedere la riga più piccola.
      return { imponibile: Math.max(0, roundFiscale(i.total - quota)), vat: aliquota(i) }
    })
    // Basi sommate PER ALIQUOTA → una sola moltiplicazione per aliquota,
    // identica a quella del riepilogo FatturaPA (controllo 00421).
    const perAliquota = new Map<number, number>()
    for (const b of basi) {
      perAliquota.set(b.vat, roundFiscale((perAliquota.get(b.vat) ?? 0) + b.imponibile))
    }
    taxAmount = roundFiscale(
      [...perAliquota.entries()].reduce((s, [vat, base]) => s + roundFiscale(base * vat), 0)
    )
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
