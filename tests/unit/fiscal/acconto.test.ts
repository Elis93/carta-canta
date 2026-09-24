import { describe, it, expect } from 'vitest'
import { righeAcconto, descrizioneAcconto } from '@/lib/fiscal/acconto'
import { calcolaDocumento, roundFiscale } from '@/lib/fiscal/calcoli'
import type { VoceSplittabile } from '@/lib/fiscal/beni-significativi'
import { formatAccontoNumber, DOC_NUMBER_RE } from '@/lib/documents/numero'
import type { Database } from '@/types/database'

type DocumentItemRow = Database['public']['Tables']['document_items']['Row']

// La fattura di acconto TD02 (Fase 2 di PROGETTO_ACCONTI): dall'importo
// incassato alle righe del documento. L'invariante centrale: imponibili +
// IVA ricalcolata come fa il motore (una moltiplicazione per aliquota)
// devono tornare AL CENTESIMO con l'importo, salvo i rari lordi
// irraggiungibili (scarto dichiarato ≤ 1 centesimo).

const rif = { titolo: 'rifacimento bagno', numero: '012/2026', dataLabel: '14/09/2026' }

/** L'esempio ufficiale della 15/E dopo la Fase 1 (valore del bene = costo):
 *  caldaia venduta 1.200 (costo 1.000, bene) + posa 600 al 10%.
 *  Split: 1.600 al 10% (lordo 1.760) + 200 al 22% (lordo 244) → T = 2.004. */
const vociEsempioUfficiale: VoceSplittabile[] = [
  { description: 'Caldaia a condensazione', quantity: 1, unit_price: 1200, vat_rate: 10, bene_significativo: true, unit_cost: 1000 },
  { description: 'Posa e installazione', quantity: 1, unit_price: 600, vat_rate: 10 },
]

/** Il corrispettivo delle righe ricalcolato COME FA IL MOTORE. */
function corrispettivoRighe(righe: Array<{ unit_price: number; vat_rate: number | null }>): number {
  return roundFiscale(righe.reduce(
    (s, r) => s + r.unit_price + roundFiscale((r.unit_price * (r.vat_rate ?? 0)) / 100),
    0,
  ))
}

describe('descrizioneAcconto — mai generica, mai trattini appesi', () => {
  it('con titolo e preventivo cita entrambi', () => {
    expect(descrizioneAcconto(rif)).toBe('Acconto su rifacimento bagno — preventivo 012/2026 del 14/09/2026')
  })
  it('senza titolo resta il riferimento al preventivo (niente «su» orfano)', () => {
    expect(descrizioneAcconto({ numero: '012/2026', dataLabel: '14/09/2026' }))
      .toBe('Acconto — preventivo 012/2026 del 14/09/2026')
  })
  it('senza niente resta «Acconto» pulito, senza trattini', () => {
    expect(descrizioneAcconto({})).toBe('Acconto')
    expect(descrizioneAcconto({ titolo: '  ' })).toBe('Acconto')
  })
  it('la quota si accoda dopo il riferimento', () => {
    expect(descrizioneAcconto({ titolo: 'bagno' }, 'quota con IVA 10%'))
      .toBe('Acconto su bagno — quota con IVA 10%')
  })
})

describe('righeAcconto — forfettario e reverse charge (niente scorporo)', () => {
  it('forfettario: una riga, imponibile = importo, aliquota 0', () => {
    const r = righeAcconto(
      [{ description: 'Lavori', quantity: 1, unit_price: 3000 }],
      { fiscal_regime: 'forfettario' },
      900,
      rif,
    )
    expect(r.righe).toHaveLength(1)
    expect(r.righe[0].unit_price).toBe(900)
    expect(r.righe[0].vat_rate).toBe(0)
    expect(r.righe[0].quantity).toBe(1)
    expect(r.righe[0].discount_pct).toBe(0)
    expect(r.corrispettivo).toBe(900)
    expect(r.scarto).toBe(0)
    expect(r.dicituraBeni).toBeNull()
  })

  it('reverse charge in ordinario: una riga senza IVA', () => {
    const r = righeAcconto(
      [{ description: 'Lavori', quantity: 1, unit_price: 3000, vat_rate: 22 }],
      { fiscal_regime: 'ordinario', reverse_charge: true },
      500,
      rif,
    )
    expect(r.righe).toHaveLength(1)
    expect(r.righe[0].unit_price).toBe(500)
    expect(r.righe[0].vat_rate).toBe(0)
    expect(r.corrispettivo).toBe(500)
  })

  it('il bollo del forfettario sopra 77,47 € lo aggiunge il MOTORE, non il modulo', () => {
    const r = righeAcconto(
      [{ description: 'Lavori', quantity: 1, unit_price: 3000 }],
      { fiscal_regime: 'forfettario' },
      900,
      rif,
    )
    const fiscal = calcolaDocumento(r.righe as unknown as DocumentItemRow[], {
      fiscal_regime: 'forfettario',
      currency: 'EUR',
      doc_type: 'fattura_acconto',
    })
    expect(fiscal.bollo).toBe(2)
    expect(fiscal.total).toBe(902) // 900 incassati + 2 € di bollo riaddebitato
  })
})

