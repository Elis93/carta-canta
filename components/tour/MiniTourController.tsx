'use client'

// ============================================================
// MINI-TOUR dalla checklist "Completa il profilo" (Home).
//
// Pattern "checklist → micro-guida" (il più efficace nella ricerca
// sull'onboarding, ~67% di completamento): toccando una voce della
// checklist si atterra sulla pagina giusta e una guida di 1-2 passi
// evidenzia ESATTAMENTE dove agire. A differenza del tour principale
// l'interazione sull'elemento evidenziato è PERMESSA: l'utente può
// scrivere subito nel campo indicato.
//
// Innesco: CompleteProfileCard salva in sessionStorage
//   cc_minitour = "<chiave>:<timestamp>"
// e naviga (client-side). MiniTourLoader monta questo controller,
// che al cambio pagina legge la chiave, aspetta l'elemento e parte.
// La chiave scade dopo 2 minuti (evita partenze a sorpresa se
// l'utente abbandona a metà).
// ============================================================

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { driver, type Driver, type DriveStep } from 'driver.js'
import 'driver.js/dist/driver.css'

export const MINITOUR_KEY = 'cc_minitour'
const MAX_AGE_MS = 2 * 60 * 1000

interface MiniStep { selector: string; title: string; desc: string }
interface MiniTour { pathPrefix: string; steps: MiniStep[] }

// Le chiavi combaciano con ProfileItem.key della checklist in Home.
const TOURS: Record<string, MiniTour> = {
  dati: {
    pathPrefix: '/impostazioni/generale',
    steps: [{
      selector: '#ragione_sociale',
      title: 'Inserisci qui la ragione sociale',
      desc: 'Comparirà in testa a preventivi e fatture. Quando hai fatto, tocca <b>Salva</b> in fondo alla pagina.',
    }],
  },
  phone: {
    pathPrefix: '/impostazioni/generale',
    steps: [{
      selector: '#telefono',
      title: 'Il numero per farti richiamare',
      desc: 'I clienti lo trovano sul preventivo e ti chiamano con un tocco. Poi <b>Salva</b> in fondo.',
    }],
  },
  logo: {
    pathPrefix: '/impostazioni/generale',
    steps: [{
      selector: '[data-tour="logo-card"]',
      title: 'Carica il tuo logo',
      desc: 'Scegli il file e tocca <b>Carica</b>: da quel momento comparirà sui tuoi documenti.',
    }],
  },
  ateco: {
    pathPrefix: '/impostazioni/fiscale',
    steps: [{
      selector: '[data-tour="ateco-field"]',
      title: 'Il tuo codice ATECO',
      desc: 'Cerca il tuo mestiere: così ti suggeriamo le voci di catalogo giuste. Poi <b>Salva</b> in fondo.',
    }],
  },
  listino: {
    pathPrefix: '/catalogo',
    steps: [
      {
        selector: '[data-tour="importa-ai"]',
        title: 'Importa il listino con l’AI',
        desc: 'Basta una foto o un PDF del tuo vecchio listino: le voci si aggiungono da sole al catalogo.',
      },
      {
        selector: '[data-tour="nuova-voce"]',
        title: 'Oppure aggiungile a mano',
        desc: 'Da qui crei le voci una a una. Col catalogo pronto, i preventivi si compilano in un tocco.',
      },
    ],
  },
}

function visibleEl(selector: string): Element | undefined {
  const nodes = document.querySelectorAll(selector)
  for (const el of Array.from(nodes)) {
    const r = (el as HTMLElement).getBoundingClientRect()
    if (r.width > 0 && r.height > 0) return el
  }
  return undefined
}

function readPending(): string | null {
  try {
    const raw = sessionStorage.getItem(MINITOUR_KEY)
    if (!raw) return null
    const [key, ts] = raw.split(':')
    if (!TOURS[key]) { sessionStorage.removeItem(MINITOUR_KEY); return null }
    // Timestamp assente o malformato = chiave non fidata → trattala come scaduta
    const t = Number(ts)
    if (!Number.isFinite(t) || Date.now() - t > MAX_AGE_MS) { sessionStorage.removeItem(MINITOUR_KEY); return null }
    return key
  } catch { return null }
}

function clearPending() {
  try { sessionStorage.removeItem(MINITOUR_KEY) } catch { /* noop */ }
}

export function MiniTourController() {
  const pathname = usePathname()
  const driverRef = useRef<Driver | null>(null)

  useEffect(() => {
    const key = readPending()
    if (!key) return
    const tour = TOURS[key]
    if (!pathname.startsWith(tour.pathPrefix)) return
    if (driverRef.current) return
    // Mai sopra il tour principale
    if (document.body.classList.contains('driver-active')) { clearPending(); return }

    // Aspetta che il primo elemento sia nel DOM (streaming/loading.tsx)
    const t0 = Date.now()
    let stopped = false
    const tick = () => {
      if (stopped) return
      if (!visibleEl(tour.steps[0].selector)) {
        if (Date.now() - t0 < 8000) { setTimeout(tick, 200) } else { clearPending() }
        return
      }
      clearPending() // consumata: non deve ripartire da sola
      // Solo i passi il cui elemento esiste davvero (es. card AI dietro flag)
      const steps: DriveStep[] = tour.steps
        .filter((s) => visibleEl(s.selector))
        .map((s) => ({
          element: (() => visibleEl(s.selector)) as () => Element,
          popover: { title: s.title, description: s.desc },
        }))
      if (steps.length === 0) return
      const d = driver({
        showProgress: false,
        nextBtnText: 'Avanti',
        doneBtnText: 'Ok',
        showButtons: ['next', 'close'],
        allowClose: true,
        // L'utente può interagire SUBITO con l'elemento evidenziato
        // (scrivere nel campo, toccare il bottone): guida, non gabbia.
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

  // Smonta la guida se si cambia pagina mentre è aperta
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
