'use client'

// ── Precaricamento in background delle pagine (Eli 15 ago, #2) ──────────────
//
// PERCHÉ: "il caricamento delle pagine risulta abbastanza lento". Le pagine
// sono dinamiche (interrogano il DB a ogni apertura): la PRIMA volta si aspetta
// il server. Scaldando in anticipo la loro risposta (RSC) mentre l'artigiano
// guarda la pagina che ha già aperto, il cambio pagina diventa quasi istantaneo.
//
// ⚠️ SENZA rallentare la pagina in uso: il precaricamento parte solo a TEMPO
// MORTO (requestIdleCallback), UNA rotta per volta, e dopo un attimo dal
// montaggio. Rispetta il risparmio dati e l'assenza di rete. Una volta sola per
// sessione (guardia a livello di modulo): non riparte a ogni navigazione.
//
// Ondate: ① la barra in basso + le mete della Home; ② il resto di «Altro» e le
// pagine adiacenti. Il tutto a bassa priorità.

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'

// ① Barra in basso + mete dirette dalla Home (le più probabili subito)
const WAVE1 = [
  '/dashboard', '/preventivi', '/fatture', '/altro',
  '/preventivi/scadenze', '/fatture/scadenze', '/fatture/da-trasmettere',
]
// ② Il resto di «Altro» e le pagine di uso frequente
const WAVE2 = [
  '/lavori', '/calendario', '/sopralluoghi', '/clienti', '/catalogo',
  '/bilancio', '/farti-trovare', '/richieste', '/recensioni',
  '/impostazioni', '/account', '/abbonamento',
  '/altro/clienti-appuntamenti', '/altro/strumenti', '/altro/aiuto-novita',
  '/preventivi/nuovo', '/fatture/nuovo', '/sopralluoghi/nuovo',
]

let warmed = false // una volta per sessione

export function RoutePrefetcher() {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (warmed) return
    try {
      // Risparmio dati o offline → non scaldare niente.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- navigator.connection non è nei tipi standard
      const conn = (navigator as any).connection
      if (conn?.saveData) return
      if (navigator.onLine === false) return
    } catch { /* ambienti senza navigator: prosegui */ }
    warmed = true

    const routes = [...WAVE1, ...WAVE2].filter((r) => r !== pathname)
    let i = 0
    const idle = (cb: () => void) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- requestIdleCallback non è nei tipi standard
      const ric = (window as any).requestIdleCallback
      if (typeof ric === 'function') ric(cb, { timeout: 2500 })
      else setTimeout(cb, 250)
    }
    const step = () => {
      if (i >= routes.length) return
      try { router.prefetch(routes[i]) } catch { /* rotta non prefetchabile: pazienza */ }
      i++
      idle(step) // la prossima, a tempo morto
    }
    // Un attimo di respiro: la pagina corrente finisce di montarsi per prima.
    const t = window.setTimeout(() => idle(step), 900)
    return () => window.clearTimeout(t)
  }, [router, pathname])

  return null
}
