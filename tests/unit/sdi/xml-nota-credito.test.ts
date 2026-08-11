import { describe, it, expect } from 'vitest'
import { buildFatturaPaXml, progressivoInvio } from '@/lib/sdi/xml'
import type { SdiInvoice } from '@/lib/sdi/types'

// Nota di credito elettronica (TD04) — 9 ago 2026.
//
// Le tre regole che vengono dalle istruzioni dell'Agenzia alla compilazione:
//  · il tipo di documento è TD04 (è il tipo, non il segno, a dire "storno");
//  · gli importi restano POSITIVI;
//  · `DatiFattureCollegate` dice QUALE fattura si sta stornando — senza, la
//    nota è formalmente valida ma orfana.

function makeInvoice(overrides: Partial<SdiInvoice> = {}): SdiInvoice {
  return {
    numero: '004/2026',
    data: '2026-08-09',
    cedente: {
      denominazione: 'Elettrica Rossi',
      piva: '12345678903',
      codiceFiscale: null,
      indirizzo: 'Via Roma 1',
      cap: '20100',
      citta: 'Milano',
      provincia: 'MI',
      regimeFiscale: 'RF01',
      email: null,
    },
    cessionario: {
      denominazione: 'Bianchi Srl',
      piva: '00743110157',
      codiceFiscale: null,
      indirizzo: 'Via Verdi 8',
      cap: '20121',
      citta: 'Milano',
      provincia: 'MI',
      codiceDestinatario: 'ABCDEFG',
      pec: null,
    },
    righe: [{ descrizione: 'Storno lavoro', quantita: 1, prezzoUnitario: 100, totale: 100, aliquotaIva: 22 }],
    imponibile: 100,
    imposta: 22,
    totale: 122,
    bollo: 0,
    causale: null,
    ...overrides,
  }
}

const notaCredito = (o: Partial<SdiInvoice> = {}) =>
  makeInvoice({
    numero: 'NC001/2026',
    tipoDocumento: 'TD04',
    fatturaCollegata: { numero: '004/2026', data: '2026-06-30' },
    ...o,
  })

describe('XML FatturaPA — nota di credito TD04', () => {
  it('una fattura normale resta TD01 e senza DatiFattureCollegate', () => {
    const xml = buildFatturaPaXml(makeInvoice())
    expect(xml).toContain('<TipoDocumento>TD01</TipoDocumento>')
    expect(xml).not.toContain('DatiFattureCollegate')
  })

  it('la nota di credito è TD04', () => {
    expect(buildFatturaPaXml(notaCredito())).toContain('<TipoDocumento>TD04</TipoDocumento>')
  })

  it('riporta numero e data della fattura stornata in DatiFattureCollegate', () => {
    const xml = buildFatturaPaXml(notaCredito())
    expect(xml).toContain('<IdDocumento>004/2026</IdDocumento>')
    expect(xml).toMatch(/<DatiFattureCollegate>[\s\S]*<Data>2026-06-30<\/Data>[\s\S]*<\/DatiFattureCollegate>/)
  })

  it('DatiFattureCollegate sta DOPO DatiGeneraliDocumento, dentro DatiGenerali', () => {
    const xml = buildFatturaPaXml(notaCredito())
    const fineDgd = xml.indexOf('</DatiGeneraliDocumento>')
    const collegate = xml.indexOf('<DatiFattureCollegate>')
    const fineDg = xml.indexOf('</DatiGenerali>')
    expect(fineDgd).toBeGreaterThan(-1)
    expect(collegate).toBeGreaterThan(fineDgd)
    expect(collegate).toBeLessThan(fineDg)
  })

  it('gli importi restano POSITIVI: nessun meno nell’XML', () => {
    const xml = buildFatturaPaXml(notaCredito())
    expect(xml).toContain('<ImportoTotaleDocumento>122.00</ImportoTotaleDocumento>')
    expect(xml).toContain('<ImponibileImporto>100.00</ImponibileImporto>')
    expect(xml).not.toMatch(/>-\d/)
  })

  it('il numero conserva «NC»: è una numerazione a sé, non la fattura 001/2026', () => {
    expect(buildFatturaPaXml(notaCredito())).toContain('<Numero>NC001/2026</Numero>')
  })
})

describe('progressivoInvio — univoco per trasmittente', () => {
  it('la nota NC001/2026 e la fattura 001/2026 NON hanno lo stesso progressivo', () => {
    // Prima toglieva le lettere: entrambe davano «12026», e il secondo file
    // sarebbe stato respinto dallo SdI come nome già usato.
    expect(progressivoInvio('NC001/2026')).not.toBe(progressivoInvio('001/2026'))
  })

  it('resta nei 10 caratteri alfanumerici del tracciato', () => {
    for (const n of ['001/2026', 'NC001/2026', 'NC999/2026', '123/2026']) {
      const p = progressivoInvio(n)
      expect(p).toMatch(/^[A-Z0-9]{1,10}$/)
    }
  })

  it('non torna mai vuoto, nemmeno con un numero senza cifre né lettere', () => {
    expect(progressivoInvio('///')).toBe('00001')
  })

  // Eli, 10 ago: il sezionale si scrive staccato («NC 001/2026»).
  it('lo spazio del sezionale non cambia il progressivo né rompe il tracciato', () => {
    expect(progressivoInvio('NC 001/2026')).toBe(progressivoInvio('NC001/2026'))
    expect(progressivoInvio('NC 001/2026')).toMatch(/^[A-Z0-9]{1,10}$/)
    // …e resta comunque distinto da quello della fattura pari numero.
    expect(progressivoInvio('NC 001/2026')).not.toBe(progressivoInvio('001/2026'))
  })
})

