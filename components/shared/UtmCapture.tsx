'use client'

// Cattura i parametri UTM dal primo atterraggio (first-touch) e li conserva
// in sessionStorage: il form di registrazione li allega alla creazione
// dell'account. Serve a misurare le campagne (sponsorizzate) SENZA pixel
// né cookie di profilazione: le UTM non tracciano la persona, solo la fonte.

import { useEffect } from 'react'

export const UTM_STORAGE_KEY = 'cc_utm'
// Invito inverso commercialista→artigiano: ?studio=<email dello studio>
export const STUDIO_STORAGE_KEY = 'cc_studio'

export function UtmCapture() {
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)

      if (!sessionStorage.getItem(UTM_STORAGE_KEY)) { // first-touch: non sovrascrivere
        const utm: Record<string, string> = {}
        for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
          const v = params.get(key)
          if (v) utm[key] = v.slice(0, 100)
        }
        if (Object.keys(utm).length > 0) {
          sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(utm))
        }
      }

      // Email dello studio che ha invitato (per suggerire il collegamento
      // in Impostazioni dopo la registrazione — il consenso resta all'artigiano)
      if (!sessionStorage.getItem(STUDIO_STORAGE_KEY)) {
        const studio = params.get('studio')
        if (studio && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(studio) && studio.length <= 200) {
          sessionStorage.setItem(STUDIO_STORAGE_KEY, studio.toLowerCase())
        }
      }
    } catch { /* storage non disponibile */ }
  }, [])
  return null
}
