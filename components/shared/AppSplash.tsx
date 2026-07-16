'use client'

// ============================================================
// AppSplash — schermata di apertura dell'app (PWA).
//
// Lo splash generato dal sistema operativo mostra solo l'icona (le
// due C) e il nome, SENZA il payoff. Questo overlay, mostrato una
// volta per sessione all'apertura, aggiunge sotto il marchio la
// scritta "il tuo ufficio in tasca" nello stile scelto per l'app
// (Georgia corsivo oro), poi svanisce da solo.
// ============================================================

import { useEffect, useState } from 'react'

const SESSION_KEY = 'cc_splash_shown'

export function AppSplash() {
  // 'hidden' finché non decidiamo (evita flash lato server e sulle
  // navigazioni interne); 'in' = visibile; 'out' = in dissolvenza.
  const [phase, setPhase] = useState<'hidden' | 'in' | 'out'>('hidden')

  useEffect(() => {
    // Una sola volta per sessione: le navigazioni dentro l'app non
    // rimontano il layout, ma un refresh manuale sì → lo evitiamo.
    // ⚠️ getItem nel try: con i cookie/storage bloccati dal browser il solo
    // ACCESSO a sessionStorage lancia SecurityError (crash → global-error).
    let shown = false
    try { shown = sessionStorage.getItem(SESSION_KEY) === '1' } catch { /* storage bloccato */ }
    if (shown) return

    setPhase('in')
    const tFade = setTimeout(() => setPhase('out'), 1050)
    const tGone = setTimeout(() => {
      setPhase('hidden')
      // Il marcatore si scrive QUANDO lo splash finisce, non prima: in dev
      // StrictMode l'effect gira due volte e il cleanup cancella i timer —
      // scrivendo subito, il secondo giro usciva senza rischedularli e lo
      // splash restava INCHIODATO a schermo intero.
      try { sessionStorage.setItem(SESSION_KEY, '1') } catch { /* private mode */ }
    }, 1500)
    return () => { clearTimeout(tFade); clearTimeout(tGone) }
  }, [])

  if (phase === 'hidden') return null

  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#1a1a2e',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        opacity: phase === 'out' ? 0 : 1,
        transition: 'opacity 420ms ease',
        pointerEvents: phase === 'out' ? 'none' : 'auto',
      }}
    >
      {/* Marchio: le due C (oro esterna, crema interna) come l'icona */}
      <svg width="112" height="112" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
        <path d="M342 133 A150 150 0 1 0 342 379" fill="none" stroke="#c9a44c" strokeWidth="38" strokeLinecap="round" />
        <path d="M307 175 A96 96 0 1 0 307 337" fill="none" stroke="#f3ede0" strokeWidth="30" strokeLinecap="round" />
      </svg>

      {/* Wordmark */}
      <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 34, letterSpacing: '.01em' }}>
        <span style={{ color: '#f3ede0' }}>Carta </span>
        <span style={{ color: '#c9a44c' }}>Canta</span>
      </div>

      {/* Divisore sottile */}
      <div style={{ width: 120, height: 1, background: 'rgba(201,164,76,.5)', marginTop: -8 }} />

      {/* Payoff — stesso stile del logo (Georgia corsivo oro) */}
      <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: 'italic', fontSize: 17, color: '#c9a44c', marginTop: -6 }}>
        il tuo ufficio in tasca
      </div>
    </div>
  )
}
