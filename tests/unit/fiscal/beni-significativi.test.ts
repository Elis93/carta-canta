import { describe, it, expect } from 'vitest'
import {
  splitBeniSignificativi,
  quotaAccontoBene,
  espandiBeniSignificativi,
  dettaglioBeniSignificativi,
  BENI_SIGNIFICATIVI,
  type VoceSplittabile,
} from '@/lib/fiscal/beni-significativi'
import { calcolaDocumento } from '@/lib/fiscal/calcoli'
import { riepilogoPerAliquota } from '@/lib/sdi/xml'

// I numeri di questi test vengono dagli esempi dell'Agenzia ripresi dalle
// guide professionali (circ. 15/E/2018): sono il modo per accorgersi se la
// formula cambia sotto i piedi.

describe('splitBeniSignificativi — la regola del DM 29.12.1999', () => {
  it('caldaia 2.000 + posa 800: 1.600 al 10% e 1.200 al 22%', () => {
    const r = splitBeniSignificativi(2000, 800)
    expect(r.imponibile10).toBe(1600)
    expect(r.imponibile22).toBe(1200)
    // La somma torna sempre col corrispettivo
    expect(r.imponibile10 + r.imponibile22).toBe(2800)
    expect(r.haEccedenza).toBe(true)
  })

  it('caldaia 2.000 + posa 500: 1.000 al 10% e 1.500 al 22%', () => {
    const r = splitBeniSignificativi(2000, 500)
    expect(r.imponibile10).toBe(1000)
    expect(r.imponibile22).toBe(1500)
  })

  it('bene MINORE della prestazione: tutto al 10%, nessuna eccedenza', () => {
    const r = splitBeniSignificativi(1000, 1200)
    expect(r.imponibile10).toBe(2200)
    expect(r.imponibile22).toBe(0)
    expect(r.haEccedenza).toBe(false)
  })

  it('bene ESATTAMENTE pari alla prestazione: tutto al 10%, al limite', () => {
    const r = splitBeniSignificativi(1000, 1000)
    expect(r.imponibile10).toBe(2000)
    expect(r.imponibile22).toBe(0)
  })

  it('nessun bene significativo: tutto resta prestazione al 10%', () => {
    const r = splitBeniSignificativi(0, 900)
    expect(r.imponibile10).toBe(900)
    expect(r.imponibile22).toBe(0)
  })

  it('solo bene, nessuna prestazione: tutto al 22% (niente da agevolare)', () => {
    const r = splitBeniSignificativi(1500, 0)
    expect(r.imponibile10).toBe(0)
    expect(r.imponibile22).toBe(1500)
  })

  it('la somma delle due quote torna col corrispettivo anche con i centesimi', () => {
    const r = splitBeniSignificativi(1333.33, 666.67)
    expect(roundTo2(r.imponibile10 + r.imponibile22)).toBe(2000)
  })

  it('valori negativi non producono imponibili negativi', () => {
    const r = splitBeniSignificativi(-100, -50)
    expect(r.imponibile10).toBe(0)
    expect(r.imponibile22).toBe(0)
  })
})

describe('quotaAccontoBene — lo split si rifà in proporzione su ogni acconto', () => {
  it('acconto del 50%: metà del valore del bene', () => {
    expect(quotaAccontoBene(2000, 2800, 1400)).toBe(1000)
  })

  it('acconto pari al totale: tutto il bene', () => {
    expect(quotaAccontoBene(2000, 2800, 2800)).toBe(2000)
  })

  it('un acconto più grande del totale non sfonda il valore del bene', () => {
    expect(quotaAccontoBene(2000, 2800, 5000)).toBe(2000)
  })

  it('corrispettivo zero → nessuna quota (niente divisioni per zero)', () => {
    expect(quotaAccontoBene(2000, 0, 500)).toBe(0)
  })
})

describe('elenco dei beni significativi', () => {
  it('sono SETTE, come il DM 29.12.1999 (non otto)', () => {
    expect(BENI_SIGNIFICATIVI).toHaveLength(7)
  })

  it('contiene le voci che l’artigiano incontra davvero', () => {
    const testo = BENI_SIGNIFICATIVI.join(' ').toLowerCase()
    expect(testo).toContain('caldaie')
    expect(testo).toContain('infissi')
    expect(testo).toContain('sanitari')
  })
})

