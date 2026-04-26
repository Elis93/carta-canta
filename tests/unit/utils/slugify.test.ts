import { describe, it, expect } from 'vitest'
import { slugify } from '@/lib/utils'

// ── Funzione pura, zero mock ───────────────────────────────────────────────
//
// Pipeline interna di slugify:
//   1. toLowerCase()
//   2. trim()
//   3. /[\s]+/g       → '-'       (qualsiasi sequenza di spazi diventa un trattino)
//   4. /[^\w-]+/g     → ''        (\w = [a-zA-Z0-9_], accenti NON inclusi → rimossi)
//   5. /--+/g         → '-'       (trattini consecutivi collassati)
//   6. /^-+|-+$/g     → ''        (trattini iniziali/finali rimossi)
//
// NOTA: gli accenti italiani vengono RIMOSSI (non translitterati) perché \w
// non copre Unicode. I test documentano questo comportamento intenzionale.

describe('slugify', () => {

  // ── Casi base ────────────────────────────────────────────────────────────

  it('stringa semplice ASCII rimane invariata (lowercase)', () => {
    expect(slugify('idraulica')).toBe('idraulica')
  })

  it('converte in minuscolo', () => {
    expect(slugify('TUTTO MAIUSCOLO')).toBe('tutto-maiuscolo')
    expect(slugify('CamelCase')).toBe('camelcase')
  })

  it('sostituisce spazio singolo con trattino', () => {
    expect(slugify('mario rossi')).toBe('mario-rossi')
  })

  it('sostituisce spazi multipli con un solo trattino', () => {
    expect(slugify('mario   rossi')).toBe('mario-rossi')
    expect(slugify('a  b   c    d')).toBe('a-b-c-d')
  })

  it('rimuove spazi iniziali e finali prima di slugificare', () => {
    expect(slugify('  hello world  ')).toBe('hello-world')
    expect(slugify('  studio tecnico  ')).toBe('studio-tecnico')
  })

  it('preserva numeri', () => {
    expect(slugify('Studio 42')).toBe('studio-42')
    expect(slugify('123 Main Street')).toBe('123-main-street')
  })

  it('preserva underscore (fa parte di \\w)', () => {
    expect(slugify('hello_world')).toBe('hello_world')
  })

  // ── Accenti italiani (rimossi, non translitterati) ────────────────────

  it('rimuove è — "Caffè Milano" → "caff-milano"', () => {
    expect(slugify('Caffè Milano')).toBe('caff-milano')
  })

  it('rimuove à — "già" → "gi"', () => {
    expect(slugify('già')).toBe('gi')
  })

  it('rimuove é — "Café" → "caf"', () => {
    expect(slugify('Café')).toBe('caf')
  })

  it('rimuove ì ò ù — "Così" → "cos"', () => {
    expect(slugify('Così')).toBe('cos')
    expect(slugify('però')).toBe('per')
    expect(slugify('più')).toBe('pi')
  })

  it('nome tipico italiano con accento: "L\'Aquila Services" → "laquila-services"', () => {
    // apostrofo rimosso, nessuna contrazione
    expect(slugify("L'Aquila Services")).toBe('laquila-services')
  })

  // ── Caratteri speciali comuni nei nomi di aziende ─────────────────────

  it('rimuove & dalla ragione sociale', () => {
    expect(slugify('Mario & Luigi')).toBe('mario-luigi')
  })

  it('rimuove punti dalla ragione sociale (s.r.l., s.p.a., ecc.)', () => {
    expect(slugify('Rossi s.r.l.')).toBe('rossi-srl')
    expect(slugify('Bianchi S.p.A.')).toBe('bianchi-spa')
  })

  it('rimuove virgole, punti esclamativi, parentesi', () => {
    expect(slugify('Studio (Rossi)')).toBe('studio-rossi')
    expect(slugify('Ottimo!')).toBe('ottimo')
    expect(slugify('A, B, C')).toBe('a-b-c')
  })

  it('rimuove @, #, / e altri simboli', () => {
    expect(slugify('info@rossi.it')).toBe('inforossiit')
    expect(slugify('tag #uno')).toBe('tag-uno')
    expect(slugify('path/to/file')).toBe('pathtofile')
  })

  it('caso realistico: ragione sociale complessa', () => {
    expect(slugify('Mario Rossi & Figli s.r.l.')).toBe('mario-rossi-figli-srl')
    expect(slugify('Idraulica Bianchi S.p.A.')).toBe('idraulica-bianchi-spa')
  })

  // ── Trattini ──────────────────────────────────────────────────────────

  it('collassa trattini consecutivi a uno solo', () => {
    expect(slugify('hello--world')).toBe('hello-world')
    expect(slugify('a---b----c')).toBe('a-b-c')
  })

  it('rimuove trattini iniziali e finali', () => {
    expect(slugify('-hello-')).toBe('hello')
    expect(slugify('---hello---')).toBe('hello')
  })

  // ── Stringhe vuote e degeneri ─────────────────────────────────────────

  it('stringa vuota → stringa vuota', () => {
    expect(slugify('')).toBe('')
  })

  it('solo spazi → stringa vuota', () => {
    expect(slugify('   ')).toBe('')
  })

  it('solo caratteri speciali → stringa vuota', () => {
    expect(slugify('&&&')).toBe('')
    expect(slugify('...')).toBe('')
    expect(slugify('!@#$%')).toBe('')
  })

  it('solo trattini → stringa vuota', () => {
    expect(slugify('---')).toBe('')
  })

  it('caratteri speciali + spazi → stringa vuota', () => {
    expect(slugify('  & . !  ')).toBe('')
  })

  // ── Stringhe lunghe (no crash) ────────────────────────────────────────

  it('non crasha su stringhe molto lunghe', () => {
    const long = 'parola '.repeat(200).trim()   // 200 parole
    const result = slugify(long)
    expect(result).toContain('parola')
    expect(result).not.toContain(' ')
    expect(result.startsWith('-')).toBe(false)
    expect(result.endsWith('-')).toBe(false)
  })

  it('stringa con una sola lettera', () => {
    expect(slugify('A')).toBe('a')
    expect(slugify('z')).toBe('z')
  })
})
