import { describe, it, expect } from 'vitest'
import { docTypeLabel, docTypePath, formatDocNumber, stripPrefissoLegacy } from '@/lib/utils'

// Nascono da un difetto vero (9 ago): mezzo repo scriveva
// `doc_type === 'fattura' ? 'Fattura' : 'Preventivo'`. Con l'arrivo delle note
// di credito, quel "per esclusione" chiamava una NOTA DI CREDITO «Preventivo»
// e la mandava su /preventivi/{id}, cioè su una pagina "non trovato".

describe('docTypeLabel — come si chiama un documento', () => {
  it('dà a ogni tipo il suo nome', () => {
    expect(docTypeLabel('preventivo')).toBe('Preventivo')
    expect(docTypeLabel('fattura')).toBe('Fattura')
    expect(docTypeLabel('nota_credito')).toBe('Nota di credito')
  })

  it('una nota di credito NON si chiama «Preventivo»', () => {
    expect(docTypeLabel('nota_credito')).not.toBe('Preventivo')
  })
})

describe('docTypePath — dove vive un documento', () => {
  it('la nota di credito sta fra le Fatture, non fra i Preventivi', () => {
    expect(docTypePath('nota_credito')).toBe('fatture')
    expect(docTypePath('fattura')).toBe('fatture')
    expect(docTypePath('preventivo')).toBe('preventivi')
  })

  it('un tipo sconosciuto o assente non finisce fra le fatture', () => {
    expect(docTypePath(null)).toBe('preventivi')
    expect(docTypePath(undefined)).toBe('preventivi')
  })
})

describe('formatDocNumber — il sezionale NC non si perde', () => {
  it('tiene «NC» e non antepone «Fatt.» a una nota di credito', () => {
    expect(formatDocNumber('NC001/2026', 'nota_credito')).toBe('NC001/2026')
  })

  it('toglie ancora i prefissi storici Prev/Fatt', () => {
    expect(formatDocNumber('Prev001/2026', 'preventivo')).toBe('001/2026')
    expect(formatDocNumber('Fatt001/2026', 'fattura')).toBe('Fatt. 001/2026')
  })
})

describe('stripPrefissoLegacy — il taglio che NON mangia il sezionale', () => {
  it('toglie i prefissi storici Prev/Fatt', () => {
    expect(stripPrefissoLegacy('Prev001/2026')).toBe('001/2026')
    expect(stripPrefissoLegacy('Fatt014/2026')).toBe('014/2026')
  })

  it('NON tocca «NC»: è il numero vero della nota, non una decorazione', () => {
    // Il difetto del 9 ago: il campo del form si inizializzava con un taglio
    // generico `^[A-Za-z]+` e veniva RISALVATO nel database — la nota di
    // credito perdeva l'NC e finiva col numero di una fattura esistente.
    expect(stripPrefissoLegacy('NC001/2026')).toBe('NC001/2026')
  })

  it('lascia intatto un numero senza prefisso', () => {
    expect(stripPrefissoLegacy('001/2026')).toBe('001/2026')
  })
})
