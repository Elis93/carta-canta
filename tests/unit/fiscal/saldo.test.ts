import { describe, it, expect } from 'vitest'
import { calcolaDocumento, riepilogoIva, roundFiscale } from '@/lib/fiscal/calcoli'
import { righeAcconto, righeAccontoDaRicevuto } from '@/lib/fiscal/acconto'
import {
  dettaglioBeniSignificativi,
  espandiBeniSignificativi,
  quotaAccontoBene,
  quotaBeneSaldo,
  type VoceSplittabile,
} from '@/lib/fiscal/beni-significativi'
import {
  descrizioneScomputo,
  righeScomputo,
  verificaScomputi,
  verificaRiepilogoSaldo,
  verificaDateCollegate,
  verificaNuovoAcconto,
  residuoDopoAcconti,
  type AccontoDaScomputare,
} from '@/lib/fiscal/saldo'
import { incassiFromDoc } from '@/lib/bilancio/incassi'
import type { Database } from '@/types/database'
import type { FiscalOptions } from '@/types/index'

type DocumentItemRow = Database['public']['Tables']['document_items']['Row']

// FASE 3 — il saldo a conguaglio. L'invariante centrale, per OGNI aliquota:
//     imponibile del lavoro = Σ imponibili degli acconti + imponibile del saldo
// al centesimo. Più i buchi che la rilettura del codice aveva trovato: lo
// sconto riapplicato sul residuo e le righe negative dentro lo split dei
// beni significativi.

const rif = { titolo: 'sostituzione caldaia', numero: '012/2026', dataLabel: '14/09/2026' }
const ordinario: FiscalOptions = { fiscal_regime: 'ordinario', currency: 'EUR', vat_rate_default: 22, doc_type: 'fattura' }
const forfettario: FiscalOptions = { fiscal_regime: 'forfettario', currency: 'EUR', vat_rate_default: 22, doc_type: 'fattura' }

/** Le voci come le legge il motore. */
const righe = (voci: Array<Record<string, unknown>>) => voci as unknown as DocumentItemRow[]

/** Una TD02 nella forma che serve allo scomputo, dalle righe prodotte in Fase 2. */
function td02(id: string, numero: string, dataYmd: string, righeAcc: Array<{ unit_price: number; vat_rate: number | null }>): AccontoDaScomputare {
  return { id, numero, dataYmd, righe: righeAcc.map((r) => ({ vat_rate: r.vat_rate, imponibile: r.unit_price })) }
}

/** Le righe IVA di un insieme di voci COME LE PRODUCE IL MOTORE: prima lo
 *  split dei beni significativi (le righe di scomputo ne restano fuori),
 *  poi il riepilogo per aliquota. È lo stesso percorso di PDF e XML. */
function righeIvaDi(voci: VoceSplittabile[], opts: FiscalOptions) {
  return riepilogoIva(
    espandiBeniSignificativi(voci, opts.fiscal_regime, opts.vat_rate_default).map((v) => ({
      total: roundFiscale(v.quantity * v.unit_price),
      vat_rate: v.vat_rate ?? null,
      scomputo: !!v.scomputo_acconto_id,
    })),
    opts,
  )
}

/** Imponibile per aliquota, come lo ricalcola lo SdI. */
function imponibiliPerAliquota(voci: VoceSplittabile[], opts: FiscalOptions) {
  return new Map(righeIvaDi(voci, opts).map((r) => [r.rate, r.imponibile]))
}

/** Circolare 71/E §5.2, l'esempio del progetto: caldaia 3.500 (costo) + posa e
 *  materiali 1.500 = 5.000 → 3.000 al 10% e 2.000 al 22%. */
const vociCaldaia: VoceSplittabile[] = [
  { description: 'Caldaia a condensazione', quantity: 1, unit_price: 3500, vat_rate: 10, bene_significativo: true, unit_cost: 3500 },
  { description: 'Posa e materiali', quantity: 1, unit_price: 1500, vat_rate: 10 },
]

