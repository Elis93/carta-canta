// ============================================================
// CARTA CANTA — Motore Fiscale
// Implementazione completa arriva allo Step 6.
// Qui le costanti e l'arrotondamento base.
// ============================================================

import type { FiscalOptions, FiscalResult } from '@/types/index'
import type { Database } from '@/types/database'
import { espandiBeniSignificativi } from './beni-significativi'

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

// ── RIEPILOGO IVA PER ALIQUOTA ────────────────────────────────
// La FONTE UNICA delle righe «IVA x%»: la usa il motore per il taxAmount e
// la usa il PDF per le righe del riepilogo. Prima il PDF le ricalcolava per
// conto suo (per voce, sull'imponibile PIENO): con uno sconto di documento
// il cliente leggeva un'IVA diversa da quella addebitata, e le righe non
// sommavano al totale (trovato dalla revisione del 10 ago).
export interface RigaIva { rate: number; imponibile: number; imposta: number }

export function riepilogoIva(
  righe: Array<{ total: number; vat_rate: number | null }>,
  opts: Pick<FiscalOptions, 'fiscal_regime' | 'discount_pct' | 'discount_fixed' | 'vat_rate_default' | 'reverse_charge'>,
): RigaIva[] {
  if (opts.fiscal_regime === 'forfettario') return []
  // Inversione contabile (081): l'IVA non la addebita chi emette. Nessuna
  // riga «IVA x%» nel riepilogo — al suo posto il documento porta la
  // dicitura di legge e la natura N6.7.
  if (opts.reverse_charge) return []
  const subtotal = roundFiscale(righe.reduce((s, r) => s + r.total, 0))
  const afterDiscount = Math.max(
    0,
    roundFiscale(subtotal * (1 - ((opts.discount_pct ?? 0) / 100)) - (opts.discount_fixed ?? 0))
  )
  const scontoTotale = roundFiscale(subtotal - afterDiscount)
  const conSconto = scontoTotale > 0 && subtotal > 0
  let scontoAssegnato = 0
  const perAliquota = new Map<number, number>()
  righe.forEach((r, idx) => {
    const ultima = idx === righe.length - 1
    const quota = conSconto
      ? (ultima
          ? roundFiscale(scontoTotale - scontoAssegnato)
          : roundFiscale((scontoTotale * r.total) / subtotal))
      : 0
    scontoAssegnato = roundFiscale(scontoAssegnato + quota)
    const rate = r.vat_rate ?? opts.vat_rate_default ?? 22
    // Mai sotto zero: con importi molto diversi l'ultima quota potrebbe
    // eccedere la riga più piccola.
    const imponibile = Math.max(0, roundFiscale(r.total - quota))
    perAliquota.set(rate, roundFiscale((perAliquota.get(rate) ?? 0) + imponibile))
  })
  // Una moltiplicazione PER ALIQUOTA: è il ricalcolo dello SdI (00421, ±1 cent).
  return [...perAliquota.entries()].map(([rate, imponibile]) => ({
    rate,
    imponibile,
    imposta: roundFiscale(imponibile * rate / 100),
  }))
}