describe('XML — il sezionale scritto staccato («NC 001/2026»)', () => {
  it('arriva nel campo Numero esattamente com\u2019è', () => {
    // Il campo `Numero` è String20Type — `xs:normalizedString` con pattern
    // `(\\p{IsBasicLatin}{1,20})`: lo spazio (U+0020) è dentro Basic Latin,
    // quindi è valido. Il vincolo di contenuto è il controllo 00425 (almeno
    // una cifra), e le cifre ci sono.
    const xml = buildFatturaPaXml(notaCredito({ numero: 'NC 001/2026' }))
    expect(xml).toContain('<Numero>NC 001/2026</Numero>')
    expect(xml).toContain('<TipoDocumento>TD04</TipoDocumento>')
  })

  it('sta nei 20 caratteri e contiene almeno una cifra (controllo 00425)', () => {
    const numero = 'NC 001/2026'
    expect(numero.length).toBeLessThanOrEqual(20)
    expect(/\d/.test(numero)).toBe(true)
    // Nessun carattere fuori dal blocco Basic Latin.
    expect(/^[\x00-\x7F]+$/.test(numero)).toBe(true)
  })

  it('il riferimento alla fattura stornata resta quello della FATTURA', () => {
    // Lo spazio è del sezionale della nota, non del numero della fattura.
    const xml = buildFatturaPaXml(notaCredito({ numero: 'NC 001/2026' }))
    expect(xml).toContain('<IdDocumento>004/2026</IdDocumento>')
  })
})


describe('Quantita e PrezzoUnitario — i decimali veri (controllo 00423)', () => {
  it('una quantità a 3 decimali NON viene troncata a 2', () => {
    // «0,125 ore × 80 €»: con toFixed(2) l'XML dichiarava Quantita 0.13, e lo
    // SdI ricontrolla PrezzoTotale = PrezzoUnitario × Quantita con tolleranza
    // di 1-2 centesimi: 0.13 × 80 = 10,40 contro 10,00 → SCARTO 00423.
    // Il tracciato ammette da 2 a 8 decimali: si dichiara il valore vero.
    const xml = buildFatturaPaXml(makeInvoice({
      righe: [{ descrizione: 'Manodopera', quantita: 0.125, prezzoUnitario: 80, totale: 10, aliquotaIva: 22 }],
      imponibile: 10, imposta: 2.2, totale: 12.2,
    }))
    expect(xml).toContain('<Quantita>0.125</Quantita>')
    expect(xml).toContain('<PrezzoUnitario>80.00</PrezzoUnitario>')
    expect(xml).toContain('<PrezzoTotale>10.00</PrezzoTotale>')
  })

  it('le quantità intere restano nel formato minimo a 2 decimali del tracciato', () => {
    const xml = buildFatturaPaXml(makeInvoice({
      righe: [{ descrizione: 'Caldaia', quantita: 1, prezzoUnitario: 100, totale: 100, aliquotaIva: 22 }],
    }))
    expect(xml).toContain('<Quantita>1.00</Quantita>')
  })
})

// ── Nota di DEBITO (TD05) — 11 ago 2026 ────────────────────────────────────
// La gemella obbligatoria (art. 26 c.1): stessa struttura, stesso riferimento
// alla fattura, importi POSITIVI — cambia solo il tipo di documento.
describe('nota di debito — TD05', () => {
  it('il tipo è TD05, non TD04 né TD01', () => {
    const xml = buildFatturaPaXml(makeInvoice({
      tipoDocumento: 'TD05',
      fatturaCollegata: { numero: '012/2026', data: '2026-07-02' },
    }))
    expect(xml).toContain('<TipoDocumento>TD05</TipoDocumento>')
    expect(xml).not.toContain('TD04')
    expect(xml).not.toContain('<TipoDocumento>TD01</TipoDocumento>')
  })

  it('porta il riferimento alla fattura integrata', () => {
    const xml = buildFatturaPaXml(makeInvoice({
      tipoDocumento: 'TD05',
      fatturaCollegata: { numero: '012/2026', data: '2026-07-02' },
    }))
    expect(xml).toContain('<DatiFattureCollegate>')
    expect(xml).toContain('<IdDocumento>012/2026</IdDocumento>')
    expect(xml).toContain('<Data>2026-07-02</Data>')
  })

  it('gli importi restano POSITIVI: è il tipo a dire che si integra', () => {
    const xml = buildFatturaPaXml(makeInvoice({
      tipoDocumento: 'TD05',
      fatturaCollegata: { numero: '012/2026', data: '2026-07-02' },
    }))
    expect(xml).not.toContain('>-')
  })
})
