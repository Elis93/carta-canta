'use client'

import { Check, X } from 'lucide-react'

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

interface PasswordStrengthProps {
  password: string
  /** Mostra i requisiti solo quando la password non è vuota */
  showWhenEmpty?: boolean
}

export function PasswordStrength({ password, showWhenEmpty = false }: PasswordStrengthProps) {
  if (!showWhenEmpty && password.length === 0) return null

  return (
    <ul className="mt-1.5 space-y-1">
      {PASSWORD_RULES.map((rule) => {
        const ok = rule.test(password)
        return (
          <li key={rule.label} className={`flex items-center gap-1.5 text-xs ${ok ? 'text-green-600' : 'text-muted-foreground'}`}>
            {ok
              ? <Check className="size-3 shrink-0 text-green-500" />
              : <X className="size-3 shrink-0 text-muted-foreground/60" />}
            {rule.label}
          </li>
        )
      })}
    </ul>
  )
}