describe('righeAcconto — ordinario, aliquota unica', () => {
  it('500 € al 22%: base 409,84 + IVA 90,16 = 500,00 esatti', () => {
    const r = righeAcconto(
      [{ description: 'Lavori', quantity: 1, unit_price: 2000, vat_rate: 22 }],
      { fiscal_regime: 'ordinario' },
      500,
      rif,
    )
    expect(r.righe).toHaveLength(1)
    expect(r.righe[0].unit_price).toBe(409.84)
    expect(r.righe[0].vat_rate).toBe(22)
    // Niente suffisso «quota con IVA…» quando la riga è una sola
    expect(r.righe[0].description).toBe('Acconto su rifacimento bagno — preventivo 012/2026 del 14/09/2026')
    expect(r.corrispettivo).toBe(500)
    expect(r.scarto).toBe(0)
  })

  it('lordo IRRAGGIUNGIBILE (100,01 al 22%): scarto dichiarato ≤ 1 centesimo', () => {
    const r = righeAcconto(
      [{ description: 'Lavori', quantity: 1, unit_price: 2000, vat_rate: 22 }],
      { fiscal_regime: 'ordinario' },
      100.01,
      rif,
    )
    expect(r.righe).toHaveLength(1)
    expect(Math.abs(r.scarto)).toBeLessThanOrEqual(0.01)
    expect(r.corrispettivo).toBe(corrispettivoRighe(r.righe))
  })

  it('l’aliquota di default vale per le voci senza aliquota', () => {
    const r = righeAcconto(
      [{ description: 'Lavori', quantity: 1, unit_price: 1000 }],
      { fiscal_regime: 'ordinario', vat_rate_default: 10 },
      110,
      rif,
    )
    expect(r.righe).toHaveLength(1)
    expect(r.righe[0].vat_rate).toBe(10)
    expect(r.righe[0].unit_price).toBe(100)
    expect(r.corrispettivo).toBe(110)
  })

  it('lo SCONTO di documento del preventivo entra nella proporzione', () => {
    // 100 al 22% con sconto 10% → lordo del lavoro 109,80; acconto 54,90 (metà)
    const r = righeAcconto(
      [{ description: 'Lavori', quantity: 1, unit_price: 100, vat_rate: 22 }],
      { fiscal_regime: 'ordinario', discount_pct: 10 },
      54.9,
      rif,
    )
    expect(r.righe[0].unit_price).toBe(45)
    expect(r.corrispettivo).toBe(54.9)
    expect(r.scarto).toBe(0)
  })
})

