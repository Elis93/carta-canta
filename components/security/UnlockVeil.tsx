'use client'

// Toglie il velo anti-lampo (`html.cc-locked`) sulle pagine FUORI dal gruppo
// (app) — /mfa, /onboarding — e sulla pagina d'errore (revisione 24 ago).
// Il velo lo scrive lo script inline di LockVeil al primo parse del layout
// (app); a rimuoverlo è normalmente AppLock. Ma se il layout REINDIRIZZA
// (gate 2FA → /mfa, workspace mancante → /onboarding) o LANCIA (error
// boundary), Next naviga in modo soft NELLO STESSO documento: AppLock non
// monta mai, la classe resta, e l'utente vede uno schermo navy muto per 10
// secondi (poi il messaggio «connessione lenta», che è quello sbagliato).
// Queste tre destinazioni sono legittime e sbloccate per definizione: chi
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
