import { describe, it, expect } from 'vitest'
import { statusesFromQuery, coreQuery, linkedFatturaQuery, sdiEsitoQuery, FATTURA_STATUS_KEYWORDS as FATTURA_KW, isNotaCreditoQuery } from '@/lib/documents/status-search'

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

describe('linkedFatturaQuery — ricerca "fattura collegata" nei PREVENTIVI (chiarimento punto 10)', () => {
  it('"fattura annullata" → preventivi con fattura collegata annullata', () => {
    expect(linkedFatturaQuery('fattura annullata')).toEqual({ statuses: ['rejected'] })
  })

  it('"bozza fattura" (ordine inverso) → fattura collegata in bozza', () => {
    expect(linkedFatturaQuery('bozza fattura')).toEqual({ statuses: ['draft'] })
  })

  it('"fattura" da sola → qualsiasi fattura collegata', () => {
    expect(linkedFatturaQuery('fattura')).toEqual({ statuses: null })
    expect(linkedFatturaQuery('con fattura collegata')).toEqual({ statuses: null })
  })

  it('plurali e prefissi: "fatture pagate", "fatt annull"', () => {
    expect(linkedFatturaQuery('fatture pagate')).toEqual({ statuses: ['accepted'] })
    expect(linkedFatturaQuery('fatt annull')).toEqual({ statuses: ['rejected'] })
  })

  it('senza la parola fattura → null (resta la ricerca normale)', () => {
    expect(linkedFatturaQuery('annullata')).toBeNull()
    expect(linkedFatturaQuery('bozza')).toBeNull()
  })

  it('"fattura caldaia" → null (è una ricerca di testo)', () => {
    expect(linkedFatturaQuery('fattura caldaia')).toBeNull()
  })
})

describe('sdiEsitoQuery — ricerca "sdi + esito" nella lista fatture (3 ago sera)', () => {
  it('"sdi" da sola → tutte le trasmesse', () => {
    expect(sdiEsitoQuery('sdi')).toEqual({ esiti: null })
    expect(sdiEsitoQuery('fatture sdi')).toEqual({ esiti: null })
  })

  it('"sdi consegnata" / "sdi scartate" → quell’esito', () => {
    expect(sdiEsitoQuery('sdi consegnata')).toEqual({ esiti: ['consegnata'] })
    expect(sdiEsitoQuery('sdi scartate')).toEqual({ esiti: ['scartata'] })
  })

  it('"sdi emessa" → mancata_consegna (dicitura della card)', () => {
    expect(sdiEsitoQuery('sdi emessa')).toEqual({ esiti: ['mancata_consegna'] })
  })

  it('prefissi: "sdi consegn", "sdi scart"', () => {
    expect(sdiEsitoQuery('sdi consegn')).toEqual({ esiti: ['consegnata'] })
    expect(sdiEsitoQuery('sdi scart')).toEqual({ esiti: ['scartata'] })
  })

  it('"sdi caldaia" → null (ricerca di testo); senza "sdi" → null', () => {
    expect(sdiEsitoQuery('sdi caldaia')).toBeNull()
    expect(sdiEsitoQuery('consegnata')).toBeNull()
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

describe('isNotaCreditoQuery — cercabile parziale o totale (Eli, 9 ago)', () => {
  it('trova la dicitura intera, con e senza «di»', () => {
    expect(isNotaCreditoQuery('nota di credito')).toBe(true)
    expect(isNotaCreditoQuery('nota credito')).toBe(true)
    expect(isNotaCreditoQuery('note di credito')).toBe(true)
  })

  it('trova i pezzi: basta digitarne un po’', () => {
    for (const q of ['nota', 'note', 'credito', 'cred', 'not', 'nota di cre', 'storno', 'td04']) {
      expect(isNotaCreditoQuery(q), q).toBe(true)
    }
  })

  it('«nc» vale per intero, non come pezzo di un’altra parola', () => {
    expect(isNotaCreditoQuery('nc')).toBe(true)
    // «nce» non è un pezzo di nessuna parola del vocabolario
    expect(isNotaCreditoQuery('nce')).toBe(false)
  })

  it('una parola FUORI dal vocabolario riporta alla ricerca normale', () => {
    // ⚠️ Senza questo, «nota caldaia» filtrerebbe le note di credito invece
    // di cercare «caldaia»: la ricerca ruberebbe una parola d’uso comune.
    expect(isNotaCreditoQuery('nota caldaia')).toBe(false)
    expect(isNotaCreditoQuery('caldaia')).toBe(false)
    expect(isNotaCreditoQuery('')).toBe(false)
  })

  it('le parole generiche non disturbano', () => {
    expect(isNotaCreditoQuery('documento nota di credito')).toBe(true)
  })
})
