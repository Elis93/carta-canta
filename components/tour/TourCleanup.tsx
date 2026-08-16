'use client'

// ============================================================
// TourCleanup — bonifica i residui di driver.js sulle pagine di ACCESSO.
//
// driver.js (tutorial e guide di sezione) appende overlay e popover
// direttamente a <body>, FUORI dall'albero React. Se la sessione scade
// mentre una guida è aperta, la navigazione client-side a /login può
// lasciare quei nodi sullo schermo → «il pop-up del tutorial compare sulla
// pagina di login prima del login» (segnalazione Eli, 14 ago).
//
// Montato nel layout (auth): all'ingresso di QUALSIASI pagina di accesso
// strappa via ogni residuo del tour e sblocca lo scroll. Cintura di
// sicurezza indipendente dalla pulizia dei controller: le pagine di login
// non devono MAI mostrare un tutorial.
// ============================================================

import { useEffect } from 'react'

function strip() {
  // Classi che driver.js mette su <html>/<body> (blocco scroll + fade)
  for (const root of [document.documentElement, document.body]) {
    root.classList.remove('driver-active', 'driver-fade', 'driver-simple')
  }
  // Overlay (SVG), popover e stage appesi a <body>
  document
    .querySelectorAll('.driver-overlay, .driver-overlay-animated, .driver-popover, .driver-stage')
    .forEach((el) => el.remove())
  // Classi lasciate sugli elementi evidenziati (nostre + di driver.js)
  document
    .querySelectorAll('.driver-active-element, .cc-tour-mark, .cc-tour-lift')
    .forEach((el) => el.classList.remove('driver-active-element', 'cc-tour-mark', 'cc-tour-lift'))
}

export function TourCleanup() {
  useEffect(() => {
    // Due passate: subito e dopo un attimo. Il redirect a /login e l'append
    // dell'overlay di driver.js sono asincroni e possono incrociarsi — una
    // guida partita nell'istante dello scambio di layout appenderebbe il suo
    // overlay DOPO la prima pulizia. La seconda passata lo cattura (Eli, 16
    // ago: «il tutorial è partito sulla schermata di login»).
    strip()
    const t = setTimeout(strip, 300)
    return () => clearTimeout(t)
  }, [])

  return null
}