// ── CALCOLO DOCUMENTO ─────────────────────────────────────────
// Ordine OBBLIGATORIO per conformità legge IT
export function calcolaDocumento(
  itemsGrezzi: DocumentItemRow[],
  opts: FiscalOptions
): FiscalResult {
  // 0. BENI SIGNIFICATIVI (081): una voce marcata viene spezzata in due —
  // la quota che resta al 10% e l'eccedenza che va al 22% (DM 29.12.1999).
  // Sta PRIMA di tutto il resto perché da qui in giù non serve nessun ramo
  // nuovo: il passo 4 somma già le basi per aliquota, quindi l'imposta esce
  // giusta senza toccare il resto del motore.
  // La funzione è IDEMPOTENTE (azzera il flag sulle righe che produce):
  // PDF, pagina pubblica e XML la richiamano sulle stesse voci per mostrare
  // le due righe — la «separata evidenza» dell'art. 1 c.19 L. 205/2017 — e
  // non possono divergere da questo calcolo.
  const itemsSpezzati = espandiBeniSignificativi(itemsGrezzi, opts.fiscal_regime, opts.vat_rate_default)

  // 1. Totale per voce
  // ⚠️ `itemTotals` resta sulle voci GREZZE, non su quelle spezzate: è ciò
  // che viene RISALVATO nel database, e persistere lo split trasformerebbe
  // «Caldaia» in due righe che l'artigiano non può più correggere (né
  // ricalcolare se domani cambia il prezzo della posa). Lo split è una
  // rappresentazione del documento, non un dato da conservare — per questo
  // PDF, pagina pubblica e XML lo rifanno al volo con la stessa funzione.
  const riga = (item: DocumentItemRow) => ({
    ...item,
    total: roundFiscale(
      item.quantity * item.unit_price * (1 - ((item.discount_pct ?? 0) / 100))
    ),
  })
  const itemTotals = itemsGrezzi.map(riga)
  const perAliquota = itemsSpezzati.map(riga)

  // 2. Subtotale
  // Identico nei due insiemi (lo split ripartisce, non aggiunge): si usa
  // quello spezzato perché è la base del riepilogo per aliquota.
  const subtotal = roundFiscale(perAliquota.reduce((s, i) => s + i.total, 0))

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
  // La ripartizione dello sconto e la moltiplicazione per aliquota vivono in
  // `riepilogoIva` (sopra), che è anche la fonte delle righe «IVA x%» del PDF:
  // un solo calcolo, impossibile che il riepilogo mostrato diverga dal totale.
  const taxAmount = roundFiscale(
    riepilogoIva(
      perAliquota.map((i) => ({ total: i.total, vat_rate: i.vat_rate })),
      opts,
    ).reduce((s, r) => s + r.imposta, 0)
  )

  // 5. Ritenuta d'acconto (opzionale)
  const ritenuta = opts.ritenuta_pct
    ? roundFiscale(afterDiscount * opts.ritenuta_pct / 100)
    : 0

  // 6. Marca da bollo (forfettari con totale > 77.47).
  // ⚠️ SOLO su fatture e note di credito, MAI sui preventivi (11 ago 2026):
  //   · il preventivo non è un documento fiscale ex art. 13 tariffa
  //     DPR 642/1972 («fatture, note, conti e simili documenti recanti
  //     addebitamenti o accreditamenti») — è un'offerta, il bollo non è
  //     dovuto e la prassi dei gestionali non lo espone;
  //   · la NOTA DI CREDITO invece È fra i documenti dell'art. 13
  //     («…o accreditamenti»): sopra 77,47 € il bollo è dovuto, e la guida
  //     AdE lo conferma escludendo dal calcolo automatico solo TD16-TD19 —
  //     una TD04 sopra soglia finisce nell'Elenco A comunque.
  // `doc_type` assente = comportamento da fattura (compatibilità).
  // ⚠️ Il criterio giusto NON è «nessuna IVA esposta»: è «operazione NON
  //   SOGGETTA a IVA» (principio di alternatività, art. 6 Tabella B
  //   DPR 642/1972). Il REVERSE CHARGE è un'operazione SOGGETTA a IVA —
  //   l'imposta esiste, la assolve il committente — quindi il bollo NON è
  //   dovuto (circ. AdE 37/E/2006 sui subappalti edili; la stessa AdE, nella
  //   guida sul bollo delle fatture elettroniche, esclude TUTTI gli N6.* dal
  //   calcolo automatico dell'Elenco B: pretende il bollo solo su N2.1, N2.2,
  //   N3.5, N3.6, N4). L'11 ago avevamo sovracorretto («IVA zero = bollo»):
  //   addebitava 2 € mai dovuti e li dichiarava nell'XML. Corretto il 17 ago
  //   dopo ricerca su fonti ufficiali (collaudo: «non siamo sicuri che si
  //   faccia»). Il FORFETTARIO resta col bollo: N2.2 è operazione non
  //   soggetta, ed è nell'Elenco B dell'AdE. E il flag reverse_charge NON
  //   toglie il bollo al forfettario: in uscita lui l'inversione non la
  //   applica (resta N2.2, c'è un test apposta) → l'operazione resta non
  //   soggetta e il bollo resta dovuto.
  const senzaIva = opts.fiscal_regime === 'forfettario'
  const bollo =
    senzaIva && afterDiscount > 77.47 && opts.doc_type !== 'preventivo'
      ? 2.0
      : 0

  // 7. Totale finale
  const total = roundFiscale(afterDiscount + taxAmount + bollo - ritenuta)

  return { subtotal, afterDiscount, taxAmount, ritenuta, bollo, total, itemTotals }
}
