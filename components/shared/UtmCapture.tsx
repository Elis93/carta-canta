'use client'

// Cattura i parametri UTM dal primo atterraggio (first-touch) e li conserva
// in sessionStorage: il form di registrazione li allega alla creazione
// dell'account. Serve a misurare le campagne (sponsorizzate) SENZA pixel
// né cookie di profilazione: le UTM non tracciano la persona, solo la fonte.

import { useEffect } from 'react'

export const UTM_STORAGE_KEY = 'cc_utm'

export function UtmCapture() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem(UTM_STORAGE_KEY)) return // first-touch: non sovrascrivere
      const params = new URLSearchParams(window.location.search)
      const utm: Record<string, string> = {}
      for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
        const v = params.get(key)
        if (v) utm[key] = v.slice(0, 100)
      }
      if (Object.keys(utm).length > 0) {
        sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(utm))
      }
    } catch { /* storage non disponibile */ }
  }, [])
  return null
}
