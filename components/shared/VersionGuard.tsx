'use client'

// ── Guardia anti "app vecchia" (bug Eli 18 lug: "Segna tutte come lette
// non fa nulla") ────────────────────────────────────────────────────────
// La PWA resta in memoria per giorni: il JS caricato è di una build vecchia
// e le sue server action non esistono più sul server nuovo → i tocchi
// falliscono IN SILENZIO. Al rientro in app (visibilitychange) si confronta
// la versione del client con quella del server:
// - nascosta a lungo (≥30 min, nessun lavoro in corso) → ricarica da sola;
// - nascosta da poco (possibile form a metà) → toast con bottone "Ricarica",
//   così non si perde mai quello che si stava scrivendo.

import { useEffect, useRef } from 'react'
import { toast } from 'sonner'

const AUTO_RELOAD_HIDDEN_MS = 30 * 60_000  // ≥30 min in background → reload diretto
const CHECK_THROTTLE_MS = 5 * 60_000       // max un controllo ogni 5 min

export function VersionGuard({ current }: { current: string }) {
  const hiddenAtRef = useRef<number | null>(null)
  const lastCheckRef = useRef(0)
  const promptedRef = useRef(false)

  useEffect(() => {
    if (!current || current === 'dev') return

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAtRef.current = Date.now()
        return
      }
      // Tornati in app: controlla la versione (throttled)
      const now = Date.now()
      if (now - lastCheckRef.current < CHECK_THROTTLE_MS) return
      lastCheckRef.current = now
      const hiddenFor = hiddenAtRef.current ? now - hiddenAtRef.current : 0

      fetch('/api/version', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((data: { v?: string } | null) => {
          if (!data?.v || data.v === 'dev' || data.v === current) return
          if (hiddenFor >= AUTO_RELOAD_HIDDEN_MS) {
            // In background da mezz'ora: nessun lavoro a metà da perdere
            window.location.reload()
          } else if (!promptedRef.current) {
            promptedRef.current = true
            toast.info("È disponibile una versione aggiornata dell'app.", {
              duration: 30_000,
              action: { label: 'Ricarica', onClick: () => window.location.reload() },
            })
          }
        })
        .catch(() => { /* offline o rete instabile: si riproverà al prossimo rientro */ })
    }

    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [current])

  return null
}
