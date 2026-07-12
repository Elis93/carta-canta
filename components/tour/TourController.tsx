'use client'

// ============================================================
// CARTA CANTA — Tutorial primo accesso (Driver.js)
//
// 6 passi in 3 fasi, su 3 pagine (mockup approvato da Eli, 5 lug 2026):
//   Fase A — /dashboard:        1 Benvenuto (centrato) · 2 bottone [+]
//   Fase B — /preventivi/nuovo: 3 Cliente e voci · 4 Invia al cliente
//   Fase C — /preventivi/[id]:  5 Stato e cronologia · 6 Fine (centrato)
//
// Regole (SPEC_NUOVE_FEATURE §3):
// - parte UNA SOLA VOLTA al primo accesso post-onboarding (flag DB
//   workspaces.onboarding_tour_done → segue l'utente su ogni device);
// - "Salta" (✕ / tap sullo sfondo / Escape) sempre disponibile:
//   chiudere = saltato per sempre;
// - rilanciabile da Impostazioni → "Rivedi il tutorial" (sessionStorage
//   cc_tour_restart=1 + redirect a /dashboard).
//
// Il passaggio tra le fasi è salvato in sessionStorage (cc_tour_step:
// 'form' | 'detail') così il tour riprende quando l'utente naviga davvero:
// accompagna la creazione e l'invio del primo preventivo.
// ============================================================

import { useEffect, useRef } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { driver, type Driver, type DriveStep } from 'driver.js'
import 'driver.js/dist/driver.css'
import { toast } from 'sonner'
import { markTourDoneAction } from '@/lib/actions/workspace'

const STEP_KEY = 'cc_tour_step'
const RESTART_KEY = 'cc_tour_restart'
const TOTAL = 6

function getStore(key: string): string | null {
  try { return sessionStorage.getItem(key) } catch { return null }
}
function setStore(key: string, value: string | null) {
  try {
    if (value === null) sessionStorage.removeItem(key)
    else sessionStorage.setItem(key, value)
  } catch { /* private mode */ }
}

/** Selettore solo se l'elemento esiste ed è visibile — altrimenti popover centrato */
function visibleEl(selector: string): Element | undefined {
  const nodes = document.querySelectorAll(selector)
  for (const el of Array.from(nodes)) {
    const r = (el as HTMLElement).getBoundingClientRect()
    if (r.width > 0 && r.height > 0) return el
  }
  return undefined
}

/**
 * element come FUNZIONE: driver.js la valuta al momento dell'highlight,
 * non alla costruzione degli step. Su mobile il DOM arriva in streaming
 * (loading.tsx): valutare subito congelava undefined → popover centrato
 * SENZA evidenziazione (bug segnalato da Eli).
 */
function lazy(selector: string): () => Element {
  return (() => visibleEl(selector)) as () => Element
}

/** Polla finché il selettore è visibile (o timeout) prima di avviare la fase */
function whenVisible(selector: string, timeoutMs: number, cb: () => void): () => void {
  const t0 = Date.now()
  let stop = false
  const tick = () => {
    if (stop) return
    if (visibleEl(selector) || Date.now() - t0 >= timeoutMs) { cb(); return }
    setTimeout(tick, 200)
  }
  tick()
  return () => { stop = true }
}

/** Descrizione + riga "Passo X di 6" (il progresso attraversa le 3 fasi) */
function desc(html: string, stepNum: number): string {
  return `${html}<div class="cc-tour-progress">Passo ${stepNum} di ${TOTAL}</div>`
}

