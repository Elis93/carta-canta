'use client'

// ============================================================
// SectionTourController — apre la guida della sezione in cui ti trovi.
//
// Si attiva in due casi:
//  · PRIMA VISITA a una sezione che ha una guida (una volta per dispositivo);
//  · RILANCIO volontario da Account e dati.
//
// ⚠️ Non parte mai sopra un altro tour: driver.js mette `driver-active` sul
// body, e due overlay sovrapposti bloccherebbero la pagina.
//
// ⚠️ Aspetta che l'elemento del primo passo sia DAVVERO in pagina (fino a 8s):
// le pagine arrivano in streaming e con loading.tsx, e senza attesa la guida
// partirebbe puntando al vuoto. Se dopo 8 secondi non c'è, rinuncia in
// silenzio — meglio nessuna guida che una guida che indica il nulla.
// ============================================================

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { driver, type Driver, type DriveStep } from 'driver.js'
import 'driver.js/dist/driver.css'
import { SECTION_TOURS, seenKey, SECTION_TOUR_REQUEST } from './section-tours'

function visibleEl(selector: string): Element | undefined {
  for (const el of Array.from(document.querySelectorAll(selector))) {
    const r = (el as HTMLElement).getBoundingClientRect()
    if (r.width > 0 && r.height > 0) return el
  }
  return undefined
}

export function SectionTourController() {
  const pathname = usePathname()
  const driverRef = useRef<Driver | null>(null)

  useEffect(() => {
    if (driverRef.current) return

    // Quale guida compete a questa pagina? Il confronto è sul prefisso, così
    // /bilancio?y=2026 resta la sezione Bilancio.
    const entry = Object.entries(SECTION_TOURS).find(([, t]) => pathname.startsWith(t.path))
    if (!entry) return
    const [key, tour] = entry

    // Rilancio esplicito da Account e dati: ha la precedenza e ignora il segno.
    let richiesta = false
    try {
      richiesta = sessionStorage.getItem(SECTION_TOUR_REQUEST) === key
      if (richiesta) sessionStorage.removeItem(SECTION_TOUR_REQUEST)
    } catch { /* storage negato: si comporta come "nessuna richiesta" */ }

    if (!richiesta) {
      // Prima visita? Il segno vive in localStorage: una volta sola per
      // dispositivo, e non riparte alla riapertura dell'app.
      try {
        if (localStorage.getItem(seenKey(key))) return
      } catch { return }  // senza storage non si può garantire "una volta sola" → si rinuncia
    }

    // Mai sopra il tour principale o un'altra guida già aperta.
    if (document.body.classList.contains('driver-active')) return

    const t0 = Date.now()
    let stopped = false

    const tick = () => {
      if (stopped) return
      if (!visibleEl(tour.steps[0].selector)) {
        if (Date.now() - t0 < 8000) setTimeout(tick, 200)
        return
      }
      // Il segno si mette SOLO quando la guida parte davvero: se la pagina non
      // si è caricata, alla prossima visita ci riprova invece di darla per vista.
      try { localStorage.setItem(seenKey(key), '1') } catch { /* noop */ }

      const steps: DriveStep[] = tour.steps
        .filter((s) => visibleEl(s.selector))
        .map((s) => ({
          element: (() => visibleEl(s.selector)) as () => Element,
          popover: { title: s.title, description: s.desc },
        }))
      if (steps.length === 0) return

      const d = driver({
        showProgress: steps.length > 1,
        progressText: '{{current}} di {{total}}',
        nextBtnText: 'Avanti',
        prevBtnText: 'Indietro',
        doneBtnText: 'Ho capito',
        showButtons: steps.length > 1 ? ['next', 'previous', 'close'] : ['next', 'close'],
        allowClose: true,
        disableActiveInteraction: false,
        overlayOpacity: 0.4,
        stagePadding: 6,
        stageRadius: 12,
        popoverClass: 'cc-tour-popover',
        steps,
        onDestroyed: () => { driverRef.current = null },
      })
      driverRef.current = d
      d.drive()
    }

    const t = setTimeout(tick, 350)
    return () => { stopped = true; clearTimeout(t) }
  }, [pathname])

  // Cambio pagina con la guida aperta: si smonta, altrimenti resta l'overlay
  // su una pagina che non c'entra più.
  useEffect(() => {
    return () => {
      if (driverRef.current) {
        driverRef.current.destroy()
        driverRef.current = null
      }
    }
  }, [pathname])

  return null
}