function roundTo2(v: number): number {
  return Math.round(v * 100) / 100
}

// ── Il giro completo: form → motore → XML ───────────────────────────────────
// Non basta che la formula sia giusta: deve arrivare identica al totale del
// PDF e al riepilogo che riceve l'Agenzia. Questi test tengono insieme i tre
// pezzi, che è il punto in cui una feature fiscale di solito si rompe.

describe('espandiBeniSignificativi — dal documento al calcolo', () => {
  const voce = (description: string, unit_price: number, extra: Partial<VoceSplittabile> = {}) => ({
    description, quantity: 1, unit_price, discount_pct: null, vat_rate: 10, ...extra,
  })

  it('caldaia 2.000 + posa 800: due righe, e la somma non cambia', () => {
    const out = espandiBeniSignificativi(
      [voce('Caldaia', 2000, { bene_significativo: true }), voce('Posa in opera', 800)],
      'ordinario',
    )
    expect(out).toHaveLength(3)
    const al10 = out.filter((r) => r.vat_rate === 10)
    const al22 = out.filter((r) => r.vat_rate === 22)
    expect(al10.reduce((s, r) => s + r.unit_price, 0)).toBe(1600)
    expect(al22.reduce((s, r) => s + r.unit_price, 0)).toBe(1200)
    // La riga spezzata porta il SUO total: PDF e XML lo leggono da lì.
    expect(al22[0].total).toBe(1200)
  })

  it('è IDEMPOTENTE: richiamarla non rispezza le righe già spezzate', () => {
    const uno = espandiBeniSignificativi(
      [voce('Caldaia', 2000, { bene_significativo: true }), voce('Posa', 800)], 'ordinario',
    )
    expect(espandiBeniSignificativi(uno, 'ordinario')).toEqual(uno)
  })

  it('FORFETTARIO: non si tocca niente (non addebita IVA)', () => {
    const items = [voce('Caldaia', 2000, { bene_significativo: true }), voce('Posa', 800)]
    expect(espandiBeniSignificativi(items, 'forfettario')).toBe(items)
  })

  it('le tapparelle stanno nella PRESTAZIONE, non nel bene', () => {
    // ⚠️ È l'errore più diffuso: confrontare il bene con la SOLA posa.
    // Infisso 1.000 + posa 300 → prestazione 300, eccedenza 700 al 22%.
    const senza = espandiBeniSignificativi(
      [voce('Infissi', 1000, { bene_significativo: true }), voce('Posa', 300)],
      'ordinario',
    )
    expect(senza.filter((r) => r.vat_rate === 22).reduce((s, r) => s + r.unit_price, 0)).toBe(700)
    // Con le tapparelle (parte staccata, autonomia funzionale) la prestazione
    // sale a 700 e al 22% resta solo l'eccedenza di 300.
    const con = espandiBeniSignificativi(
      [voce('Infissi', 1000, { bene_significativo: true }), voce('Posa', 300), voce('Tapparelle', 400)],
      'ordinario',
    )
    expect(con.filter((r) => r.vat_rate === 22).reduce((s, r) => s + r.unit_price, 0)).toBe(300)
  })

  it('il motore fiscale calcola l’IVA sulle due aliquote', () => {
    const row = (description: string, unit_price: number, bene = false) => ({
      id: description, document_id: 'd', sort_order: 0, description, unit: 'pz',
      quantity: 1, unit_price, discount_pct: null, vat_rate: 10, bonus_tipo: null,
      bene_significativo: bene, total: 0, ai_generated: false, ai_confidence: null,
    })
    const f = calcolaDocumento(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- shape minima
      [row('Caldaia', 2000, true), row('Posa', 800)] as any,
      { fiscal_regime: 'ordinario', currency: 'EUR', doc_type: 'fattura' },
    )
    expect(f.subtotal).toBe(2800)
    // 1.600 × 10% = 160 · 1.200 × 22% = 264
    expect(f.taxAmount).toBe(424)
    expect(f.total).toBe(3224)
    // ⚠️ itemTotals resta sulle voci GREZZE: è ciò che si risalva nel DB.
    expect(f.itemTotals).toHaveLength(2)
    expect(f.itemTotals[0].description).toBe('Caldaia')
  })

  it('l’XML esce con un DatiRiepilogo per aliquota', () => {
    const r = riepilogoPerAliquota([
      { aliquotaIva: 10, totale: 800 },
      { aliquotaIva: 10, totale: 800 },
      { aliquotaIva: 22, totale: 1200 },
    ])
    expect(r).toEqual([
      { aliquota: 10, imponibile: 1600, imposta: 160 },
      { aliquota: 22, imponibile: 1200, imposta: 264 },
    ])
    // Somma delle imposte = quella del motore: PDF e Agenzia non divergono.
    expect(r.reduce((s, x) => s + x.imposta, 0)).toBe(424)
  })

  it('l’imposta si calcola per ALIQUOTA, non riga per riga (scarto 00421)', () => {
    // 5 righe da 10,11 al 22%: per riga darebbe 11,10, il ricalcolo SdI 11,12.
    const r = riepilogoPerAliquota(
      Array.from({ length: 5 }, () => ({ aliquotaIva: 22, totale: 10.11 })),
    )
    expect(r[0].imponibile).toBe(50.55)
    expect(r[0].imposta).toBe(11.12)
  })
})

