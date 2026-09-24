import { describe, it, expect } from 'vitest'
import { buildFatturaPaXml } from '@/lib/sdi/xml'
import type { SdiInvoice } from '@/lib/sdi/types'

// Fattura di acconto elettronica (TD02) — Fase 2 acconti, 24 set 2026.
//
// Le regole dalle fonti del progetto (PROGETTO_ACCONTI §3.5):
//  · il tipo documento è TD02 — struttura identica alla fattura normale;
//  · NESSUN DatiFattureCollegate obbligatorio: quello è degli acconti visti
//    DAL SALDO (Fase 3) — il riferimento al preventivo sta nelle descrizioni;
//  · importi positivi, come ogni fattura.

function makeInvoice(overrides: Partial<SdiInvoice> = {}): SdiInvoice {
  return {
    numero: 'ACC 001/2026',
    data: '2026-09-24',
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
    righe: [{ descrizione: 'Acconto su rifacimento bagno — preventivo 012/2026 del 14/09/2026', quantita: 1, prezzoUnitario: 409.84, totale: 409.84, aliquotaIva: 22 }],
    imponibile: 409.84,
    imposta: 90.16,
    totale: 500,
    bollo: 0,
    causale: null,
    tipoDocumento: 'TD02',
    ...overrides,
  }
}

describe('buildFatturaPaXml — TD02 (fattura di acconto)', () => {
  it('esce con TipoDocumento TD02 e il numero col sezionale ACC', () => {
    const xml = buildFatturaPaXml(makeInvoice())
    expect(xml).toContain('<TipoDocumento>TD02</TipoDocumento>')
    expect(xml).toContain('<Numero>ACC 001/2026</Numero>')
  })

  it('NON pretende DatiFattureCollegate (quello è del saldo, Fase 3)', () => {
    const xml = buildFatturaPaXml(makeInvoice())
    expect(xml).not.toContain('<DatiFattureCollegate>')
  })

  it('gli importi restano positivi e il riferimento sta nella descrizione', () => {
    const xml = buildFatturaPaXml(makeInvoice())
    expect(xml).toContain('<PrezzoUnitario>409.84</PrezzoUnitario>')
    expect(xml).not.toContain('-409.84')
    expect(xml).toContain('preventivo 012/2026')
  })

  it('senza tipoDocumento resta la fattura normale TD01', () => {
    const xml = buildFatturaPaXml(makeInvoice({ tipoDocumento: undefined }))
    expect(xml).toContain('<TipoDocumento>TD01</TipoDocumento>')
  })
})
