// ============================================================
// Analytics prodotto (PostHog) — helper di cattura eventi.
// Gated: senza NEXT_PUBLIC_POSTHOG_KEY è un no-op totale.
// Da chiamare SOLO da componenti client (posthog-js è browser-only).
// ============================================================

import posthog from 'posthog-js'
import { analyticsAllowed } from '@/lib/consent'

/** Cattura un evento se PostHog è configurato E l'utente ha dato il consenso;
 *  altrimenti non fa nulla (nessun evento prima del consenso). */
export function phCapture(event: string, props?: Record<string, unknown>): void {
  if (typeof window === 'undefined' || !analyticsAllowed()) return
  try {
    posthog.capture(event, props)
  } catch {
    /* posthog non inizializzato / errore → ignora */
  }
}
