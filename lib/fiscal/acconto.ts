// ============================================================
// FATTURA DI ACCONTO (TD02) — le righe del documento a partire
// dall'importo incassato (Fase 2 di PROGETTO_ACCONTI.md).
//
// L'artigiano registra QUANTO ha ricevuto (corrispettivo lordo, IVA
// compresa, bollo escluso): da lì si costruiscono a ritroso le righe
// della fattura di acconto, così che imponibili + IVA tornino al
// centesimo con l'importo incassato.
//
// ⚖️ Le regole, dalle fonti lette per il progetto:
//  · la descrizione richiama il lavoro e il preventivo — la Guida AdE
//    chiede di evitare «descrizioni troppo generiche come "acconto
//    lavori" senza ulteriori specifiche»;
//  · con PIÙ ALIQUOTE (beni significativi, voci miste 10/22) l'acconto
//    va ripartito IN PROPORZIONE fra le aliquote dell'intero lavoro:
//    circ. 71/E/2000 §5.2 — «il limite… dovrà essere calcolato in
//    relazione all'intero corrispettivo dovuto dal committente e non ad
//    un singolo acconto o al solo saldo»;
//  · sempre per la 71/E §5.2, il VALORE del bene significativo va
//    riportato in ogni fattura «nella quota percentuale corrispondente
//    alla parte di corrispettivo pagata» → `dicituraBeni`;
//  · forfettario e reverse charge: nessuna IVA da scorporare, l'importo
//    è l'imponibile (il bollo, dove dovuto, lo aggiunge il motore).
//
// ⚠️ MODULO PURO: non calcola i totali del documento (quello resta al
// motore, `calcolaDocumento`, che sulle righe prodotte qui aggiunge
// bollo ed eventuale ritenuta). Le proporzioni si derivano da
// `riepilogoIva` sulle voci ESPANSE dei beni significativi — la stessa
// fonte dei totali del preventivo: per costruzione non possono divergere.
// ============================================================

import { roundFiscale, riepilogoIva } from './calcoli'
import {
  dettaglioBeniSignificativi,
  espandiBeniSignificativi,
  quotaAccontoBene,
  type VoceSplittabile,
} from './beni-significativi'

/** Le opzioni fiscali del PREVENTIVO da cui l'acconto nasce. */
export interface OpzioniAcconto {
  fiscal_regime: string | null | undefined
  vat_rate_default?: number | null
  discount_pct?: number | null
  discount_fixed?: number | null
  reverse_charge?: boolean | null
}

/** Come si presenta il preventivo dentro la descrizione delle righe. */
export interface RiferimentoAcconto {
  titolo?: string | null
  /** Numero GIÀ ripulito dai prefissi storici (stripPrefissoLegacy). */
  numero?: string | null
  /** Data del preventivo già formattata («14/09/2026»). */
  dataLabel?: string | null
}

/** Una riga della fattura di acconto, pronta per l'insert. */
export interface RigaAcconto {
  description: string
  unit: string
  quantity: number
  unit_price: number
  vat_rate: number | null
  discount_pct: number
}

export interface EsitoAcconto {
  righe: RigaAcconto[]
  /** Corrispettivo del TD02 (imponibili + IVA, senza bollo né ritenuta). */
  corrispettivo: number
  /** `corrispettivo − importo`: ±0,01 nei rari casi in cui lo scorporo
   *  esatto non esiste (non ogni importo lordo è raggiungibile come
   *  base + IVA arrotondata). Quasi sempre 0. */
  scarto: number
  /** Dicitura 71/E §5.2 col valore del bene in quota — null senza beni
   *  significativi (o in forfettario/reverse). */
  dicituraBeni: string | null
}

/**
 * Le righe IVA per aliquota dell'INTERO lavoro: voci espanse (split dei beni
 * significativi, Fase 1: valore = costo) → `riepilogoIva`, la STESSA funzione
 * che fa i totali del preventivo. Solo regime ordinario senza inversione.
 */
