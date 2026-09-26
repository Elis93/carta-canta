// ============================================================
// FATTURA DI SALDO A CONGUAGLIO — Fase 3 di PROGETTO_ACCONTI.md
//
// Il saldo è una fattura (TD01) sull'INTERO lavoro, con una riga negativa
// per ogni riga delle fatture di acconto (TD02) già emesse: così il cliente
// vede il lavoro intero e capisce cosa sta pagando, e per ogni aliquota
// l'imponibile del saldo risulta «pieno − acconti».
//
// ⚖️ Le regole, dalle fonti lette:
//  · il tracciato FatturaPA, campo 2.2.1.4 <Descrizione>, ammette le righe
//    negative quando la riga «fa riferimento a… un precedente documento
//    emesso a titolo di "anticipo/acconto"» → la descrizione RICHIAMA il
//    documento di acconto (numero e data);
//  · la riga negativa ha la STESSA aliquota della riga dell'acconto, così
//    IVA acconti + IVA saldo = IVA dell'intero corrispettivo;
//  · lo SdI ricalcola l'imponibile di ogni aliquota come SOMMA ALGEBRICA dei
//    PrezzoTotale (00422, ±1 €) e l'imposta per aliquota (00421, ±1 cent):
//    nessun controllo sul segno, ma un riepilogo NEGATIVO non ha senso →
//    `verificaRiepilogoSaldo`;
//  · la data di una fattura collegata non può essere successiva a quella del
//    documento (00418; nelle specifiche 1.9.1 il testo non la limita alle
//    note di credito) → `verificaDateCollegate`.
//
// ⚠️ MODULO PURO: nessun accesso al DB. La conversione in saldo, le guardie
// del server e l'XML (pacchetti 3D-3F) usano queste funzioni: le regole
// vivono in un posto solo, e sono testate.
// ============================================================

import { roundFiscale, type RigaIva } from './calcoli'

/** Una riga di una fattura di acconto (TD02), come serve allo scomputo. */
export interface RigaAccontoFatturata {
  /** Aliquota della riga (0 per forfettario e inversione contabile). */
  vat_rate: number | null
  /** Imponibile della riga (quantità × prezzo: le righe della TD02 hanno
   *  quantità 1 e nessuno sconto). */
  imponibile: number
}

/** Una fattura di acconto da scalare dal saldo. */
export interface AccontoDaScomputare {
  id: string
  /** Numero della TD02 così com'è («ACC 001/2026»). */
  numero: string
  /** Data fiscale della TD02 (YYYY-MM-DD): il giorno dell'incasso. */
  dataYmd: string
  righe: RigaAccontoFatturata[]
}

/** Una riga di scomputo, pronta per l'insert fra le voci del saldo. */
export interface RigaScomputo {
  description: string
  unit: string
  quantity: number
  unit_price: number
  discount_pct: number
  vat_rate: number | null
  bene_significativo: false
  unit_cost: null
  scomputo_acconto_id: string
}

/** «2026-09-10» → «10/09/2026». Una data non valida resta com'è. */
function dataLabel(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ymd
}

/**
 * La descrizione della riga di scomputo: richiama numero e data della TD02,
 * come chiede il tracciato (2.2.1.4). Con più righe nella stessa TD02 dice
 * anche di quale aliquota è la quota, altrimenti le righe sembrerebbero
 * doppioni.
 */
export function descrizioneScomputo(numero: string, dataYmd: string, quotaRate?: number | null): string {
  const base = `Acconto già fatturato: ${numero.trim()} del ${dataLabel(dataYmd)}`
  return quotaRate != null
    ? `${base} — quota con IVA ${quotaRate.toLocaleString('it-IT')}%`
    : base
}

/**
 * Le righe NEGATIVE del saldo: una per ogni riga di ogni fattura di acconto,
 * stessa aliquota e stesso importo col segno meno. Gli acconti in ordine di
 * data (poi di numero); dentro una TD02, le righe dal 10% al 22% come nella
 * TD02 stessa. Le righe a importo nullo non si scomputano (non esistono).
 */
export function righeScomputo(acconti: AccontoDaScomputare[]): RigaScomputo[] {
  const ordinati = [...acconti].sort((a, b) =>
    a.dataYmd === b.dataYmd ? a.numero.localeCompare(b.numero) : a.dataYmd.localeCompare(b.dataYmd),
  )
  const out: RigaScomputo[] = []
  for (const acc of ordinati) {
    const righe = acc.righe
      .filter((r) => roundFiscale(r.imponibile) > 0)
      .sort((a, b) => (a.vat_rate ?? 0) - (b.vat_rate ?? 0))
    const multi = righe.length > 1
    for (const r of righe) {
      out.push({
        description: descrizioneScomputo(acc.numero, acc.dataYmd, multi ? r.vat_rate : null),
        unit: 'a corpo',
        quantity: 1,
        unit_price: -roundFiscale(r.imponibile),
        discount_pct: 0,
        vat_rate: r.vat_rate,
        bene_significativo: false,
        unit_cost: null,
        scomputo_acconto_id: acc.id,
      })
    }
  }
  return out
}

/** Una voce del saldo, nella forma minima che serve alle verifiche. */
export interface VoceSaldo {
  quantity: number
  unit_price: number
  discount_pct?: number | null
  vat_rate?: number | null
  scomputo_acconto_id?: string | null
}

export interface EsitoVerifica {
  ok: boolean
  /** Frasi in parole semplici, pronte da mostrare all'artigiano. */
  problemi: string[]
}

