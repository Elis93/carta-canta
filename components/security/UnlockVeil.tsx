'use client'

// Toglie il velo anti-lampo (`html.cc-locked`) sulle pagine FUORI dal gruppo
// (app) — /mfa, /onboarding — e sulle pagine d'errore (revisione 24 ago).
// Il velo lo scrive lo script inline di LockVeil al primo parse del layout
// (app); a rimuoverlo è normalmente AppLock. Ma se il layout REINDIRIZZA
// (gate 2FA → /mfa, workspace mancante → /onboarding) o LANCIA, AppLock non
// monta mai, la classe resta, e l'utente vede uno schermo navy muto per 10
// secondi (poi il messaggio «connessione lenta», che è quello sbagliato).
// ⚠️ L'errore lanciato dal LAYOUT (app) risale ad app/error.tsx (un error.tsx
// non cattura gli errori del layout del proprio segmento): il velo va tolto
// LÌ e in global-error.tsx; il mount in (app)/error.tsx copre gli errori di
// pagina ed è ridondante ma innocuo (lì AppLock resta montato).
// Queste destinazioni sono legittime e sbloccate per definizione: chi
// arriva su /mfa deve VEDERE il modulo del codice, non un velo.

import { useLayoutEffect } from 'react'

export function UnlockVeil() {
  useLayoutEffect(() => {
    try {
      document.documentElement.classList.remove('cc-locked')
      document.getElementById('cc-lock-fallback')?.remove()
    } catch { /* niente */ }
  }, [])
  return null
}
