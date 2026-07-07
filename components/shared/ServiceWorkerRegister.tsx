'use client'

// Registra il service worker (public/sw.js) solo in produzione, dopo il load.
// SW conservativo: network-first per le pagine (nessun contenuto vecchio),
// cache solo per file statici + pagina offline. Vedi public/sw.js.

import { useEffect } from 'react'

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

    const onLoad = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* registrazione fallita: l'app funziona comunque senza SW */
      })
    }

    window.addEventListener('load', onLoad)
    return () => window.removeEventListener('load', onLoad)
  }, [])

  return null
}