describe('descrizioneScomputo — richiama il documento di acconto (tracciato 2.2.1.4)', () => {
  it('numero e data', () => {
    expect(descrizioneScomputo('ACC 001/2026', '2026-09-10')).toBe('Acconto già fatturato: ACC 001/2026 del 10/09/2026')
  })
  it('con più righe nella stessa TD02 dice la quota', () => {
    expect(descrizioneScomputo('ACC 001/2026', '2026-09-10', 10))
      .toBe('Acconto già fatturato: ACC 001/2026 del 10/09/2026 — quota con IVA 10%')
  })
})

describe('righeScomputo — una riga negativa per ogni riga di ogni acconto', () => {
  it('stessa aliquota, importo col meno, marcata con la TD02', () => {
    const out = righeScomputo([td02('a1', 'ACC 001/2026', '2026-09-10', [
      { unit_price: 900, vat_rate: 10 }, { unit_price: 600, vat_rate: 22 },
    ])])
    expect(out).toHaveLength(2)
    expect(out[0]).toMatchObject({ unit_price: -900, vat_rate: 10, quantity: 1, scomputo_acconto_id: 'a1', bene_significativo: false, unit_cost: null })
    expect(out[1]).toMatchObject({ unit_price: -600, vat_rate: 22, scomputo_acconto_id: 'a1' })
  })
  it('gli acconti in ordine di data, poi di numero', () => {
    const out = righeScomputo([
      td02('b', 'ACC 002/2026', '2026-10-01', [{ unit_price: 100, vat_rate: 22 }]),
      td02('a', 'ACC 001/2026', '2026-09-01', [{ unit_price: 50, vat_rate: 22 }]),
    ])
    expect(out.map((r) => r.scomputo_acconto_id)).toEqual(['a', 'b'])
  })
  it('una riga a zero non si scomputa', () => {
    expect(righeScomputo([td02('a', 'ACC 001/2026', '2026-09-01', [{ unit_price: 0, vat_rate: 22 }])])).toHaveLength(0)
  })
})

describe('saldo a conguaglio — esempio della 71/E con beni significativi', () => {
  const optsAcc = { fiscal_regime: 'ordinario', vat_rate_default: 22 }
  // Lordo del lavoro: 3.000 × 1,10 + 2.000 × 1,22 = 5.740. Acconto 30% = 1.722.
  const acc = righeAcconto(vociCaldaia, optsAcc, 1722, rif)
  const acconto = td02('a1', 'ACC 001/2026', '2026-09-10', acc.righe)
  const vociSaldo = [...vociCaldaia, ...righeScomputo([acconto])]

  it('l\'acconto prende il 30% di ciascuna aliquota: 900 al 10% + 600 al 22%', () => {
    expect(acc.righe.map((r) => [r.vat_rate, r.unit_price])).toEqual([[10, 900], [22, 600]])
  })
  it('il saldo resta 2.100 al 10% e 1.400 al 22%', () => {
    const imp = imponibiliPerAliquota(vociSaldo, ordinario)
    expect(imp.get(10)).toBe(2100)
    expect(imp.get(22)).toBe(1400)
  })
  it('il totale del saldo è il lavoro meno l\'acconto: 5.740 − 1.722 = 4.018', () => {
    const f = calcolaDocumento(righe(vociSaldo as never), ordinario)
    expect(f.total).toBe(4018)
    expect(f.lavori).toBe(5000)
    expect(f.scomputi).toBe(-1500)
    expect(f.afterDiscount).toBe(3500)
  })
  it('le righe negative NON entrano nello split: lo split del saldo è quello del lavoro intero', () => {
    const conScomputi = dettaglioBeniSignificativi(vociSaldo, 'ordinario', 22)
    const soloLavoro = dettaglioBeniSignificativi(vociCaldaia, 'ordinario', 22)
    expect(conScomputi).toEqual(soloLavoro)
    expect(soloLavoro).toMatchObject({ imponibile10: 3000, imponibile22: 2000, valoreBeni: 3500 })
  })
  it('la quota del bene sul saldo è per differenza: acconto + saldo = valore del bene', () => {
    const quotaAcc = quotaAccontoBene(3500, 5740, 1722)
    const quotaSaldo = quotaBeneSaldo(3500, 5740, [1722])
    expect(quotaAcc).toBe(1050)
    expect(roundFiscale(quotaAcc + quotaSaldo)).toBe(3500)
  })
  it('il saldo è coerente: scomputi esatti e nessuna aliquota negativa', () => {
    expect(verificaScomputi(vociSaldo, [acconto]).ok).toBe(true)
    expect(verificaRiepilogoSaldo(righeIvaDi(vociSaldo, ordinario)).ok).toBe(true)
  })
})

