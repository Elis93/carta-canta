'use client'

// Link "Preferenze cookie" — riapre il banner di consenso (withdraw facile
// quanto l'accettazione). Compare SOLO se PostHog è configurato: senza
// analytics non c'è nulla da gestire.

import { ANALYTICS_CONFIGURED, OPEN_SETTINGS_EVENT } from '@/lib/consent'

export function CookiePreferencesLink({ className }: { className?: string }) {
  if (!ANALYTICS_CONFIGURED) return null
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_SETTINGS_EVENT))}
      className={className}
      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', color: 'inherit' }}
    >
      Preferenze cookie
    </button>
  )
}
