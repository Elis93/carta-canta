// ============================================================
// Consenso cookie/analytics (ePrivacy + linee guida Garante).
// I cookie di statistica (PostHog) richiedono consenso PREVENTIVO: PostHog
// NON parte finché l'utente non accetta. Il consenso è memorizzato in
// localStorage (è la registrazione stessa del consenso, quindi ammessa senza
// consenso). Withdraw facile quanto l'accettazione: evento OPEN_SETTINGS.
//
// Il banner e tutta la logica si attivano SOLO se PostHog è configurato
// (NEXT_PUBLIC_POSTHOG_KEY): senza chiave non c'è nulla che imposti cookie di
// tracciamento → nessun banner, comportamento identico a oggi.
// ============================================================

export const CONSENT_KEY = 'cc_cookie_consent'
export const CONSENT_EVENT = 'cartacanta:consent-changed'
export const OPEN_SETTINGS_EVENT = 'cartacanta:open-cookie-settings'

export type Consent = 'granted' | 'denied'

// Chiave PostHog inlinata a build-time: se assente, l'analytics non esiste
// e il banner non deve comparire.
export const ANALYTICS_CONFIGURED = !!process.env.NEXT_PUBLIC_POSTHOG_KEY

/** Scelta corrente dell'utente, o null se non ha ancora deciso. */
export function getConsent(): Consent | null {
  if (typeof window === 'undefined') return null
  try {
    const v = window.localStorage.getItem(CONSENT_KEY)
    return v === 'granted' || v === 'denied' ? v : null
  } catch {
    return null
  }
}

/** Registra la scelta e notifica chi ascolta (PostHogProvider). */
export function setConsent(v: Consent): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(CONSENT_KEY, v)
  } catch {
    /* storage non disponibile: la scelta vale per la sessione via evento */
  }
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: { consent: v } }))
}

/** true solo se PostHog è configurato E l'utente ha dato il consenso. */
export function analyticsAllowed(): boolean {
  return ANALYTICS_CONFIGURED && getConsent() === 'granted'
}