export function TourController({ tourDone }: { tourDone: boolean }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const driverRef = useRef<Driver | null>(null)
  // true mentre distruggiamo noi il driver (cambio fase / cambio pagina): non è uno skip
  const phaseChangeRef = useRef(false)

  useEffect(() => {
    const restart = getStore(RESTART_KEY) === '1'
    const step = getStore(STEP_KEY)
    // Attivo se: mai fatto, oppure rilancio esplicito, oppure fase intermedia in corso
    if (tourDone && !restart && !step) return
    if (driverRef.current) return // già attivo su questa pagina

    function finish(markDone: boolean) {
      setStore(STEP_KEY, null)
      setStore(RESTART_KEY, null)
      if (markDone) void markTourDoneAction()
    }

    function startPhase(steps: DriveStep[], onLastNext?: () => void) {
      const d: Driver = driver({
        showProgress: false,
        nextBtnText: 'Avanti',
        // Nelle fasi intermedie il tour PROSEGUE (altra pagina): il bottone
        // dell'ultimo step deve dire "Avanti", non "Fine" (bug segnalato:
        // "a 4 di 6 esce Fine e non va avanti"). "Fine" solo in Fase C.
        doneBtnText: onLastNext ? 'Avanti' : 'Fine',
        showButtons: ['next', 'close'],
        allowClose: true,
        disableActiveInteraction: true,
        // Overlay tenue: lo sfondo (es. tabella voci al passo 3) resta
        // leggibile — feedback Eli "non si vedono i dettagli dietro".
        overlayOpacity: 0.4,
        stagePadding: 6,
        stageRadius: 12,
        popoverClass: 'cc-tour-popover',
        steps,
        onDestroyed: () => {
          driverRef.current = null
          if (phaseChangeRef.current) {
            phaseChangeRef.current = false
            return
          }
          // Chiusura dell'utente (✕ / sfondo / Escape) o fine naturale del
          // tour → non deve più ripartire da solo.
          finish(true)
        },
        onNextClick: () => {
          if (!d.hasNextStep()) {
            if (onLastNext) {
              phaseChangeRef.current = true
              d.destroy()
              onLastNext()
            } else {
              d.destroy() // fine naturale → onDestroyed marca il flag
            }
            return
          }
          d.moveNext()
        },
      })
      driverRef.current = d
      d.drive()
    }

    // ── Fase A — Home: Benvenuto + bottone [+] ──
    if (pathname === '/dashboard' && (!step || restart)) {
      setStore(RESTART_KEY, null)
      const t = setTimeout(() => startPhase(
        [
          {
            popover: {
              title: 'Benvenuto in Carta Canta! 👋',
              description: desc('Ti mostro come fare il tuo <b>primo preventivo in 60 secondi</b>. Sono solo 6 passaggi veloci.', 1),
              nextBtnText: 'Iniziamo →',
            },
          },
          {
            element: lazy('[data-tour="fab"]'),
            popover: {
              title: 'Si parte da qui',
              description: desc('Da qui crei un nuovo preventivo, da qualsiasi schermata (sul telefono \u00e8 il bottone <b>+</b>).', 2),
            },
          },
        ],
        () => {
          setStore(STEP_KEY, 'form')
          router.push('/preventivi/nuovo')
        },
      ), 400)
      return () => clearTimeout(t)
    }

    // ── Fase B — Nuovo preventivo: cliente/voci + Invia al cliente ──
    if (pathname === '/preventivi/nuovo' && step === 'form') {
      // Aspetta che il form sia davvero nel DOM (streaming/loading.tsx su mobile)
      const stopWait = whenVisible('[data-tour="invia"]', 8000, () => startPhase(
        [
          {
            element: lazy('[data-tour="cliente"]'),
            popover: {
              title: 'Cliente e lavori',
              description: desc('Cerca il cliente (o crealo al volo) e aggiungi le voci del lavoro. Col <b>microfono 🎤</b> puoi dettarle a voce, comodo in cantiere.', 3),
              // Card cliente evidenziata; le voci sotto restano leggibili
              // (overlay 0.4) col popover in basso.
              side: 'bottom',
              align: 'center',
            },
          },
          {
            element: lazy('[data-tour="invia"]'),
            popover: {
              title: 'Invialo in un tocco',
              description: desc('<b>Invia al cliente</b> ti fa scegliere il canale: WhatsApp, Email o link da copiare. Il numero viene assegnato da solo.', 4),
              // Il popover sta SOPRA il bottone evidenziato, senza coprirlo
              side: 'top',
              align: 'center',
            },
          },
        ],
        () => {
          // Il tour riprende quando l'utente apre il dettaglio del preventivo
          // (dopo l'invio o il salvataggio) — vedi Fase C. Diciamolo,
          // altrimenti sembra che il tutorial si sia fermato a 4 di 6.
          setStore(STEP_KEY, 'detail')
          toast.info('Ora tocca a te: compila il preventivo e usa "Invia al cliente" o "Salva bozza". Il tutorial continua sul preventivo salvato (passo 5 di 6).', { duration: 12_000, closeButton: true })
        },
      ))
      return () => stopWait()
    }

    // ── Fase C — Dettaglio preventivo: stato/cronologia + fine ──
    const isDetail = /^\/preventivi\/[^/]+$/.test(pathname) && pathname !== '/preventivi/nuovo'
    if (isDetail && step === 'detail' && !searchParams.has('send')) {
      let cancelled = false
      let startedAt = Date.now()
      // Aspetta che eventuali pop-up (invio email, canali) siano chiusi E che
      // la card cronologia sia nel DOM (streaming su mobile)
      const tryStart = () => {
        if (cancelled || driverRef.current) return
        const overlayOpen = document.querySelector('[role="dialog"][data-state="open"], [role="dialog"][aria-modal="true"]')
        if (overlayOpen || !visibleEl('[data-tour="cronologia"]')) {
          if (Date.now() - startedAt < 30_000) setTimeout(tryStart, 800)
          return
        }
        startPhase([
          {
            element: lazy('[data-tour="cronologia"]'),
            popover: {
              title: 'Segui la risposta da qui',
              description: desc('Il <b>badge di stato</b> e la <b>cronologia</b> ti dicono se il cliente ha ricevuto, visto, accettato o rifiutato.', 5),
            },
          },
          {
            popover: {
              title: 'Hai finito! 🎉',
              description: desc('Ora sai fare tutto quello che serve. Puoi <b>rivedere questo tutorial</b> quando vuoi da <b>Impostazioni</b>.', 6),
            },
          },
        ])
      }
      // Se l'utente va su WhatsApp/Email e torna dopo, riprova al rientro
      // in foreground (il poll da solo muore dopo 30s)
      const onVisible = () => {
        if (!cancelled && !driverRef.current && document.visibilityState === 'visible') {
          startedAt = Date.now()
          tryStart()
        }
      }
      document.addEventListener('visibilitychange', onVisible)
      const t = setTimeout(tryStart, 700)
      return () => { cancelled = true; clearTimeout(t); document.removeEventListener('visibilitychange', onVisible) }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams, tourDone])

  // Smonta il driver se si cambia pagina mentre è aperto (non è uno skip)
  useEffect(() => {
    return () => {
      if (driverRef.current) {
        phaseChangeRef.current = true
        driverRef.current.destroy()
        driverRef.current = null
      }
    }
  }, [pathname])

  return null
}