describe('due acconti su aliquote miste — la quadratura regge al centesimo', () => {
  const voci: VoceSplittabile[] = [
    { description: 'Demolizione e smaltimento', quantity: 1, unit_price: 1234.56, vat_rate: 22 },
    { description: 'Rifacimento impianto', quantity: 3, unit_price: 777.77, vat_rate: 10 },
  ]
  const opts = { fiscal_regime: 'ordinario', vat_rate_default: 22 }
  const a1 = righeAcconto(voci, opts, 1000, rif)
  const a2 = righeAcconto(voci, opts, 733.33, rif)
  const acconti = [
    td02('a1', 'ACC 001/2026', '2026-09-01', a1.righe),
    td02('a2', 'ACC 002/2026', '2026-10-01', a2.righe),
  ]
  const vociSaldo = [...voci, ...righeScomputo(acconti)]

  it('per ogni aliquota: lavoro = acconti + saldo', () => {
    const lavoro = imponibiliPerAliquota(voci, ordinario)
    const saldo = imponibiliPerAliquota(vociSaldo, ordinario)
    for (const rate of [10, 22]) {
      const acc = [...a1.righe, ...a2.righe].filter((r) => r.vat_rate === rate).reduce((s, r) => s + r.unit_price, 0)
      expect(roundFiscale(acc + (saldo.get(rate) ?? 0))).toBe(lavoro.get(rate))
    }
  })
  it('il corrispettivo del saldo più quello degli acconti torna col lavoro (±1 cent per documento)', () => {
    const lavoro = calcolaDocumento(righe(voci as never), ordinario).total
    const saldo = calcolaDocumento(righe(vociSaldo as never), ordinario).total
    const differenza = roundFiscale(lavoro - (saldo + a1.corrispettivo + a2.corrispettivo))
    expect(Math.abs(differenza)).toBeLessThanOrEqual(0.03)
  })
  it('verificaScomputi accetta il saldo intatto', () => {
    expect(verificaScomputi(vociSaldo, acconti)).toEqual({ ok: true, problemi: [] })
  })
})

describe('sconto di documento — non si riapplica sul residuo', () => {
  it('forfettario: voci 1.000, sconto 10%, acconto 270 → saldo 630 (non 657)', () => {
    const voci: VoceSplittabile[] = [{ description: 'Tinteggiatura', quantity: 1, unit_price: 1000, vat_rate: 22 }]
    const acc = righeAcconto(voci, { fiscal_regime: 'forfettario', discount_pct: 10 }, 270, rif)
    const vociSaldo = [...voci, ...righeScomputo([td02('a1', 'ACC 001/2026', '2026-09-10', acc.righe)])]
    const f = calcolaDocumento(righe(vociSaldo as never), { ...forfettario, discount_pct: 10 })
    expect(f.afterDiscount).toBe(630)
    // Lo sconto mostrato resta lo sconto vero: subtotale − imponibile = 100.
    expect(roundFiscale(f.subtotal - f.afterDiscount)).toBe(100)
    expect(f.bollo).toBe(2)
    expect(f.total).toBe(632)
  })
  it('ordinario: voci 1.000 al 22%, sconto 10%, acconto 329,40 → saldo 630 + IVA 138,60', () => {
    const voci: VoceSplittabile[] = [{ description: 'Tinteggiatura', quantity: 1, unit_price: 1000, vat_rate: 22 }]
    const acc = righeAcconto(voci, { fiscal_regime: 'ordinario', vat_rate_default: 22, discount_pct: 10 }, 329.4, rif)
    expect(acc.righe.map((r) => r.unit_price)).toEqual([270])
    const vociSaldo = [...voci, ...righeScomputo([td02('a1', 'ACC 001/2026', '2026-09-10', acc.righe)])]
    const f = calcolaDocumento(righe(vociSaldo as never), { ...ordinario, discount_pct: 10 })
    expect(f.afterDiscount).toBe(630)
    expect(f.taxAmount).toBe(138.6)
    expect(f.total).toBe(768.6)
  })
  it('senza righe di scomputo il motore dà esattamente i numeri di prima', () => {
    const voci = [{ description: 'Posa', quantity: 3, unit_price: 33.33, vat_rate: 22 }]
    const f = calcolaDocumento(righe(voci), { ...ordinario, discount_pct: 10, discount_fixed: 5 })
    expect(f.subtotal).toBe(99.99)
    expect(f.lavori).toBe(99.99)
    expect(f.scomputi).toBe(0)
    expect(f.afterDiscount).toBe(roundFiscale(99.99 * 0.9 - 5))
  })
})