function righeIvaLavoro(items: VoceSplittabile[], opts: OpzioniAcconto) {
  const espanse = espandiBeniSignificativi(items, opts.fiscal_regime, opts.vat_rate_default)
  const conTotale = espanse.map((i) => ({
    total: roundFiscale(
      Number(i.quantity ?? 0) * Number(i.unit_price ?? 0) * (1 - (Number(i.discount_pct ?? 0) / 100)),
    ),
    vat_rate: i.vat_rate ?? null,
  }))
  return riepilogoIva(conTotale, {
    fiscal_regime: 'ordinario',
    discount_pct: opts.discount_pct ?? undefined,
    discount_fixed: opts.discount_fixed ?? undefined,
    vat_rate_default: opts.vat_rate_default ?? undefined,
  })
}

const fmtEuro = (v: number) =>
  v.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/**
 * La descrizione di una riga dell'acconto: mai un «Acconto lavori» generico,
 * mai trattini appesi con un titolo vuoto (lezione doc-ref del 17 set).
 */
export function descrizioneAcconto(rif: RiferimentoAcconto, quotaLabel?: string): string {
  const titolo = rif.titolo?.trim()
  const numero = rif.numero?.trim()
  let out = titolo ? `Acconto su ${titolo}` : 'Acconto'
  if (numero) {
    out += ` — preventivo ${numero}${rif.dataLabel ? ` del ${rif.dataLabel}` : ''}`
  }
  return quotaLabel ? `${out} — ${quotaLabel}` : out
}

/**
 * Le righe della fattura di acconto a partire dalle voci del preventivo,
 * dalle sue opzioni fiscali e dall'importo incassato (lordo).
 *
 * · UNA riga quando il lavoro ha un'aliquota sola (o è forfettario /
 *   reverse charge): base = scorporo dell'importo.
 * · Una riga PER ALIQUOTA quando le aliquote sono più d'una: l'importo si
 *   ripartisce in proporzione ai lordi per aliquota dell'intero lavoro
 *   (post-split dei beni significativi), poi si scorpora per aliquota.
 *   Le basi vengono aggiustate al centesimo perché la somma di imponibili
 *   e IVA (ricalcolata come fa il motore: una moltiplicazione per
 *   aliquota) torni con l'importo incassato.
 */
