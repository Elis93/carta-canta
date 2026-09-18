import { describe, it, expect } from 'vitest'
import { buildFatturaPaXml } from '@/lib/sdi/xml'
import { forfettarioCausale } from '@/lib/sdi/causale'
import type { SdiInvoice } from '@/lib/sdi/types'

// ⚖️ Bollo riaddebitato al cliente = RIGA in fattura (prescrizione scritta
// dello studio del commercialista, 18 set 2026): descrizione «Bollo», importo
// fisso 2,00 €, natura N2.2 per i forfettari e N2.1 (art. 15) per gli
// ordinari. Prima il bollo viaggiava SOLO come DatiBollo: era nel totale ma
// nessuna riga lo dichiarava.

function makeInvoice(overrides: Partial<SdiInvoice> = {}): SdiInvoice {
  return {
    numero: '001/2026',
    data: '2026-09-18',
    cedente: {
      denominazione: 'Elettrica Rossi',
      piva: '12345678903',
      codiceFiscale: null,
      indirizzo: 'Via Roma 1',
      cap: '20100',
      citta: 'Milano',
      provincia: 'MI',
      regimeFiscale: 'RF19',
      email: null,
    },
    cessionario: {
      denominazione: 'Mario Bianchi',
      piva: null,
      codiceFiscale: 'BNCMRA80A01F205X',
      indirizzo: 'Via Verdi 8',
      cap: '20121',
      citta: 'Milano',
      provincia: 'MI',
      codiceDestinatario: '0000000',
      pec: null,
    },
    righe: [{ descrizione: 'Rifacimento impianto', quantita: 1, prezzoUnitario: 100, totale: 100, aliquotaIva: 0 }],
    imponibile: 100,
    imposta: 0,
    totale: 102,
    bollo: 2,
    causale: forfettarioCausale(),
    ...overrides,
  }
}

/** Estrae il blocco DettaglioLinee della riga «Bollo» (o null se non c'è). */
function rigaBollo(xml: string): string | null {
  const m = xml.match(/<DettaglioLinee>(?:(?!<\/DettaglioLinee>)[\s\S])*<Descrizione>Bollo<\/Descrizione>[\s\S]*?<\/DettaglioLinee>/)
  return m ? m[0] : null
}

describe('XML FatturaPA — riga «Bollo» (riaddebito al cliente)', () => {
  it('forfettario: la riga «Bollo» esce a 2,00 € con natura N2.2', () => {
    const xml = buildFatturaPaXml(makeInvoice())
    const riga = rigaBollo(xml)
    expect(riga).not.toBeNull()
    expect(riga).toContain('<PrezzoUnitario>2.00</PrezzoUnitario>')
    expect(riga).toContain('<PrezzoTotale>2.00</PrezzoTotale>')
    expect(riga).toContain('<AliquotaIVA>0.00</AliquotaIVA>')
    expect(riga).toContain('<Natura>N2.2</Natura>')
  })

  it('forfettario: il riepilogo N2.2 COMPRENDE il bollo (00422: imponibile = somma righe)', () => {
    const xml = buildFatturaPaXml(makeInvoice())
    expect(xml).toContain('<ImponibileImporto>102.00</ImponibileImporto>')
    // un solo blocco di riepilogo: il bollo confluisce nell'N2.2, niente N2.1
    expect(xml.match(/<DatiRiepilogo>/g)).toHaveLength(1)
    expect(xml).not.toContain('N2.1')
  })

  it('il blocco DatiBollo RESTA (assolvimento virtuale dell’emittente)', () => {
    const xml = buildFatturaPaXml(makeInvoice())
    expect(xml).toContain('<BolloVirtuale>SI</BolloVirtuale>')
    expect(xml).toContain('<ImportoBollo>2.00</ImportoBollo>')
  })

  it('senza bollo: nessuna riga «Bollo», riepilogo invariato', () => {
    const xml = buildFatturaPaXml(makeInvoice({ bollo: 0, totale: 100 }))
    expect(rigaBollo(xml)).toBeNull()
    expect(xml).toContain('<ImponibileImporto>100.00</ImponibileImporto>')
    expect(xml).not.toContain('DatiBollo')
  })

  it('ordinario: natura N2.1 e riepilogo a sé con riferimento art. 15 DPR 633/1972', () => {
    const base = makeInvoice()
    const xml = buildFatturaPaXml(makeInvoice({
      cedente: { ...base.cedente, regimeFiscale: 'RF01' },
      righe: [{ descrizione: 'Lavoro', quantita: 1, prezzoUnitario: 100, totale: 100, aliquotaIva: 22 }],
      imposta: 22,
      totale: 124,
      causale: null,
    }))
    const riga = rigaBollo(xml)
    expect(riga).not.toBeNull()
    expect(riga).toContain('<Natura>N2.1</Natura>')
    // due riepiloghi: il 22% delle righe + il blocco N2.1 del bollo
    expect(xml.match(/<DatiRiepilogo>/g)).toHaveLength(2)
    expect(xml).toMatch(/<Natura>N2\.1<\/Natura>\s*<ImponibileImporto>2\.00<\/ImponibileImporto>\s*<Imposta>0\.00<\/Imposta>/)
    expect(xml).toContain('art. 15 DPR 633/1972')
    // il riepilogo del 22% resta intatto
    expect(xml).toContain('<Imposta>22.00</Imposta>')
  })

  it('la NumeroLinea della riga «Bollo» segue le righe vere', () => {
    const base = makeInvoice()
    const xml = buildFatturaPaXml(makeInvoice({
      righe: [
        ...base.righe,
        { descrizione: 'Materiale', quantita: 1, prezzoUnitario: 50, totale: 50, aliquotaIva: 0 },
      ],
      imponibile: 150,
      totale: 152,
    }))
    expect(rigaBollo(xml)).toContain('<NumeroLinea>3</NumeroLinea>')
  })

  it('con la ritenuta, la riga «Bollo» NON porta <Ritenuta>SI (è un’imposta, non un corrispettivo)', () => {
    const xml = buildFatturaPaXml(makeInvoice({
      ritenuta: { tipo: 'RT01', importo: 4, aliquota: 4, causale: 'W' },
    }))
    const riga = rigaBollo(xml)
    expect(riga).not.toBeNull()
    expect(riga).not.toContain('<Ritenuta>')
    // sulle righe vere invece c'è (00415)
    expect(xml).toContain('<Ritenuta>SI</Ritenuta>')
  })
})
