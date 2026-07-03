// Regole password condivise client + server.
// ⚠️ Questo modulo NON deve avere 'use client': viene chiamato dentro le Server Actions
// (signup, reset password). Importare funzioni da un modulo client e chiamarle sul server
// lancia un'eccezione a runtime in Next.js 16 (era la causa del crash alla registrazione).

export interface PasswordRule {
  label: string
  test: (pw: string) => boolean
}

export const PASSWORD_RULES: PasswordRule[] = [
  { label: 'Almeno 8 caratteri',        test: (pw) => pw.length >= 8 },
  { label: 'Una lettera maiuscola',      test: (pw) => /[A-Z]/.test(pw) },
  { label: 'Una lettera minuscola',      test: (pw) => /[a-z]/.test(pw) },
  { label: 'Un numero',                  test: (pw) => /[0-9]/.test(pw) },
  { label: 'Un simbolo (!@#$%...)',      test: (pw) => /[^A-Za-z0-9]/.test(pw) },
]

/** Restituisce true solo se TUTTI i requisiti sono soddisfatti */
export function isPasswordStrong(pw: string): boolean {
  return PASSWORD_RULES.every((r) => r.test(pw))
}

/** Helper lato server: stessa logica — importabile nelle Server Actions */
export function validatePasswordServer(pw: string): string | null {
  if (!PASSWORD_RULES[0].test(pw)) return 'La password deve avere almeno 8 caratteri.'
  if (!PASSWORD_RULES[1].test(pw)) return 'La password deve contenere almeno una lettera maiuscola.'
  if (!PASSWORD_RULES[2].test(pw)) return 'La password deve contenere almeno una lettera minuscola.'
  if (!PASSWORD_RULES[3].test(pw)) return 'La password deve contenere almeno un numero.'
  if (!PASSWORD_RULES[4].test(pw)) return 'La password deve contenere almeno un simbolo speciale (!@#$%...).'
  return null
}