export function righeAcconto(
  items: VoceSplittabile[],
  opts: OpzioniAcconto,
  importo: number,
  rif: RiferimentoAcconto,
): EsitoAcconto {
  const nulla: EsitoAcconto = { righe: [], corrispettivo: 0, scarto: 0, dicituraBeni: null }
  if (!Number.isFinite(importo) || importo <= 0) return nulla
  const A = roundFiscale(importo)

  // Forfettario e reverse charge: nessuna IVA addebitata → l'importo
  // ricevuto È l'imponibile. Aliquota 0 esplicita sulla riga: in
  // forfettario il motore la ignora, in reverse la natura (N6.7) sta sul
  // documento — e la guardia «IVA 0 in ordinario» di doc-xml non scatta
  // perché il reverse ne è escluso.
  const senzaIva = opts.fiscal_regime === 'forfettario' || opts.reverse_charge === true
  if (senzaIva) {
    return {
      righe: [{
        description: descrizioneAcconto(rif),
        unit: 'a corpo',
        quantity: 1,
        unit_price: A,
        vat_rate: 0,
        discount_pct: 0,
      }],
      corrispettivo: A,
      scarto: 0,
      dicituraBeni: null,
    }
  }

  // ── Ordinario: i «secchielli» per aliquota dell'intero lavoro ──────────
  const vatDef = opts.vat_rate_default ?? undefined
  const righeIva = righeIvaLavoro(items, opts)

  // Lordo per aliquota e corrispettivo totale del lavoro (senza bollo:
  // il bollo è un'imposta, non corrispettivo — e i preventivi non lo
  // portano comunque dall'11 ago).
  const secchielli = righeIva
    .map((r) => ({ rate: r.rate, lordo: roundFiscale(r.imponibile + r.imposta) }))
    .filter((s) => s.lordo > 0)
  const T = roundFiscale(secchielli.reduce((s, b) => s + b.lordo, 0))

  // Nessuna voce con importo (preventivo degenere): una riga sola
  // all'aliquota di default, scorporata.
  if (secchielli.length === 0 || T <= 0) {
    secchielli.length = 0
    secchielli.push({ rate: vatDef ?? 22, lordo: A })
  }

  // ── Ripartizione dell'importo fra i secchielli, residuo sul maggiore ──
  const ordinati = [...secchielli].sort((a, b) => b.lordo - a.lordo)
  const base = ordinati.map((s) => ({ rate: s.rate, lordoTarget: 0, imponibile: 0 }))
  if (ordinati.length === 1) {
    base[0].lordoTarget = A
  } else {
    let assegnato = 0
    for (let i = 1; i < ordinati.length; i++) {
      const quota = roundFiscale((A * ordinati[i].lordo) / T)
      base[i].lordoTarget = quota
      assegnato = roundFiscale(assegnato + quota)
    }
    base[0].lordoTarget = Math.max(0, roundFiscale(A - assegnato))
  }

  // ── Scorporo per aliquota + quadratura al centesimo ───────────────────
  // Il corrispettivo del TD02 ricalcolato COME FA IL MOTORE (imponibile per
  // aliquota × aliquota, arrotondato una volta) deve tornare con A: si
  // aggiustano le basi di ±1 centesimo finché quadra. Non ogni lordo è
  // raggiungibile (es. 100,01 € al 22%): in quel caso resta uno scarto
  // di al più 1 centesimo, dichiarato nell'esito.
  for (const b of base) {
    b.imponibile = roundFiscale(b.lordoTarget / (1 + b.rate / 100))
  }
  const corrispettivoDi = () =>
    roundFiscale(base.reduce(
      (s, b) => s + b.imponibile + roundFiscale((b.imponibile * b.rate) / 100),
      0,
    ))
  let diff = roundFiscale(A - corrispettivoDi())
  for (let iter = 0; iter < 12 && Math.abs(diff) >= 0.005; iter++) {
    const delta = diff > 0 ? 0.01 : -0.01
    let migliore: { idx: number; diff: number } | null = null
    for (let i = 0; i < base.length; i++) {
      const nuovo = roundFiscale(base[i].imponibile + delta)
      if (nuovo < 0) continue
      const prima = base[i].imponibile
      base[i].imponibile = nuovo
      const d = roundFiscale(A - corrispettivoDi())
      base[i].imponibile = prima
      if (!migliore || Math.abs(d) < Math.abs(migliore.diff)) migliore = { idx: i, diff: d }
    }
    if (!migliore || Math.abs(migliore.diff) >= Math.abs(diff)) break
    base[migliore.idx].imponibile = roundFiscale(base[migliore.idx].imponibile + delta)
    diff = migliore.diff
  }
  const corrispettivo = corrispettivoDi()

  // ── Righe (10% prima del 22%: si legge come il lavoro) ────────────────
  const visibili = base.filter((b) => b.imponibile > 0)
  const multi = visibili.length > 1
  const righe: RigaAcconto[] = [...visibili]
    .sort((a, b) => a.rate - b.rate)
    .map((b) => ({
      description: descrizioneAcconto(
        rif,
        multi ? `quota con IVA ${b.rate.toLocaleString('it-IT')}%` : undefined,
      ),
      unit: 'a corpo',
      quantity: 1,
      unit_price: b.imponibile,
      vat_rate: b.rate,
      discount_pct: 0,
    }))

  // ── Dicitura dei beni significativi in quota (71/E §5.2) ──────────────
  const det = dettaglioBeniSignificativi(items, opts.fiscal_regime, opts.vat_rate_default)
  const dicituraBeni = det && T > 0
    ? `Beni significativi (art. 1, comma 19, L. 205/2017): valore complessivo dei beni ${fmtEuro(det.valoreBeni)} €; `
      + `in questa fattura di acconto se ne riporta la quota di ${fmtEuro(quotaAccontoBene(det.valoreBeni, T, A))} € `
      + `(${roundFiscale((A / T) * 100).toLocaleString('it-IT')}% del corrispettivo pattuito), come previsto dalla circolare 71/E/2000.`
    : null

  return { righe, corrispettivo, scarto: roundFiscale(corrispettivo - A), dicituraBeni }
}

