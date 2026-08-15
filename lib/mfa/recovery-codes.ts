// ============================================================
// Codici di recupero del 2FA (verifica in due passaggi).
//
// PERCHÉ: il TOTP di Supabase non prevede codici di recupero. Senza, chi perde
// o resetta il telefono con l'app Authenticator resta CHIUSO FUORI dal proprio
// account — con dentro le sue fatture. I codici di recupero sono la rete di
// sicurezza: alla configurazione se ne mostrano N, l'utente li salva (stampati
// o nel gestore password), e uno di essi permette di rientrare se perde il
// secondo fattore. Decisione di Eli (15 ago): codici di recupero (non il
// bypass via email), proposti al passaggio a Pro.
//
// ⚠️ Si SALVA solo l'IMPRONTA (SHA-256) del codice, mai il codice in chiaro:
// se il registro trapelasse, non deve contenere un secondo fattore utilizzabile.
// I codici sono ad alta entropia (40 bit) → SHA-256 senza sale è adeguato
// (niente attacco a dizionario possibile), e la ricerca è per impronta esatta.
// ============================================================

import { randomInt, createHash } from 'node:crypto'

// Alfabeto senza caratteri ambigui (niente 0/O, 1/I/L): si scrivono a mano.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

/** Un codice: due gruppi da 4 (es. "K7QP-3MRT"), 8 caratteri = ~40 bit. */
export function makeRecoveryCode(): string {
  let s = ''
  for (let i = 0; i < 8; i++) s += ALPHABET[randomInt(ALPHABET.length)]
  return `${s.slice(0, 4)}-${s.slice(4)}`
}

/** N codici distinti (default 10). */
export function generateRecoveryCodes(n = 10): string[] {
  const codes = new Set<string>()
  while (codes.size < n) codes.add(makeRecoveryCode())
  return [...codes]
}

/**
 * Normalizza ciò che l'utente digita: maiuscole, via spazi e trattini. Così
 * "k7qp3mrt", "K7QP-3MRT" e "k7qp 3mrt" contano tutti come lo stesso codice.
 */
export function normalizeRecoveryCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

/** Impronta SHA-256 del codice normalizzato — è ciò che si salva e si confronta. */
export function hashRecoveryCode(code: string): string {
  return createHash('sha256').update(normalizeRecoveryCode(code)).digest('hex')
}
