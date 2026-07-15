'use client'

// PERF: come TourLoader, ma per i MINI-TOUR della checklist. Il motore
// driver.js viene scaricato SOLO se c'è una micro-guida in attesa
// (sessionStorage cc_minitour, scritto da CompleteProfileCard).
// Dipende dal pathname: l'innesco avviene con navigazione client-side,
// senza remount dell'app.

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import dynamic from 'next/dynamic'

const MiniTourController = dynamic(
  () => import('./MiniTourController').then((m) => m.MiniTourController),
  { ssr: false }
)

export function MiniTourLoader() {
  const pathname = usePathname()
  const [active, setActive] = useState(false)

  useEffect(() => {
    if (active) return
    try {
      if (sessionStorage.getItem('cc_minitour')) setActive(true)
    } catch { /* sessionStorage non disponibile → niente mini-tour */ }
  }, [pathname, active])

  if (!active) return null
  return <MiniTourController />
}
