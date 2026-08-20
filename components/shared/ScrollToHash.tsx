'use client'

// Porta la pagina sull'ancora dell'URL (#ore, #foto) DOPO che il contenuto
// vero è comparso. Perché serve: le pagine con un boundary `loading.tsx`
// mostrano prima lo scheletro — lo scroll automatico di Next verso l'ancora
// scatta in quell'istante, quando l'elemento con quell'id NON esiste ancora,
// e la pagina resta in cima (Eli 20 ago: «la pagina mi si deve aprire con
// quelle funzioni il più vicino possibile a dove ho cliccato»).
// Montato dentro page.tsx, questo componente parte solo quando lo scheletro
// ha lasciato il posto al contenuto; qualche tentativo ravvicinato copre gli
// elementi che compaiono un attimo dopo (immagini, card idratate).

import { useEffect } from 'react'

export function ScrollToHash() {
  useEffect(() => {
    const hash = window.location.hash.slice(1)
    if (!hash) return
    let tries = 0
    let timer: number | undefined
    const attempt = () => {
      const el = document.getElementById(hash)
      if (el) {
        // 'auto' (istantaneo): la pagina deve APRIRSI lì, non scorrerci
        // davanti agli occhi. Lo scrollMarginTop dell'elemento fa l'offset.
        el.scrollIntoView({ block: 'start', behavior: 'auto' })
        return
      }
      if (++tries < 8) timer = window.setTimeout(attempt, 120)
    }
    // Doppio rAF: si parte a pagina dipinta.
    requestAnimationFrame(() => requestAnimationFrame(attempt))
    return () => { if (timer) window.clearTimeout(timer) }
  }, [])
  return null
}