describe('bollo — si valuta su ogni documento, sul netto', () => {
  const voci: VoceSplittabile[] = [{ description: 'Riparazione', quantity: 1, unit_price: 150, vat_rate: 22 }]
  it('acconto 100 col bollo, saldo di 50 senza (sotto 77,47 €)', () => {
    const acc = righeAcconto(voci, { fiscal_regime: 'forfettario' }, 100, rif)
    const fAcc = calcolaDocumento(righe(acc.righe as never), { ...forfettario, doc_type: 'fattura_acconto' })
    expect(fAcc.bollo).toBe(2)
    const vociSaldo = [...voci, ...righeScomputo([td02('a1', 'ACC 001/2026', '2026-09-10', acc.righe)])]
    const fSaldo = calcolaDocumento(righe(vociSaldo as never), forfettario)
    expect(fSaldo.afterDiscount).toBe(50)
    expect(fSaldo.bollo).toBe(0)
  })
  it('acconto 900 e saldo 2.100: il bollo su tutti e due', () => {
    const lavoro: VoceSplittabile[] = [{ description: 'Bagno', quantity: 1, unit_price: 3000, vat_rate: 22 }]
    const acc = righeAcconto(lavoro, { fiscal_regime: 'forfettario' }, 900, rif)
    const vociSaldo = [...lavoro, ...righeScomputo([td02('a1', 'ACC 001/2026', '2026-09-10', acc.righe)])]
    expect(calcolaDocumento(righe(acc.righe as never), { ...forfettario, doc_type: 'fattura_acconto' }).bollo).toBe(2)
    expect(calcolaDocumento(righe(vociSaldo as never), forfettario).bollo).toBe(2)
  })
})

describe('inversione contabile — il saldo esce senza IVA', () => {
  it('nessuna riga IVA, imponibile netto', () => {
    const voci: VoceSplittabile[] = [{ description: 'Impianto elettrico', quantity: 1, unit_price: 2000, vat_rate: 22 }]
    const acc = righeAcconto(voci, { fiscal_regime: 'ordinario', reverse_charge: true }, 500, rif)
    expect(acc.righe.map((r) => [r.vat_rate, r.unit_price])).toEqual([[0, 500]])
    const vociSaldo = [...voci, ...righeScomputo([td02('a1', 'ACC 001/2026', '2026-09-10', acc.righe)])]
    const f = calcolaDocumento(righe(vociSaldo as never), { ...ordinario, reverse_charge: true })
    expect(f.taxAmount).toBe(0)
    expect(f.afterDiscount).toBe(1500)
    expect(f.total).toBe(1500)
  })
})