// ── Il difetto trovato al ricontrollo del 12 ago ────────────────────────────
describe('IVA predefinita del documento e prestazione', () => {
  const voce = (description: string, unit_price: number, extra: Partial<VoceSplittabile> = {}) => ({
    description, quantity: 1, unit_price, discount_pct: null, vat_rate: 10, ...extra,
  })

  it('una voce con IVA VUOTA e default 22% NON è prestazione agevolata', () => {
    // Caldaia 2.000 marcata + materiali 800 con IVA lasciata «predefinita»
    // (= 22%): quei materiali NON stanno nel lavoro agevolato, e contarli
    // gonfiava la quota del bene al 10%.
    const out = espandiBeniSignificativi(
      [voce('Caldaia', 2000, { bene_significativo: true }), voce('Materiali', 800, { vat_rate: null })],
      'ordinario', 22,
    )
    // Prestazione = 0 → tutto il bene al 22%
    const al22 = out.filter((r) => r.vat_rate === 22)
    expect(al22.some((r) => r.description.includes('quota eccedente'))).toBe(true)
    expect(out.find((r) => r.description.includes('quota eccedente'))?.unit_price).toBe(2000)
  })

  it('con default 10% la voce a IVA vuota È prestazione', () => {
    const out = espandiBeniSignificativi(
      [voce('Caldaia', 2000, { bene_significativo: true }), voce('Posa', 800, { vat_rate: null })],
      'ordinario', 10,
    )
    expect(out.find((r) => r.description.includes('quota eccedente'))?.unit_price).toBe(1200)
  })
})

