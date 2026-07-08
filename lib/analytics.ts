// ============================================================
// Analytics prodotto (PostHog) — helper di cattura eventi.
// Gated: senza NEXT_PUBLIC_POSTHOG_KEY è un no-op totale.
// Da chiamare SOLO da componenti client (posthog-js è browser-only).
// ============================================================

import posthog from 'posthog-js'

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY

/** Cattura un evento se PostHog è configurato; altrimenti non fa nulla. */
export function phCapture(event: string, props?: Record<string, unknown>): void {
  if (typeof window === 'undefined' || !KEY) return
  try {
    posthog.capture(event, props)
  } catch {
    /* posthog non inizializzato / errore → ignora */
  }
}
