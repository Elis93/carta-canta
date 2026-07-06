'use client'

// PERF (fase 3): driver.js (+ CSS) pesa ~35 KB e stava nel bundle di OGNI
// pagina via layout. Questo loader replica il gating del TourController
// (tour mai fatto / rilancio esplicito / fase intermedia in corso) e importa
// il motore del tutorial SOLO quando serve davvero — per tutti gli altri
// utenti il tutorial non viene nemmeno scaricato.

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

const TourController = dynamic(
  () => import('./TourController').then((m) => m.TourController),
  { ssr: false }
)

// Stesse chiavi di TourController (cc_tour_step / cc_tour_restart)
const STEP_KEY = 'cc_tour_step'
const RESTART_KEY = 'cc_tour_restart'

export function TourLoader({ tourDone }: { tourDone: boolean }) {
  const [active, setActive] = useState(false)

  useEffect(() => {
    if (active) return
    try {
      const restart = sessionStorage.getItem(RESTART_KEY) === '1'
      const step = sessionStorage.getItem(STEP_KEY)
      if (!tourDone || restart || step) setActive(true)
    } catch {
      // sessionStorage non disponibile → attiva solo se il tour non è mai stato fatto
      if (!tourDone) setActive(true)
    }
    // Nessuna dipendenza da pathname: "Rivedi il tutorial" fa location.href
    // → rimonta l'app, quindi il flag viene riletto comunque.
  }, [tourDone, active])

  if (!active) return null
  return <TourController tourDone={tourDone} />
}
