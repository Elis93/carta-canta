import { describe, it, expect } from 'vitest'
import { statusesFromQuery, coreQuery } from '@/lib/documents/status-search'

// Stesse mappe delle liste (estratto)
const FATTURA_KW: Record<string, string | string[]> = {
  'bozza': 'draft', 'bozze': 'draft',
  'inviata': 'sent', 'inviato': 'sent', 'inviati': 'sent',
  'aperta': 'viewed', 'aperto': 'viewed',
  'pagata': 'accepted', 'pagato': 'accepted', 'pagati': 'accepted', 'pagamento': 'accepted',
  'annullata': 'rejected', 'annullato': 'rejected',
  'scaduta': 'expired', 'scaduto': 'expired',
}

describe('statusesFromQuery — ricerca per dicitura di stato (punto 10, 3 ago)', () => {
  it('parola singola esatta', () => {
    expect(statusesFromQuery('annullata', FATTURA_KW, 2)).toEqual(['rejected'])
  })

  it('dicitura composta "fattura annullata"', () => {
    expect(statusesFromQuery('fattura annullata', FATTURA_KW, 2)).toEqual(['rejected'])
  })

  it('dicitura composta "bozza fattura" (ordine inverso)', () => {
    expect(statusesFromQuery('bozza fattura', FATTURA_KW, 2)).toEqual(['draft'])
  })

  it('parte della dicitura: prefisso "annull"', () => {
    expect(statusesFromQuery('fattura annull', FATTURA_KW, 2)).toEqual(['rejected'])
  })

  it('plurale non in mappa: "annullate" matcha per stem', () => {
    expect(statusesFromQuery('fatture annullate', FATTURA_KW, 2)).toEqual(['rejected'])
  })

  it('due stati insieme → unione', () => {
    expect(statusesFromQuery('bozze annullate', FATTURA_KW, 2)?.sort()).toEqual(['draft', 'rejected'])
  })

  it('parola non-stato presente → null (è ricerca di testo)', () => {
    expect(statusesFromQuery('bozza mario', FATTURA_KW, 2)).toBeNull()
    expect(statusesFromQuery('rossi', FATTURA_KW, 2)).toBeNull()
  })

  it('solo parole generiche → null (nessun filtro)', () => {
    expect(statusesFromQuery('fattura', FATTURA_KW, 2)).toBeNull()
    expect(statusesFromQuery('il documento', FATTURA_KW, 2)).toBeNull()
  })

  it('prefisso sotto la soglia → null', () => {
    expect(statusesFromQuery('a', FATTURA_KW, 2)).toBeNull()
  })
})

describe('coreQuery — parole generiche rimosse per i check speciali', () => {
  it('"fattura modificata" → "modificata"', () => {
    expect(coreQuery('fattura modificata')).toBe('modificata')
  })
  it('"sdi" resta "sdi", "fatture sdi" → "sdi"', () => {
    expect(coreQuery('sdi')).toBe('sdi')
    expect(coreQuery('fatture sdi')).toBe('sdi')
  })
})
