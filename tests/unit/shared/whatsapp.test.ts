import { describe, it, expect } from 'vitest'
import { normalizePhoneForWhatsApp, whatsappUtilizzabile } from '@/lib/whatsapp'

// wa.me legge SEMPRE il numero come internazionale. Senza prefisso non
// indovina il paese: mostrare il bottone in quel caso significa mandare
// l'artigiano su una pagina d'errore di WhatsApp davanti al cliente.

describe('normalizePhoneForWhatsApp', () => {
  it('mette il 39 ai mobili italiani salvati senza prefisso', () => {
    expect(normalizePhoneForWhatsApp('3331234567')).toBe('393331234567')
    expect(normalizePhoneForWhatsApp('333 123 4567')).toBe('393331234567')
  })

  it('toglie il + e gli 00 lasciando il prefisso del paese', () => {
    expect(normalizePhoneForWhatsApp('+41 79 123 45 67')).toBe('41791234567')
    expect(normalizePhoneForWhatsApp('0041791234567')).toBe('41791234567')
    expect(normalizePhoneForWhatsApp('+39 333 1234567')).toBe('393331234567')
  })
})

describe('whatsappUtilizzabile', () => {
  it('accetta i numeri STRANIERI col prefisso internazionale', () => {
    expect(whatsappUtilizzabile('+41 79 123 45 67')).toBe(true)   // Svizzera
    expect(whatsappUtilizzabile('0041791234567')).toBe(true)
    expect(whatsappUtilizzabile('+33 6 12 34 56 78')).toBe(true)  // Francia
    expect(whatsappUtilizzabile('+49 151 12345678')).toBe(true)   // Germania
  })

  it('accetta i mobili italiani anche senza prefisso', () => {
    expect(whatsappUtilizzabile('3331234567')).toBe(true)
    expect(whatsappUtilizzabile('+39 333 1234567')).toBe(true)
  })

  it('RIFIUTA i numeri stranieri senza prefisso: il paese non è indovinabile', () => {
    // Mobile svizzero scritto all'italiana: senza +41 wa.me lo leggerebbe
    // come un numero di un altro paese → chat inesistente.
    expect(whatsappUtilizzabile('079 123 45 67')).toBe(false)
  })

  it('RIFIUTA i fissi italiani: per loro resta "Chiama"', () => {
    expect(whatsappUtilizzabile('045 812345')).toBe(false)
    expect(whatsappUtilizzabile('02 1234567')).toBe(false)
  })

  it('regge i valori vuoti e le sciocchezze senza esplodere', () => {
    expect(whatsappUtilizzabile(null)).toBe(false)
    expect(whatsappUtilizzabile(undefined)).toBe(false)
    expect(whatsappUtilizzabile('')).toBe(false)
    expect(whatsappUtilizzabile('boh')).toBe(false)
    expect(whatsappUtilizzabile('123')).toBe(false)          // troppo corto
    expect(whatsappUtilizzabile('+1234567890123456')).toBe(false) // troppo lungo
  })
})
