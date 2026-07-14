'use client'

// ============================================================
// PostHog (analytics prodotto) — inizializzazione gated.
// Si attiva SOLO se NEXT_PUBLIC_POSTHOG_KEY è impostata: senza chiave
// non carica nulla e non traccia niente (privacy + zero costo).
// Cattura i pageview ad ogni cambio pagina (client-side) + autocapture
// dei click → il funnel di navigazione (registrazione → primo preventivo →
// invio) è ricostruibile in PostHog senza toccare i form.
// Host EU per la data residency.
// ============================================================

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import posthog from 'posthog-js'
import { getConsent, CONSENT_EVENT } from '@/lib/consent'

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.posthog.com'

let initialized = false

// Inizializza PostHog SOLO con chiave presente E consenso dato: prima del
// consenso non deve impostare cookie/localStorage né tracciare nulla.
function maybeInit() {
  if (!KEY || initialized || getConsent() !== 'granted') return
  posthog.init(KEY, {
    api_host: HOST,
    capture_pageview: false, // i pageview li mandiamo noi ad ogni cambio rotta
    capture_pageleave: true,
    autocapture: true,
    persistence: 'localStorage+cookie',
    // Crea profili-persona solo per gli utenti identificati (meno rumore/costo)
    person_profiles: 'identified_only',
  })
  initialized = true
  posthog.capture('$pageview') // primo pageview subito dopo l'accettazione
}

export function PostHogProvider() {
  const pathname = usePathname()

  // Init al mount se il consenso c'è già; altrimenti resta in attesa
  // dell'evento di consenso (accettazione dal banner, senza reload).
  useEffect(() => {
    maybeInit()
    function onConsentChange(e: Event) {
      const consent = (e as CustomEvent<{ consent?: string }>).detail?.consent
      if (consent === 'granted') maybeInit()
      else if (consent === 'denied' && initialized) {
        try { posthog.opt_out_capturing() } catch { /* già fermo */ }
      }
    }
    window.addEventListener(CONSENT_EVENT, onConsentChange)
    return () => window.removeEventListener(CONSENT_EVENT, onConsentChange)
  }, [])

  // Pageview ad ogni cambio pathname (SPA navigation), solo con consenso attivo
  useEffect(() => {
    if (!KEY || !initialized || !pathname || getConsent() !== 'granted') return
    posthog.capture('$pageview')
  }, [pathname])

  return null
}
