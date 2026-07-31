'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

// ============================================================
// NavTracker — registra il percorso in-app PRECEDENTE (sessionStorage,
// chiave 'cc_prev_path') a ogni cambio di rotta dentro (app).
// Serve alla freccia "indietro" (BackButton) per decidere se un
// router.back() resta dentro l'app: window.history.length è quasi
// sempre > 1 (conta anche la cronologia PRIMA di entrare nell'app e
// non diminuisce mai), quindi da solo non dice nulla — con un link
// diretto (notifica/WhatsApp) il back cieco USCIVA dall'app
// (feedback Eli 28 lug: "a volte funziona in modo errato").
// Montato una volta in app/(app)/layout.tsx.
// ============================================================

export function NavTracker() {
  const pathname = usePathname()
  const prevRef = useRef<string | null>(null)
  useEffect(() => {
    try {
      if (prevRef.current && prevRef.current !== pathname) {
        sessionStorage.setItem('cc_prev_path', prevRef.current)
      }
      // Pagina in-app CORRENTE: serve alle pagine PUBBLICHE (es. la vetrina
      // /professionisti, fuori da questo layout) per riportare l'utente alla
      // pagina dell'app da cui è uscito — all'uscita questo componente si
      // smonta e cc_prev_path resterebbe ferma un passo indietro.
      sessionStorage.setItem('cc_last_path', pathname)
    } catch { /* storage bloccato dal browser: la freccia userà il fallback */ }
    prevRef.current = pathname
  }, [pathname])
  return null
}