// ── Il VALORE del bene è il COSTO (23 set — circ. 15/E/2018, decisione Eli) ─
// La norma di interpretazione autentica (art. 1 c.19 L. 205/2017) esclude il
// mark-up dal valore del bene: rileva solo il costo «originario». I numeri del
// primo test sono l'ESEMPIO UFFICIALE della circolare (pagine 15-16).
describe('valore del bene = costo (unit_cost), non prezzo', () => {
  const bene = (unit_price: number, unit_cost: number | null, extra: Partial<VoceSplittabile> = {}): VoceSplittabile => ({
    description: 'Caldaia', quantity: 1, unit_price, discount_pct: null, vat_rate: 10,
    bene_significativo: true, unit_cost, ...extra,
  })
  const posa = (unit_price: number): VoceSplittabile => ({
    description: 'Manodopera', quantity: 1, unit_price, discount_pct: null, vat_rate: 10,
  })

  it('esempio ufficiale 15/E: 1.800 = bene 1.000 (costo) + manodopera 600 + mark-up 200', () => {
    // Il mark-up sta CON la manodopera, dalla parte agevolata.
    const d = dettaglioBeniSignificativi([posa(600), bene(1200, 1000)], 'ordinario', 22)
    expect(d?.valoreBeni).toBe(1000)
    expect(d?.valorePrestazione).toBe(800)
    expect(d?.imponibile10).toBe(1600)
    expect(d?.imponibile22).toBe(200)
    // IVA dell'esempio: 160 + 44 = 204 (col prezzo sarebbero stati 252)
    const rows = espandiBeniSignificativi([posa(600), bene(1200, 1000)], 'ordinario', 22)
    const iva = rows.reduce((s, r) => s + roundTo2(Number(r.total ?? r.unit_price) * Number(r.vat_rate) / 100), 0)
    expect(roundTo2(iva)).toBe(204)
    // Le due righe del bene sommano al suo PREZZO: il totale documento non cambia.
    const righeBene = rows.filter((r) => r.description.startsWith('Caldaia'))
    expect(roundTo2(righeBene.reduce((s, r) => s + Number(r.total ?? 0), 0))).toBe(1200)
  })

  it('COSTO ASSENTE → ripiego sul prezzo: identico al comportamento storico', () => {
    const senzaCosto = dettaglioBeniSignificativi([posa(600), bene(1200, null)], 'ordinario', 22)
    expect(senzaCosto?.valoreBeni).toBe(1200)
    expect(senzaCosto?.imponibile10).toBe(1200)
    expect(senzaCosto?.imponibile22).toBe(600)
    // Costo a zero = non indicato (un bene significativo gratis non esiste)
    const costoZero = dettaglioBeniSignificativi([posa(600), bene(1200, 0)], 'ordinario', 22)
    expect(costoZero?.valoreBeni).toBe(1200)
  })

  it('costo su UNO dei due beni: ripiego per-voce, mai tutto-o-niente', () => {
    const items = [posa(300), bene(900, 700), bene(400, null, { description: 'Sanitari' })]
    // B = 700 (costo caldaia) + 400 (prezzo sanitari, ripiego) = 1.100
    const d = dettaglioBeniSignificativi(items, 'ordinario', 22)
    expect(d?.valoreBeni).toBe(1100)
  })

  it('costo > prezzo (venduto in perdita): il costo resta il valore del bene', () => {
    // Infisso prezzo 800, costo 1.000, posa 600: C=1.400, B=1.000, P=400
    const d = dettaglioBeniSignificativi([posa(600), bene(800, 1000, { description: 'Infisso' })], 'ordinario', 22)
    expect(d?.valoreBeni).toBe(1000)
    expect(d?.imponibile10).toBe(800)
    expect(d?.imponibile22).toBe(600)
    // Le righe dell'infisso sommano comunque al suo prezzo (800)
    const rows = espandiBeniSignificativi([posa(600), bene(800, 1000, { description: 'Infisso' })], 'ordinario', 22)
    const righeInfisso = rows.filter((r) => r.description.startsWith('Infisso'))
    expect(roundTo2(righeInfisso.reduce((s, r) => s + Number(r.total ?? 0), 0))).toBe(800)
  })

  it('TETTO: l’eccedenza non supera mai il prezzo dei beni (sottocosto estremo)', () => {
    // Bene prezzo 300 costo 1.000, posa 100: B=1.000 > C=400. Senza tetto la
    // dicitura direbbe «al 22%: 1.000» su un documento da 400.
    const items = [posa(100), bene(300, 1000)]
    const d = dettaglioBeniSignificativi(items, 'ordinario', 22)
    expect(d?.imponibile22).toBe(300)
    expect(d?.imponibile10).toBe(100)
    // …e le righe raccontano la stessa cosa della dicitura.
    const rows = espandiBeniSignificativi(items, 'ordinario', 22)
    expect(roundTo2(rows.filter((r) => r.vat_rate === 22).reduce((s, r) => s + Number(r.total ?? r.unit_price), 0))).toBe(300)
    expect(roundTo2(rows.filter((r) => r.vat_rate === 10).reduce((s, r) => s + Number(r.total ?? r.unit_price), 0))).toBe(100)
  })

  it('più beni: l’eccedenza si ripartisce in proporzione al COSTO, residuo sull’ultima', () => {
    // C=1.600, B=1.050 (700+350), P=550 → 22% = 500
    const items = [posa(300), bene(900, 700), bene(400, 350, { description: 'Sanitari' })]
    const rows = espandiBeniSignificativi(items, 'ordinario', 22)
    expect(rows.find((r) => r.description === 'Caldaia (quota eccedente il valore della prestazione)')?.total).toBe(333.33)
    expect(rows.find((r) => r.description === 'Sanitari (quota eccedente il valore della prestazione)')?.total).toBe(166.67)
    // Ogni voce somma al suo prezzo, il 10% complessivo torna con la dicitura
    expect(roundTo2(rows.filter((r) => r.vat_rate === 10).reduce((s, r) => s + Number(r.total ?? r.unit_price), 0))).toBe(1100)
  })

  it('lo SCONTO della voce riduce il prezzo, MAI il costo', () => {
    // Caldaia listino 1.500 −20% = 1.200 venduti, costo 1.000: identico
    // all'esempio ufficiale — lo sconto è sul prezzo, il costo resta quello.
    const d = dettaglioBeniSignificativi(
      [posa(600), bene(1500, 1000, { discount_pct: 20 })], 'ordinario', 22,
    )
    expect(d?.valoreBeni).toBe(1000)
    expect(d?.imponibile22).toBe(200)
  })

  it('FORFETTARIO: null anche col costo presente', () => {
    expect(dettaglioBeniSignificativi([posa(600), bene(1200, 1000)], 'forfettario', 22)).toBeNull()
  })

  it('le righe prodotte NON portano il costo (difesa §B.2)', () => {
    const rows = espandiBeniSignificativi([posa(600), bene(1200, 1000)], 'ordinario', 22)
    for (const r of rows.filter((x) => x.description.includes('quota'))) {
      expect(r.unit_cost ?? null).toBeNull()
    }
  })

  it('il motore fiscale usa il costo: IVA 204 sull’esempio ufficiale', () => {
    const row = (description: string, unit_price: number, unit_cost: number | null, beneFlag = false) => ({
      id: description, document_id: 'd', sort_order: 0, description, unit: 'pz',
      quantity: 1, unit_price, discount_pct: null, vat_rate: 10, bonus_tipo: null,
      bene_significativo: beneFlag, unit_cost, total: 0, ai_generated: false, ai_confidence: null,
    })
    const f = calcolaDocumento(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- shape minima
      [row('Caldaia', 1200, 1000, true), row('Manodopera', 600, null)] as any,
      { fiscal_regime: 'ordinario', currency: 'EUR', doc_type: 'fattura' },
    )
    expect(f.subtotal).toBe(1800)
    expect(f.taxAmount).toBe(204)
    expect(f.total).toBe(2004)
  })
})

