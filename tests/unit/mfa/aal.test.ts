import { describe, it, expect } from 'vitest'
import { aalDalToken, haTotpVerificato, mfaDaChiedere } from '@/lib/mfa/aal'

function jwt(payload: Record<string, unknown>): string {
  const b64 = (s: string) => Buffer.from(s).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${b64('{"alg":"HS256","typ":"JWT"}')}.${b64(JSON.stringify(payload))}.firma`
}

describe('haTotpVerificato', () => {
  it('true solo con un TOTP verificato', () => {
    expect(haTotpVerificato([{ factor_type: 'totp', status: 'verified' }])).toBe(true)
  })
  it('un TOTP in corso di attivazione (unverified) non conta', () => {
    expect(haTotpVerificato([{ factor_type: 'totp', status: 'unverified' }])).toBe(false)
  })
  it('un fattore di altro tipo non conta', () => {
    expect(haTotpVerificato([{ factor_type: 'phone', status: 'verified' }])).toBe(false)
  })
  it('lista vuota, null, undefined o spazzatura → false', () => {
    expect(haTotpVerificato([])).toBe(false)
    expect(haTotpVerificato(null)).toBe(false)
    expect(haTotpVerificato(undefined)).toBe(false)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- input volutamente malformato
    expect(haTotpVerificato([null as any, {}])).toBe(false)
  })
})

describe('aalDalToken', () => {
  it('legge aal1 e aal2 dal payload', () => {
    expect(aalDalToken(jwt({ aal: 'aal1', sub: 'x' }))).toBe('aal1')
    expect(aalDalToken(jwt({ aal: 'aal2', sub: 'x' }))).toBe('aal2')
  })
  it('regge il base64url senza padding e con caratteri unicode', () => {
    expect(aalDalToken(jwt({ aal: 'aal2', email: 'màrio@esempio.it', amr: [{ method: 'totp' }] }))).toBe('aal2')
  })
  it('token senza claim, valore strano, stringa non-JWT o vuota → null', () => {
    expect(aalDalToken(jwt({ sub: 'x' }))).toBeNull()
    expect(aalDalToken(jwt({ aal: 'aal3' }))).toBeNull()
    expect(aalDalToken('non-un-jwt')).toBeNull()
    expect(aalDalToken('a.@@@.c')).toBeNull()
    expect(aalDalToken('')).toBeNull()
    expect(aalDalToken(null)).toBeNull()
    expect(aalDalToken(undefined)).toBeNull()
  })
})

describe('mfaDaChiedere', () => {
  const verificato = [{ factor_type: 'totp', status: 'verified' }]
  it('TOTP verificato + token aal1 → SÌ (il caso di Eli: dopo «Esci» e nuovo login)', () => {
    expect(mfaDaChiedere({ factors: verificato, aal: 'aal1' })).toBe(true)
  })
  it('TOTP verificato + token aal2 → no (codice già dato in questa sessione)', () => {
    expect(mfaDaChiedere({ factors: verificato, aal: 'aal2' })).toBe(false)
  })
  it('nessun fattore → no, qualunque sia il token', () => {
    expect(mfaDaChiedere({ factors: [], aal: 'aal1' })).toBe(false)
    expect(mfaDaChiedere({ factors: undefined, aal: 'aal1' })).toBe(false)
  })
  it('attivazione a metà (unverified) → no', () => {
    expect(mfaDaChiedere({ factors: [{ factor_type: 'totp', status: 'unverified' }], aal: 'aal1' })).toBe(false)
  })
  it('claim illeggibile → no (fail-open dichiarato)', () => {
    expect(mfaDaChiedere({ factors: verificato, aal: null })).toBe(false)
  })
})
