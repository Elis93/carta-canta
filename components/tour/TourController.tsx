'use client'

// ============================================================
// CARTA CANTA — Tutorial primo accesso (Driver.js)
//
// 5 passi in 2 fasi, su 2 pagine (rivisto con Eli, 14 lug 2026; ridotto
// 6→5 dopo ricerca web: oltre 5 passi l'abbandono sale al ~63%, il crollo
// è tra il passo 3 e il 4 — fonti: Pendo/Userpilot/Amplitude via Appcues):
//   Fase A — /dashboard:        1 Benvenuto (centrato) · 2 bottone [+]
//   Fase B — /preventivi/nuovo: 3 Cliente e voci · 4 Invia al cliente ·
//                               5 Fine (centrato: stato+cronologia a parole
//                               e invito all'azione; alla chiusura la card
//                               Cliente viene portata in vista)
//
// ⚠️ NIENTE PIÙ FASE C sul dettaglio: la vecchia fase 5-6 aspettava che
// l'utente salvasse e RIAPRISSE il preventivo, ma "Salva bozza" atterra
// sulla LISTA (/preventivi?bozza=N) e l'invio arriva con ?send=1 (escluso)
// → il tour moriva in silenzio a 4/6 (bug segnalato da Eli: "il 6/6 non
// compare"). Il passo 5 ora descrive badge di stato e cronologia senza
// evidenziarli: la pagina del preventivo salvato non esiste ancora.
//
// Regole (SPEC_NUOVE_FEATURE §3):
// - parte UNA SOLA VOLTA al primo accesso post-onboarding (flag DB
//   workspaces.onboarding_tour_done → segue l'utente su ogni device);
// - "Salta" (✕ / tap sullo sfondo / Escape) sempre disponibile:
//   chiudere = saltato per sempre;
// - rilanciabile da Altro › Account e dati → "Rivedi il tutorial"
//   (sessionStorage cc_tour_restart=1 + redirect a /dashboard).
//
// Il passaggio tra le fasi è salvato in sessionStorage (cc_tour_step:
// 'form') così il tour riprende quando l'utente naviga davvero.
// ============================================================

import { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { driver, type Driver, type DriveStep } from 'driver.js'
import 'driver.js/dist/driver.css'
import { markTourDoneAction } from '@/lib/actions/workspace'

const STEP_KEY = 'cc_tour_step'
const RESTART_KEY = 'cc_tour_restart'
// Completato/saltato IN QUESTA SESSIONE: la prop tourDone arriva dal layout
// server e resta stantia per tutta la sessione SPA (il layout non si
// ri-renderizza navigando) → senza questo flag, chiuso il tour, ogni ritorno
// in Home lo faceva RIPARTIRE dal passo 1 (bug trovato dal QA 15 lug).
const DONE_KEY = 'cc_tour_done'
const TOTAL = 5
// Il passo 3 menziona il preventivo dalle foto solo se la feature AI è attiva
const AI_ATTIVA = process.env.NEXT_PUBLIC_AI_IMPORT_ENABLED === 'true'

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

/** Descrizione + riga "Passo X di 5" (il progresso attraversa le 2 fasi) */
function desc(html: string, stepNum: number): string {
  return `${html}<div class="cc-tour-progress">Passo ${stepNum} di ${TOTAL}</div>`
}

/** Badge di stato DEMO nel popover finale (stessi colori di StatusBadge) —
 *  F16: un esempio visibile anche senza preventivi creati. */
function demoBadge(label: string, bg: string): string {
  return `<span style="display:inline-block;border-radius:999px;padding:3px 11px;font-size:12px;font-weight:600;color:#2b2b2b;background:${bg}">${label}</span>`
}

/** F16: marca "in bianco" riquadri SECONDARI durante un passo (anello
 *  bianco+oro, come nei mockup) oltre all'elemento principale ritagliato.
 *  Un solo elemento per selettore (il primo visibile). Se il riquadro sta
 *  nella bottom-nav (z-40, sotto l'overlay del tour) alza la nav. */
function markTour(selectors: string[]) {
  for (const sel of selectors) {
    const el = visibleEl(sel)
    if (!el) continue
    el.classList.add('cc-tour-mark')
    el.closest('nav')?.classList.add('cc-tour-lift')
  }
}
function clearTourMarks() {
  document.querySelectorAll('.cc-tour-mark').forEach((el) => el.classList.remove('cc-tour-mark'))
  document.querySelectorAll('.cc-tour-lift').forEach((el) => el.classList.remove('cc-tour-lift'))
}

export function TourController({ tourDone }: { tourDone: boolean }) {
  const pathname = usePathname()
  const router = useRouter()
  const driverRef = useRef<Driver | null>(null)
  // true mentre distruggiamo noi il driver (cambio fase / cambio pagina): non è uno skip
  const phaseChangeRef = useRef(false)

  useEffect(() => {
    const restart = getStore(RESTART_KEY) === '1'
    let step = getStore(STEP_KEY)
    // Valore legacy della vecchia Fase C (rimossa 14 lug): puliscilo,
    // il tour ormai finisce nella Fase B.
    if (step === 'detail') { setStore(STEP_KEY, null); step = null }
    // Attivo se: mai fatto, oppure rilancio esplicito, oppure fase intermedia
    // in corso. Il flag di sessione copre la prop tourDone stantia (vedi DONE_KEY).
    if ((tourDone || getStore(DONE_KEY) === '1') && !restart && !step) return
    if (driverRef.current) return // già attivo su questa pagina

    function finish(markDone: boolean) {
      setStore(STEP_KEY, null)
      setStore(RESTART_KEY, null)
      if (markDone) {
        setStore(DONE_KEY, '1')
        void markTourDoneAction()
      }
    }

    function startPhase(steps: DriveStep[], onLastNext?: () => void, onClosed?: () => void) {
      const d: Driver = driver({
        showProgress: false,
        nextBtnText: 'Avanti',
        // Nella fase intermedia (A) il tour PROSEGUE su un'altra pagina: il
        // bottone dell'ultimo step deve dire "Avanti", non "Fine" (bug
        // segnalato: "a 2 di 6 esce Fine e non va avanti"). "Fine" solo
        // nell'ultima fase (B, passo 6).
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
        // Bottone "Testo grande" nel passo di benvenuto (id cc-tour-textlarge):
        // chi fatica a leggere lo sta faticando PROPRIO ora — un tocco e
        // l'app si ingrandisce all'istante (stessa logica di TextSizeToggle).
        onPopoverRender: (popover) => {
          const btn = popover.wrapper.querySelector<HTMLButtonElement>('#cc-tour-textlarge')
          if (!btn) return
          const sync = () => {
            btn.textContent = document.documentElement.classList.contains('cc-large')
              ? '✓ Testo grande attivo — tocca per tornare normale'
              // F16: niente "Aa" davanti (i 60enni non lo capiscono)
              : 'Scritte piccole? Attiva il testo grande'
          }
          sync()
          btn.addEventListener('click', () => {
            const next = !document.documentElement.classList.contains('cc-large')
            document.documentElement.classList.toggle('cc-large', next)
            try { localStorage.setItem('cc_large', next ? '1' : '0') } catch { /* private mode */ }
            sync()
          })
        },
        onDestroyed: () => {
          clearTourMarks() // F16: mai anelli orfani dopo la chiusura
          driverRef.current = null
          if (phaseChangeRef.current) {
            phaseChangeRef.current = false
            return
          }
          // Chiusura dell'utente (✕ / sfondo / Escape) o fine naturale del
          // tour → non deve più ripartire da solo.
          finish(true)
          onClosed?.()
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
            // F16: mentre il benvenuto è aperto, la tab "Altro" in basso è
            // marcata in bianco → si VEDE dove vive l'impostazione del testo.
            onHighlighted: () => markTour(['[data-tour="tab-altro"]']),
            onDeselected: () => clearTourMarks(),
            popover: {
              title: 'Benvenuto in Carta Canta! 👋',
              description: desc(
                'Ti mostro come fare il tuo <b>primo preventivo in 60 secondi</b>. Sono solo 5 passaggi veloci.'
                + '<div style="margin-top:10px"><button type="button" id="cc-tour-textlarge" '
                + 'style="border:1px solid #e8d6ad;background:#fdf9ef;color:#8a5208;border-radius:999px;'
                + 'padding:7px 12px;font-size:12.5px;font-weight:600;font-family:inherit;cursor:pointer"></button></div>'
                // Il toggle «Testo grande» vive nella card in fondo ad «Altro»
                // (mobile: la tab Altro in basso è marcata da markTour).
                + '<div style="margin-top:5px;font-size:11px;color:#8a887f"><span class="cc-tour-mobile">Lo trovi quando vuoi in <b>Altro</b>, in fondo alla pagina: la tab è illuminata qui sotto.</span><span class="cc-tour-desktop">Lo trovi quando vuoi in <b>Altro</b>, in fondo alla pagina.</span></div>',
                1
              ),
              nextBtnText: 'Iniziamo →',
            },
          },
          {
            element: lazy('[data-tour="fab"]'),
            popover: {
              title: 'Si parte da qui',
              description: desc('Da qui crei un nuovo <b>preventivo</b> o un <b>sopralluogo</b>, da qualsiasi schermata (sul telefono \u00e8 il bottone <b>+</b>: toccalo e scegli).', 2),
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

    // ── Fase B — Nuovo preventivo: cliente/voci · invio · stato · fine ──
    // Il tour si CHIUDE qui (passi 3-6). La vecchia Fase C sul dettaglio
    // non partiva mai: "Salva bozza" atterra sulla lista e l'invio arriva
    // con ?send=1 → l'utente restava a 4/6 senza il finale (bug di Eli).
    // I passi 5-6 sono popover centrati: descrivono cosa troverà sul
    // preventivo salvato, senza chiedergli di salvarlo prima.
    if (pathname === '/preventivi/nuovo' && step === 'form') {
      // Aspetta che il form sia davvero nel DOM (streaming/loading.tsx su mobile)
      const stopWait = whenVisible('[data-tour="invia"]', 8000, () => startPhase(
        [
          {
            element: lazy('[data-tour="cliente"]'),
            // F16: dentro la card ritagliata, anello bianco+oro sul riquadro
            // della descrizione (col microfono) e sul bottone delle foto AI —
            // così si VEDONO i punti di cui parla il testo.
            onHighlighted: () => markTour(['[data-tour="voce-mic"]', '[data-tour="ai-foto"]']),
            onDeselected: () => clearTourMarks(),
            popover: {
              title: 'Cliente e lavori',
              description: desc(
                AI_ATTIVA
                  ? 'Cerca il cliente (o crealo subito da qui) e aggiungi le voci: dettale col <b>microfono 🎤</b> o fattele <b>proporre dalle foto (AI)</b> — sono i riquadri illuminati.'
                  : 'Cerca il cliente (o crealo subito da qui) e aggiungi le voci del lavoro. Col <b>microfono 🎤</b> (illuminato qui sopra) puoi dettarle a voce, comodo in cantiere.',
                3
              ),
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
          {
            popover: {
              title: 'Hai finito! 🎉',
              // Un solo passo finale (6→5: oltre 5 passi l'abbandono raddoppia):
              // beneficio (seguire la risposta) + aggancio alle mini-guide
              // della checklist (pattern "checklist → micro-tour").
              // F16: badge di ESEMPIO disegnati nel popover (stessi colori di
              // StatusBadge) — si vedono anche senza preventivi creati.
              description: desc(
                'Il <b>badge di stato</b> ti dirà se il cliente ha visto o accettato. Eccoli:'
                + '<div style="display:flex;gap:6px;flex-wrap:wrap;margin:8px 0 8px">'
                + demoBadge('Inviato', '#d8e8fb')
                + demoBadge('Visto', '#fbe1ee')
                + demoBadge('Accettato', '#d4efe2')
                + '</div>'
                + 'La <b>cronologia</b> tiene tutta la storia. Per il resto, segui <b>Completa il profilo</b> in Home.'
                // Il punto ⓘ (SpiegaCampo): disegnato qui come i badge demo,
                // così si sa riconoscerlo anche prima di incontrarne uno.
                + '<div style="margin-top:8px;padding-top:8px;border-top:1px solid #ececec">Quando accanto a un campo vedi il tondino '
                + '<span style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;border:1px solid #d9d7d0;background:#fff;color:#6f6d64;vertical-align:-5px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg></span>'
                + ', <b>toccalo</b>: spiega a cosa serve la funzione che gli sta accanto.</div>',
                5
              ),
            },
          },
        ],
        undefined,
        // Alla chiusura porta la card Cliente in vista: l'utente è già
        // sul punto di partenza (tour "in azione", non solo da guardare).
        () => {
          const el = document.querySelector('[data-tour="cliente"]')
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        },
      ))
      return () => stopWait()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, tourDone])

  // Smonta il driver se si cambia pagina mentre è aperto (non è uno skip)
  useEffect(() => {
    return () => {
      if (driverRef.current) {
        phaseChangeRef.current = true
        driverRef.current.destroy()
        driverRef.current = null
        // F16: destroy() entro la prima animazione può saltare onDestroyed
        // (quirk driver.js 1.6, vedi sotto) → gli anelli vanno tolti anche qui.
        clearTourMarks()
        // driver.js 1.6 NON invoca onDestroyed se destroy() arriva entro la
        // prima animazione (~400ms): senza questo reset il flag resterebbe
        // true e la successiva chiusura VOLONTARIA dell'utente non verrebbe
        // registrata come skip (QA 15 lug). Se onDestroyed è scattato, ha già
        // fatto l'early-return: azzerare qui è comunque corretto.
        phaseChangeRef.current = false
      }
    }
  }, [pathname])

  return null
}
