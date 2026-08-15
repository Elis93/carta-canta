import { describe, it, expect } from 'vitest'
import {
  makeRecoveryCode,
  generateRecoveryCodes,
  normalizeRecoveryCode,
  hashRecoveryCode,
} from '@/lib/mfa/recovery-codes'

describe('makeRecoveryCode', () => {
  it('formato XXXX-XXXX con alfabeto non ambiguo', () => {
    for (let i = 0; i < 50; i++) {
      const c = makeRecoveryCode()
      expect(c).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/)
      // niente caratteri ambigui
      expect(c).not.toMatch(/[01OIL]/)
    }
  })
})

describe('generateRecoveryCodes', () => {
  it('produce N codici DISTINTI', () => {
    const codes = generateRecoveryCodes(10)
    expect(codes).toHaveLength(10)
    expect(new Set(codes).size).toBe(10)
  })
  it('rispetta il numero richiesto', () => {
    expect(generateRecoveryCodes(6)).toHaveLength(6)
  })
})

describe('normalizeRecoveryCode', () => {
  it('maiuscole, senza trattini e spazi', () => {
    expect(normalizeRecoveryCode('k7qp-3mrt')).toBe('K7QP3MRT')
    expect(normalizeRecoveryCode('K7QP 3MRT')).toBe('K7QP3MRT')
    expect(normalizeRecoveryCode('  k7qp3mrt ')).toBe('K7QP3MRT')
  })
})

describe('hashRecoveryCode', () => {
  it('stabile e uguale per le varianti dello stesso codice', () => {
    const h1 = hashRecoveryCode('K7QP-3MRT')
    const h2 = hashRecoveryCode('k7qp3mrt')
    const h3 = hashRecoveryCode(' K7QP 3MRT ')
    expect(h1).toBe(h2)
    expect(h1).toBe(h3)
    expect(h1).toMatch(/^[a-f0-9]{64}$/)
  })
  it('diverso per codici diversi', () => {
    expect(hashRecoveryCode('K7QP-3MRT')).not.toBe(hashRecoveryCode('K7QP-3MRU'))
  })
  it('non contiene mai il codice in chiaro', () => {
    const code = 'K7QP-3MRT'
    expect(hashRecoveryCode(code)).not.toContain('K7QP')
  })
})
