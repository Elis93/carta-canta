'use client'

import { Check, X } from 'lucide-react'
import { PASSWORD_RULES, isPasswordStrong, validatePasswordServer } from '@/lib/password'
import type { PasswordRule } from '@/lib/password'

// Le regole vivono in lib/password.ts (modulo neutro, senza 'use client'):
// le Server Actions le importano da lì. Qui le RI-esportiamo per i client
// component esistenti che importano da questo file.
export { PASSWORD_RULES, isPasswordStrong, validatePasswordServer }
export type { PasswordRule }

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
