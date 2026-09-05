'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

/**
 * Freccia "indietro" degli header mobile.
 *
 * Riscritta il 28 lug (feedback Eli: "a volte funziona in modo errato"):
 * prima decideva con `history.length > 1`, che è quasi SEMPRE vero (conta
 * anche la cronologia precedente all'app e non cala mai) → il back cieco
 * usciva dall'app sui link diretti (notifica/WhatsApp) o riportava sul
 * form appena inviato dopo un salvataggio con redirect.
 *
 * Ora si torna indietro nella cronologia SOLO se l'ultima navigazione
 * in-app registrata (NavTracker → sessionStorage 'cc_prev_path') esiste,
 * non è la pagina corrente e non è una pagina "di passaggio" (form di
 * creazione, login…). In tutti gli altri casi si va al fallback: la
 * pagina "genitore" logica, sempre prevedibile.
 */

// Pagine di passaggio: tornarci con la freccia non ha mai senso
// (form già inviato, flussi di autenticazione, boot).
const TRANSIENT_PREV = [
  /\/nuovo$/,            // preventivi/fatture/sopralluoghi/lavori/template /nuovo
  /^\/catalogo\/importa/,
  /^\/login/, /^\/signup/, /^\/verifica-email/, /^\/onboarding/, /^\/avvio/,
]

/** Pura (testata in tests/unit/shared/back-button.test.ts): decide se la
 *  freccia può fare history.back() o deve andare al fallback. */
export function shouldGoBack(
  prev: string | null,
  currentPath: string,
  historyLength: number
): boolean {
  return (
    !!prev &&
    prev !== currentPath &&
    !TRANSIENT_PREV.some((re) => re.test(prev)) &&
    historyLength > 1
  )
}

export function BackButton({ fallback, ariaLabel = 'Indietro', color = '#55534b' }: { fallback: string; ariaLabel?: string; /** Colore della freccia (chiara sulle testate navy). */ color?: string }) {
  const router = useRouter()
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={() => {
        let prev: string | null = null
        try { prev = sessionStorage.getItem('cc_prev_path') } catch { /* storage bloccato */ }
        if (shouldGoBack(prev, window.location.pathname, window.history.length)) router.back()
        else router.push(fallback)
      }}
      style={{ color, display: 'flex', alignItems: 'center', background: 'none', border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0 }}
    >
      <ChevronLeft size={25} />
    </button>
  )
}