describe('condominio — la ritenuta del 4% su acconti e saldo', () => {
  const voci: VoceSplittabile[] = [
    { description: 'Rifacimento facciata', quantity: 1, unit_price: 10000, vat_rate: 10 },
    { description: 'Ponteggio', quantity: 1, unit_price: 2000, vat_rate: 22 },
  ]
  const opts = { fiscal_regime: 'ordinario', vat_rate_default: 22 }

  it('dal ricevuto (netto del 4%) torna il lordo: i conti del motore danno il ricevuto', () => {
    const esito = righeAccontoDaRicevuto(voci, opts, 3000, rif, 4)
    expect(esito.scarto).toBe(0)
    expect(esito.ricevutoCalcolato).toBe(3000)
    // Il motore sulle righe della TD02, con la ritenuta, dà lo stesso ricevuto.
    const f = calcolaDocumento(righe(esito.righe as never), { ...ordinario, ritenuta_pct: 4, doc_type: 'fattura_acconto' })
    expect(f.ritenuta).toBe(esito.ritenuta)
    expect(f.total).toBe(3000)
  })
  it('non è «÷ 0,96»: la ritenuta è sul solo imponibile', () => {
    const esito = righeAccontoDaRicevuto(voci, opts, 3000, rif, 4)
    expect(esito.lordo).not.toBe(roundFiscale(3000 / 0.96))
    const imponibile = esito.righe.reduce((s, r) => s + r.unit_price, 0)
    expect(esito.ritenuta).toBe(roundFiscale(imponibile * 4 / 100))
  })
  it('ritenuta degli acconti + ritenuta del saldo = 4% dell\'intero imponibile (±1 cent per documento)', () => {
    const a1 = righeAccontoDaRicevuto(voci, opts, 3000, rif, 4)
    const a2 = righeAccontoDaRicevuto(voci, opts, 2500, rif, 4)
    const vociSaldo = [...voci, ...righeScomputo([
      td02('a1', 'ACC 001/2026', '2026-09-01', a1.righe),
      td02('a2', 'ACC 002/2026', '2026-10-01', a2.righe),
    ])]
    const saldo = calcolaDocumento(righe(vociSaldo as never), { ...ordinario, ritenuta_pct: 4 })
    const totale = roundFiscale(a1.ritenuta + a2.ritenuta + saldo.ritenuta)
    expect(Math.abs(roundFiscale(totale - 12000 * 0.04))).toBeLessThanOrEqual(0.03)
  })
  it('senza percentuale (o in forfettario) l\'importo resta quello scritto', () => {
    const e = righeAccontoDaRicevuto(voci, { fiscal_regime: 'forfettario' }, 1000, rif, 4)
    expect(e.ritenuta).toBe(0)
    expect(e.righe.map((r) => r.unit_price)).toEqual([1000])
  })
})

describe('verificaScomputi — il saldo non può scalare di più o di meno', () => {
  const acconto = td02('a1', 'ACC 001/2026', '2026-09-10', [{ unit_price: 900, vat_rate: 10 }, { unit_price: 600, vat_rate: 22 }])
  const lavoro = [{ quantity: 1, unit_price: 5000, vat_rate: 10 }]
  const giuste = righeScomputo([acconto])

  it('una riga tolta → la stessa parte fatturata due volte', () => {
    const esito = verificaScomputi([...lavoro, giuste[0]], [acconto])
    expect(esito.ok).toBe(false)
    expect(esito.problemi[0]).toContain('manca lo scomputo della fattura ACC 001/2026')
  })
  it('importo cambiato → non corrisponde', () => {
    const esito = verificaScomputi([...lavoro, giuste[0], { ...giuste[1], unit_price: -500 }], [acconto])
    expect(esito.ok).toBe(false)
    expect(esito.problemi.join(' ')).toContain('non corrisponde')
  })
  it('scalata due volte', () => {
    const esito = verificaScomputi([...lavoro, ...giuste, giuste[0]], [acconto])
    expect(esito.problemi.join(' ')).toContain('più di una volta')
  })
  it('acconto non più attivo (eliminato) → segnalato', () => {
    const esito = verificaScomputi([...lavoro, ...giuste], [])
    expect(esito.ok).toBe(false)
    expect(esito.problemi[0]).toContain('non esiste più')
  })
  it('acconto nuovo non ancora scalato → manca', () => {
    const altro = td02('a2', 'ACC 002/2026', '2026-10-01', [{ unit_price: 100, vat_rate: 10 }])
    expect(verificaScomputi([...lavoro, ...giuste], [acconto, altro]).ok).toBe(false)
  })
})