const chiave = (id: string, rate: number | null | undefined, importo: number) =>
  `${id}|${rate ?? 'null'}|${roundFiscale(importo).toFixed(2)}`

/**
 * Il saldo scala ESATTAMENTE le fatture di acconto attive: una riga per ogni
 * riga di ogni TD02, stessa aliquota, stesso importo col meno. Nessuna riga
 * in meno (si fatturerebbe due volte la stessa parte di lavoro), nessuna in
 * più (si scalerebbe un acconto che non esiste più), nessun importo cambiato.
 * È la guardia che il server applica prima di salvare e di trasmettere.
 */
export function verificaScomputi(voci: VoceSaldo[], acconti: AccontoDaScomputare[]): EsitoVerifica {
  const problemi: string[] = []
  const attese = new Map<string, number>()
  for (const r of righeScomputo(acconti)) {
    const k = chiave(r.scomputo_acconto_id, r.vat_rate, r.unit_price)
    attese.set(k, (attese.get(k) ?? 0) + 1)
  }
  const numeroDi = new Map(acconti.map((a) => [a.id, a.numero]))
  const presenti = new Map<string, number>()
  for (const v of voci) {
    const id = v.scomputo_acconto_id
    if (typeof id !== 'string' || id.length === 0) continue
    const importo = roundFiscale(
      Number(v.quantity ?? 0) * Number(v.unit_price ?? 0) * (1 - Number(v.discount_pct ?? 0) / 100),
    )
    if (!numeroDi.has(id)) {
      problemi.push('Il saldo scala una fattura di acconto che non esiste più (eliminata o nel cestino).')
      continue
    }
    const k = chiave(id, v.vat_rate, importo)
    presenti.set(k, (presenti.get(k) ?? 0) + 1)
  }
  for (const [k, n] of attese) {
    const m = presenti.get(k) ?? 0
    if (m < n) {
      const numero = numeroDi.get(k.split('|')[0]) ?? 'di acconto'
      problemi.push(`Nel saldo manca lo scomputo della fattura ${numero}: la stessa parte di lavoro risulterebbe fatturata due volte.`)
    } else if (m > n) {
      const numero = numeroDi.get(k.split('|')[0]) ?? 'di acconto'
      problemi.push(`Nel saldo la fattura ${numero} è scalata più di una volta.`)
    }
  }
  for (const k of presenti.keys()) {
    if (!attese.has(k)) {
      const numero = numeroDi.get(k.split('|')[0]) ?? 'di acconto'
      problemi.push(`Nel saldo lo scomputo della fattura ${numero} non corrisponde all'importo o all'aliquota della fattura di acconto.`)
    }
  }
  const unici = [...new Set(problemi)]
  return { ok: unici.length === 0, problemi: unici }
}

/**
 * Nessuna aliquota del saldo può restare con un imponibile NEGATIVO: vorrebbe
 * dire che per quell'aliquota gli acconti hanno fatturato più del lavoro.
 * Con la ripartizione proporzionale della 71/E §5.2 non succede per
 * costruzione — la verifica esiste perché un'invariante non scritta prima o
 * poi si rompe.
 */
export function verificaRiepilogoSaldo(righeIva: RigaIva[]): EsitoVerifica {
  const problemi = righeIva
    .filter((r) => r.imponibile < -0.005)
    .map((r) => `Con IVA ${r.rate.toLocaleString('it-IT')}% gli acconti già fatturati superano il valore del lavoro.`)
  return { ok: problemi.length === 0, problemi }
}

/**
 * La data del saldo non può essere PRECEDENTE a quella di una fattura di
 * acconto che richiama (00418). Oggi è vero per costruzione — gli acconti
 * nascono il giorno dell'incasso, il saldo alla conferma — ma lo si scrive.
 */
export function verificaDateCollegate(saldoYmd: string, acconti: AccontoDaScomputare[]): EsitoVerifica {
  const problemi = acconti
    .filter((a) => /^\d{4}-\d{2}-\d{2}$/.test(a.dataYmd) && a.dataYmd > saldoYmd)
    .map((a) => `La fattura di acconto ${a.numero} ha una data (${dataLabel(a.dataYmd)}) successiva a quella del saldo: lo SdI la scarterebbe.`)
  return { ok: problemi.length === 0, problemi }
}

/** Esito del controllo su un nuovo acconto rispetto al totale del lavoro. */
export type EsitoNuovoAcconto = 'ok' | 'chiude' | 'supera'

/**
 * Il TETTO degli acconti (D7): la somma degli acconti — nuovo compreso,
 * confrontati sul LORDO prima dell'eventuale ritenuta — deve restare SOTTO
 * il totale del lavoro. Se lo raggiunge, quel pagamento non è un acconto: è
 * il saldo («converti in fattura e segna pagata»). Tolleranza di un
 * centesimo, come negli altri tetti dell'app.
 */
export function verificaNuovoAcconto(
  totaleLavoro: number,
  accontiPrecedenti: number[],
  nuovo: number,
): EsitoNuovoAcconto {
  const somma = roundFiscale(accontiPrecedenti.reduce((s, a) => s + a, 0) + nuovo)
  const totale = roundFiscale(totaleLavoro)
  if (somma > totale + 0.01) return 'supera'
  if (somma >= totale - 0.01) return 'chiude'
  return 'ok'
}

/** Quanto resta da fatturare col saldo, sul lordo (mai sotto zero). */
export function residuoDopoAcconti(totaleLavoro: number, acconti: number[]): number {
  return Math.max(0, roundFiscale(totaleLavoro - acconti.reduce((s, a) => s + a, 0)))
}
