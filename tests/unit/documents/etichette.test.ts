import { describe, it, expect } from 'vitest'
import { eventoLabel, badgeLabel, isFemminile } from '@/lib/documents/etichette'

// Nascono dal difetto segnalato da Eli il 10 ago: in Home → attività recente
// una NOTA DI CREDITO usciva con «Fatt.» davanti al numero. Tirando il filo,
// le due funzioni che scrivono lo stato accanto facevano lo stesso errore:
// decidevano il tipo con `docType === 'fattura'`, quindi la nota finiva nel
// ramo «tutto il resto» e prendeva le parole del preventivo.

describe('isFemminile — la concordanza', () => {
  it('fattura e nota di credito sono femminili, il preventivo no', () => {
    expect(isFemminile('fattura')).toBe(true)
    expect(isFemminile('nota_credito')).toBe(true)
    expect(isFemminile('preventivo')).toBe(false)
  })

  it('un tipo assente non diventa femminile per caso', () => {
    expect(isFemminile(null)).toBe(false)
    expect(isFemminile(undefined)).toBe(false)
  })
})

describe('eventoLabel — la riga di attività della Home', () => {
  it('la nota di credito ha il SUO nome, non quello del preventivo', () => {
    expect(eventoLabel('sent', 'nota_credito')).toBe('Nota di credito inviata')
    expect(eventoLabel('draft', 'nota_credito')).toBe('Bozza nota di credito')
    expect(eventoLabel('viewed', 'nota_credito')).toBe('Nota di credito visualizzata')
  })

  it('una nota di credito si ANNULLA, non si «rifiuta»', () => {
    expect(eventoLabel('rejected', 'nota_credito')).toBe('Nota di credito annullata')
    expect(eventoLabel('rejected', 'fattura')).toBe('Fattura annullata')
    expect(eventoLabel('rejected', 'preventivo')).toBe('Preventivo rifiutato')
  })

  it('solo la FATTURA si legge «pagata»: sulla nota il denaro torna indietro', () => {
    expect(eventoLabel('accepted', 'fattura')).toBe('Fattura pagata')
    expect(eventoLabel('accepted', 'nota_credito')).not.toContain('pagata')
    expect(eventoLabel('accepted', 'preventivo')).toBe('Preventivo accettato')
  })

  it('non cambia una virgola alle etichette di fattura e preventivo', () => {
    // Sentinella della rifattorizzazione: le due funzioni sono state spostate
    // qui dalla pagina della Home, e ciò che si leggeva prima deve restare.
    expect(eventoLabel('draft', 'fattura')).toBe('Bozza fattura')
    expect(eventoLabel('draft', 'preventivo')).toBe('Bozza preventivo')
    expect(eventoLabel('sent', 'fattura')).toBe('Fattura inviata')
    expect(eventoLabel('sent', 'preventivo')).toBe('Preventivo inviato')
    expect(eventoLabel('viewed', 'fattura')).toBe('Fattura visualizzata')
    expect(eventoLabel('viewed', 'preventivo')).toBe('Preventivo visualizzato')
    expect(eventoLabel('expired', 'fattura')).toBe('Fattura scaduta')
    expect(eventoLabel('expired', 'preventivo')).toBe('Preventivo scaduto')
  })

  it('uno stato sconosciuto ripiega sul nome del documento, non su una sigla', () => {
    expect(eventoLabel('boh', 'nota_credito')).toBe('Nota di credito')
  })
})

describe('badgeLabel — la pillola corta di mobile', () => {
  it('la nota annullata dice «Annullata», non «Rifiutato»', () => {
    expect(badgeLabel('rejected', 'nota_credito')).toBe('Annullata')
    expect(badgeLabel('rejected', 'fattura')).toBe('Annullata')
    expect(badgeLabel('rejected', 'preventivo')).toBe('Rifiutato')
  })

  it('«Pagata» resta solo sulla fattura', () => {
    expect(badgeLabel('accepted', 'fattura')).toBe('Pagata')
    expect(badgeLabel('accepted', 'nota_credito')).toBe('Accettata')
    expect(badgeLabel('accepted', 'preventivo')).toBe('Accettato')
  })

  it('gli stati senza genere restano come prima', () => {
    for (const t of ['preventivo', 'fattura', 'nota_credito']) {
      expect(badgeLabel('draft', t)).toBe('Bozza')
      expect(badgeLabel('sent', t)).toBe('Inviato')
      expect(badgeLabel('viewed', t)).toBe('Visto')
      expect(badgeLabel('expired', t)).toBe('Scaduto')
    }
  })
})
