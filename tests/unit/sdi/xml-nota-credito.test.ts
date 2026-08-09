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
})
