// ── IBAN: normalizzazione, validazione (mod-97) e formattazione ────────────

/** Rimuove spazi e porta in maiuscolo */
export function normalizeIban(raw: string): string {
  return raw.replace(/\s+/g, '').toUpperCase()
}

/**
 * Validazione IBAN standard ISO 13616 (checksum mod-97).
 * Non verifica l'esistenza del conto — solo che il codice sia ben formato.
 */
export function isValidIban(raw: string): boolean {
  const iban = normalizeIban(raw)
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false

  // Sposta i primi 4 caratteri in coda e converte lettere in numeri (A=10 … Z=35)
  const rearranged = iban.slice(4) + iban.slice(0, 4)
  let remainder = 0
  for (const ch of rearranged) {
    const val = /[A-Z]/.test(ch) ? String(ch.charCodeAt(0) - 55) : ch
    for (const digit of val) {
      remainder = (remainder * 10 + Number(digit)) % 97
    }
  }
  return remainder === 1
}

/** Formatta a gruppi di 4 per la visualizzazione (IT60 X054 2811 …) */
export function formatIban(raw: string): string {
  return normalizeIban(raw).replace(/(.{4})/g, '$1 ').trim()
}