// ── Acconto da un CONDOMINIO: l'importo ricevuto è già senza il 4% ─────────
//
// Il condominio trattiene la ritenuta d'acconto del 4% su OGNI pagamento,
// acconti compresi (art. 25-ter DPR 600/1973; circ. 7/E/2007 §5: «indipen-
// dentemente dall'importo del pagamento effettuato e dall'imputazione del
// pagamento stesso ad acconto o saldo»). L'artigiano vede sul conto il
// NETTO: è quella la cifra che scrive (decisione D5 dello schema Fase 3).
// Da lì si ricostruisce il corrispettivo lordo della TD02.
//
// ⚠️ La ritenuta è sul solo IMPONIBILE, non sull'IVA: con k = lordo ÷
// imponibile del lavoro (1 + aliquota media), vale
//     ricevuto = lordo − r × lordo ÷ k   →   lordo = ricevuto ÷ (1 − r ÷ k)
// — NON «ricevuto ÷ 0,96», che è giusto solo senza IVA. Poi si cercano i
// centesimi: il ricevuto ricalcolato COME FA IL MOTORE (ritenuta
// arrotondata sull'imponibile delle righe) deve tornare con quello scritto.

export interface EsitoAccontoConRitenuta extends EsitoAcconto {
  /** Corrispettivo lordo della TD02 (imponibili + IVA, prima della ritenuta). */
  lordo: number
  /** Ritenuta calcolata sulle righe, come la calcolerà il motore. */
  ritenuta: number
  /** `lordo − ritenuta`: ciò che il condominio ha pagato secondo i conti. */
  ricevutoCalcolato: number
}

export function righeAccontoDaRicevuto(
  items: VoceSplittabile[],
  opts: OpzioniAcconto,
  ricevuto: number,
  rif: RiferimentoAcconto,
  ritenutaPct: number,
): EsitoAccontoConRitenuta {
  const vuoto: EsitoAccontoConRitenuta = {
    righe: [], corrispettivo: 0, scarto: 0, dicituraBeni: null, lordo: 0, ritenuta: 0, ricevutoCalcolato: 0,
  }
  if (!Number.isFinite(ricevuto) || ricevuto <= 0) return vuoto
  const N = roundFiscale(ricevuto)
  const r = Number.isFinite(ritenutaPct) && ritenutaPct > 0 ? ritenutaPct / 100 : 0
  // I forfettari sono ESENTI dalla ritenuta (art. 1 c.67 L. 190/2014): qui
  // non si arriva mai con una percentuale, ma se succedesse l'importo resta
  // quello scritto — mai inventare una trattenuta che non c'è stata.
  if (r === 0 || opts.fiscal_regime === 'forfettario') {
    const esito = righeAcconto(items, opts, N, rif)
    return { ...esito, lordo: esito.corrispettivo, ritenuta: 0, ricevutoCalcolato: esito.corrispettivo }
  }

  // k = lordo ÷ imponibile dell'intero lavoro. Senza IVA (inversione
  // contabile — che verso un condominio non esiste, ma la funzione resta
  // pura) k vale 1.
  let k = 1
  if (opts.reverse_charge !== true) {
    const righeIva = righeIvaLavoro(items, opts)
    const imp = righeIva.reduce((s, x) => s + x.imponibile, 0)
    const lordo = righeIva.reduce((s, x) => s + x.imponibile + x.imposta, 0)
    if (imp > 0 && lordo > 0) k = lordo / imp
    else k = 1 + (opts.vat_rate_default ?? 22) / 100
  }

  const stima = roundFiscale(N / (1 - r / k))
  const prova = (lordo: number): EsitoAccontoConRitenuta => {
    const esito = righeAcconto(items, opts, lordo, rif)
    const imponibile = roundFiscale(esito.righe.reduce((s, x) => s + x.unit_price, 0))
    // Stessa espressione del motore (calcoli.ts, passo 5): mai divergere di un centesimo.
    const ritenuta = roundFiscale(imponibile * ritenutaPct / 100)
    const ricevutoCalcolato = roundFiscale(esito.corrispettivo - ritenuta)
    return {
      ...esito,
      lordo: esito.corrispettivo,
      ritenuta,
      ricevutoCalcolato,
      scarto: roundFiscale(ricevutoCalcolato - N),
    }
  }
  // Si prova la stima e i centesimi vicini: vince il primo che torna esatto,
  // altrimenti quello con lo scarto più piccolo (al più un centesimo).
  let migliore = prova(stima)
  for (let d = 1; d <= 5 && migliore.scarto !== 0; d++) {
    for (const segno of [-1, 1]) {
      const c = prova(roundFiscale(stima + segno * d * 0.01))
      if (Math.abs(c.scarto) < Math.abs(migliore.scarto)) migliore = c
      if (migliore.scarto === 0) break
    }
  }
  return migliore
}