// ── A4 del ricontrollo: il flag stantio non deve più mordere ────────────────
describe('flag stantio — voce marcata ma non più al 10%', () => {
  it('una voce marcata al 22% NON viene splittata né conta come bene', () => {
    const items = [
      { description: 'Caldaia', quantity: 1, unit_price: 2000, discount_pct: null, vat_rate: 22, bene_significativo: true },
      { description: 'Posa', quantity: 1, unit_price: 500, discount_pct: null, vat_rate: 10 },
    ]
    // Nessuno split: la caldaia resta una riga al 22%, la posa al 10%.
    expect(espandiBeniSignificativi(items, 'ordinario', 22)).toBe(items)
  })

  it('e la dicitura di legge NON esce (era il caso della dichiarazione falsa)', () => {
    // B ≤ P col flag stantio: prima usciva «l'intero corrispettivo è al 10%»
    // accanto a un riepilogo che addebitava il 22%.
    expect(dettaglioBeniSignificativi(
      [
        { description: 'Caldaia', quantity: 1, unit_price: 400, discount_pct: null, vat_rate: 22, bene_significativo: true },
        { description: 'Posa', quantity: 1, unit_price: 500, discount_pct: null, vat_rate: 10 },
      ],
      'ordinario', 22,
    )).toBeNull()
  })
})