describe('verificaRiepilogoSaldo e verificaDateCollegate', () => {
  it('un\'aliquota negativa è un saldo incoerente', () => {
    expect(verificaRiepilogoSaldo([{ rate: 22, imponibile: -10, imposta: -2.2 }]).ok).toBe(false)
    expect(verificaRiepilogoSaldo([{ rate: 22, imponibile: 0, imposta: 0 }]).ok).toBe(true)
  })
  it('00418: un acconto datato dopo il saldo viene segnalato', () => {
    const a = td02('a1', 'ACC 001/2026', '2026-10-05', [{ unit_price: 1, vat_rate: 22 }])
    expect(verificaDateCollegate('2026-10-01', [a]).ok).toBe(false)
    expect(verificaDateCollegate('2026-10-05', [a]).ok).toBe(true)
  })
})

describe('tetto degli acconti (D7)', () => {
  it('sotto il totale è un acconto, al totale è il saldo, oltre è rifiutato', () => {
    expect(verificaNuovoAcconto(1000, [300], 300)).toBe('ok')
    expect(verificaNuovoAcconto(1000, [300], 700)).toBe('chiude')
    expect(verificaNuovoAcconto(1000, [300], 700.01)).toBe('chiude')
    expect(verificaNuovoAcconto(1000, [300], 800)).toBe('supera')
  })
  it('residuo mai sotto zero', () => {
    expect(residuoDopoAcconti(1000, [300, 200])).toBe(500)
    expect(residuoDopoAcconti(1000, [1200])).toBe(0)
  })
})

describe('Bilancio — più acconti, e uno tolto (payment_removed)', () => {
  const base = { payment_status: 'partial', paid_at: '2026-09-15T12:00:00.000Z' }
  const log = [
    { type: 'payment', kind: 'acconto', at: '2026-08-10T12:00:00.000Z', amount: 300, ref: 'a1' },
    { type: 'payment', kind: 'acconto', at: '2026-09-15T12:00:00.000Z', amount: 200, ref: 'a2' },
  ]
  it('due acconti in mesi diversi restano nei loro mesi', () => {
    const ev = incassiFromDoc({ ...base, paid_amount: 500, document_log: log })
    expect(ev.map((e) => [e.when.toISOString().slice(0, 7), e.amount])).toEqual([['2026-08', 300], ['2026-09', 200]])
  })
  it('togliere il secondo lascia il primo nel suo mese', () => {
    const ev = incassiFromDoc({
      ...base, paid_amount: 300,
      document_log: [...log, { type: 'payment_removed', at: '2026-09-20T12:00:00.000Z', amount: 200, ref: 'a2' }],
    })
    expect(ev.map((e) => [e.when.toISOString().slice(0, 7), e.amount])).toEqual([['2026-08', 300]])
  })
  it('senza riferimento toglie il più recente con lo stesso importo', () => {
    const ev = incassiFromDoc({
      ...base, paid_amount: 200,
      document_log: [...log, { type: 'payment_removed', at: '2026-09-20T12:00:00.000Z', amount: 300 }],
    })
    expect(ev.map((e) => e.amount)).toEqual([200])
  })
  it('una rimozione senza corrispondenza non toglie niente', () => {
    const ev = incassiFromDoc({
      ...base, paid_amount: 500,
      document_log: [...log, { type: 'payment_removed', at: '2026-09-20T12:00:00.000Z', amount: 999, ref: 'zzz' }],
    })
    expect(ev.map((e) => e.amount)).toEqual([300, 200])
  })
  it('il reset azzera ancora tutto', () => {
    const ev = incassiFromDoc({
      payment_status: 'unpaid', paid_amount: null,
      document_log: [...log, { type: 'payment_reset', at: '2026-09-20T12:00:00.000Z', amount: 500 }],
    })
    expect(ev).toEqual([])
  })
})