describe('righeAcconto — più aliquote (71/E §5.2: proporzione sull’intero corrispettivo)', () => {
  it('esempio ufficiale, acconto del 30% (601,20 su 2.004): quote 480 al 10% e 60 al 22%', () => {
    const r = righeAcconto(vociEsempioUfficiale, { fiscal_regime: 'ordinario' }, 601.2, rif)
    expect(r.righe).toHaveLength(2)
    // 10% prima del 22%
    expect(r.righe[0].vat_rate).toBe(10)
    expect(r.righe[0].unit_price).toBe(480)
    expect(r.righe[1].vat_rate).toBe(22)
    expect(r.righe[1].unit_price).toBe(60)
    // Le descrizioni dicono QUALE quota è
    expect(r.righe[0].description).toContain('quota con IVA 10%')
    expect(r.righe[1].description).toContain('quota con IVA 22%')
    expect(r.corrispettivo).toBe(601.2)
    expect(r.scarto).toBe(0)
  })

  it('il MOTORE sulle righe prodotte restituisce esattamente l’importo (end-to-end)', () => {
    const r = righeAcconto(vociEsempioUfficiale, { fiscal_regime: 'ordinario' }, 601.2, rif)
    const fiscal = calcolaDocumento(r.righe as unknown as DocumentItemRow[], {
      fiscal_regime: 'ordinario',
      currency: 'EUR',
      doc_type: 'fattura_acconto',
    })
    expect(fiscal.taxAmount).toBe(61.2) // 48 + 13,20
    expect(fiscal.bollo).toBe(0)
    expect(fiscal.total).toBe(601.2)
  })

  it('un importo qualsiasi quadra al centesimo (o dichiara lo scarto)', () => {
    for (const importo of [333.33, 150, 1002, 47.11, 999.99]) {
      const r = righeAcconto(vociEsempioUfficiale, { fiscal_regime: 'ordinario' }, importo, rif)
      expect(Math.abs(r.scarto)).toBeLessThanOrEqual(0.01)
      expect(r.corrispettivo).toBe(corrispettivoRighe(r.righe))
      expect(roundFiscale(r.corrispettivo - importo)).toBe(r.scarto)
    }
  })

  it('la dicitura riporta il valore del bene NELLA QUOTA dell’acconto', () => {
    const r = righeAcconto(vociEsempioUfficiale, { fiscal_regime: 'ordinario' }, 601.2, rif)
    // ⚠️ Il separatore delle migliaia dipende dall'ICU di Node (in questo
    // ambiente manca — su Vercel c'è): l'asserzione accetta entrambe le grafie.
    expect(r.dicituraBeni).toMatch(/1\.?000,00/)
    expect(r.dicituraBeni).toContain('300,00') // 30% di 1.000
    expect(r.dicituraBeni).toContain('30%')
    expect(r.dicituraBeni).toContain('71/E')
  })

  it('senza beni significativi la dicitura non c’è', () => {
    const r = righeAcconto(
      [
        { description: 'Posa', quantity: 1, unit_price: 500, vat_rate: 10 },
        { description: 'Extra', quantity: 1, unit_price: 200, vat_rate: 22 },
      ],
      { fiscal_regime: 'ordinario' },
      100,
      rif,
    )
    expect(r.dicituraBeni).toBeNull()
    expect(r.righe).toHaveLength(2)
    expect(Math.abs(r.scarto)).toBeLessThanOrEqual(0.01)
  })
})

describe('righeAcconto — casi degeneri', () => {
  it('importo nullo o negativo: nessuna riga', () => {
    const items: VoceSplittabile[] = [{ description: 'Lavori', quantity: 1, unit_price: 100, vat_rate: 22 }]
    expect(righeAcconto(items, { fiscal_regime: 'ordinario' }, 0, rif).righe).toHaveLength(0)
    expect(righeAcconto(items, { fiscal_regime: 'ordinario' }, -5, rif).righe).toHaveLength(0)
    expect(righeAcconto(items, { fiscal_regime: 'ordinario' }, NaN, rif).righe).toHaveLength(0)
  })

  it('preventivo senza voci con importo: una riga all’aliquota di default', () => {
    const r = righeAcconto([], { fiscal_regime: 'ordinario' }, 122, rif)
    expect(r.righe).toHaveLength(1)
    expect(r.righe[0].vat_rate).toBe(22)
    expect(r.righe[0].unit_price).toBe(100)
    expect(r.corrispettivo).toBe(122)
  })

  it('tutte le righe nascono «a corpo», quantità 1, senza sconto', () => {
    const r = righeAcconto(vociEsempioUfficiale, { fiscal_regime: 'ordinario' }, 601.2, rif)
    for (const riga of r.righe) {
      expect(riga.unit).toBe('a corpo')
      expect(riga.quantity).toBe(1)
      expect(riga.discount_pct).toBe(0)
    }
  })
})

describe('formatAccontoNumber — sezionale «ACC», dentro le regole del tracciato', () => {
  it('produce «ACC 001/2026» e la validazione del form lo ACCETTA', () => {
    const n = formatAccontoNumber(1, 2026)
    expect(n).toBe('ACC 001/2026')
    expect(DOC_NUMBER_RE.test(n)).toBe(true)
    expect(n.length).toBeLessThanOrEqual(20) // String20Type FatturaPA
  })
  it('regge anche i progressivi grandi', () => {
    expect(formatAccontoNumber(1234, 2026)).toBe('ACC 1234/2026')
    expect(DOC_NUMBER_RE.test(formatAccontoNumber(1234, 2026))).toBe(true)
  })
})
