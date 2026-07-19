'use client'

// ============================================================
// SwipeMonths — scorri con il dito sul grafico del Bilancio per cambiare
// mese (19 lug 2026, richiesta Eli). Trascinamento verso SINISTRA → mese
// successivo; verso DESTRA → mese precedente. Naviga con router.replace
// (come le frecce, così il tasto Indietro non impila ogni mese). Non
// blocca lo scroll verticale: la gesture si valuta solo al rilascio e
// scatta solo se il movimento è chiaramente orizzontale e ampio.
// ============================================================

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

export function SwipeMonths({
  prevHref,
  nextHref,
  children,
}: {
  prevHref: string
  nextHref: string | null
  children: React.ReactNode
}) {
  const router = useRouter()
  const start = useRef<{ x: number; y: number } | null>(null)

  // Prescarica i mesi adiacenti → cambio quasi istantaneo (come prefetch frecce)
  useEffect(() => {
    router.prefetch(prevHref)
    if (nextHref) router.prefetch(nextHref)
  }, [router, prevHref, nextHref])

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0]
    start.current = { x: t.clientX, y: t.clientY }
  }
  function onTouchEnd(e: React.TouchEvent) {
    const s = start.current
    start.current = null
    if (!s) return
    const t = e.changedTouches[0]
    const dx = t.clientX - s.x
    const dy = t.clientY - s.y
    // Swipe valido: orizzontale ampio (≥50px) e nettamente più orizzontale
    // che verticale (per non rubare lo scroll della pagina).
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return
    if (dx < 0) { if (nextHref) router.replace(nextHref) } // dito verso sinistra → mese dopo
    else router.replace(prevHref)                          // dito verso destra → mese prima
  }

  return (
    <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} style={{ touchAction: 'pan-y' }}>
      {children}
    </div>
  )
}
