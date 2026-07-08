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

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.posthog.com'

let initialized = false

export function PostHogProvider() {
  const pathname = usePathname()

  // Init una sola volta (solo con la chiave)
  useEffect(() => {
    if (!KEY || initialized) return
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
  }, [])

  // Pageview ad ogni cambio pathname (SPA navigation)
  useEffect(() => {
    if (!KEY || !initialized || !pathname) return
    posthog.capture('$pageview')
  }, [pathname])

  return null
}
