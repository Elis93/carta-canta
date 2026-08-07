'use client'

// PERF: come gli altri due loader — driver.js (motore + CSS) si scarica SOLO
// quando serve davvero, cioè se questa pagina ha una guida di sezione e non
// è ancora stata vista (o se l'utente l'ha chiesta da Account e dati).
//
// ⚠️ Il controllo sta QUI e non dentro il controller: se lo facesse il
// controller, il pacchetto arriverebbe comunque a ogni cambio pagina, che è
// esattamente ciò che questo file serve a evitare.

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import dynamic from 'next/dynamic'
import { SECTION_TOURS, seenKey, SECTION_TOUR_REQUEST } from './section-tours'

const SectionTourController = dynamic(
  () => import('./SectionTourController').then((m) => m.SectionTourController),
  { ssr: false }
)

export function SectionTourLoader() {
  const pathname = usePathname()
  const [active, setActive] = useState(false)

  useEffect(() => {
    if (active) return
    const entry = Object.entries(SECTION_TOURS).find(([, t]) => pathname.startsWith(t.path))
    if (!entry) return
    const [key] = entry
    try {
      if (sessionStorage.getItem(SECTION_TOUR_REQUEST) === key) { setActive(true); return }
      if (!localStorage.getItem(seenKey(key))) setActive(true)
    } catch { /* storage negato: nessuna guida, l'app funziona uguale */ }
  }, [pathname, active])

  if (!active) return null
  return <SectionTourController />
}
