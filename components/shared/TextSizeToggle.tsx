'use client'

// ============================================================
// TextSizeToggle — interruttore "Testo grande e leggibile".
//
// DECISIONE Eli (16 lug): di default l'app resta com'è; chi vuole
// (occhi over-50) attiva questa modalità e TUTTA l'app diventa più
// grande (~15%), coi testi grigi più scuri e le descrizioni sotto
// le voci di menu. La scelta è salvata sul telefono (localStorage,
// chiave 'cc_large') e applicata al volo dallo script nel layout.
// ============================================================

import { useEffect, useRef, useState } from 'react'

const KEY = 'cc_large'

/** Contenitore scrollabile più vicino (il <main> dell'app) o la pagina */
function nearestScroller(el: HTMLElement): Element {
  let node: HTMLElement | null = el.parentElement
  while (node) {
    const oy = getComputedStyle(node).overflowY
    if ((oy === 'auto' || oy === 'scroll') && node.scrollHeight > node.clientHeight) return node
    node = node.parentElement
  }
  return document.scrollingElement ?? document.documentElement
}

export function TextSizeToggle() {
  const [on, setOn] = useState(false)
  // Evita mismatch: lo stato reale si legge solo sul client
  const [ready, setReady] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    try { setOn(localStorage.getItem(KEY) === '1') } catch { /* private mode */ }
    setReady(true)
  }, [])

  function toggle() {
    const next = !on
    // Lo zoom 1.15 allunga la pagina ma lo scroll resta in pixel assoluti →
    // il punto guardato scivolava via (feedback Eli 17 lug). Ancoriamo
    // L'INTERRUTTORE: dopo il toggle riportiamo lo scroll finché la levetta
    // torna dov'era sotto il dito (correzione iterativa: robusta rispetto
    // a come il browser mappa le coordinate dentro lo zoom).
    const el = btnRef.current
    const anchorTop = el?.getBoundingClientRect().top
    setOn(next)
    try { localStorage.setItem(KEY, next ? '1' : '0') } catch { /* private mode */ }
    document.documentElement.classList.toggle('cc-large', next)
    if (el && anchorTop != null) {
      const scroller = nearestScroller(el)
      for (let i = 0; i < 4; i++) {
        const delta = el.getBoundingClientRect().top - anchorTop
        if (Math.abs(delta) < 1) break
        scroller.scrollTop += delta / (next ? 1.15 : 1)
      }
    }
  }

  return (
    <button
      ref={btnRef}
      type="button"
      onClick={toggle}
      role="switch"
      aria-checked={on}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 12,
        background: 'transparent', border: 'none', padding: '4px 0',
        cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
        opacity: ready ? 1 : 0.6,
      }}
    >
      {/* 2 ago sera (Eli): "si capisce già cosa fa" — via la descrizione sotto */}
      <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 600, color: '#161616' }}>
        Testo grande e leggibile
      </span>
      {/* Levetta */}
      <span
        aria-hidden
        style={{
          flexShrink: 0, width: 46, height: 27, borderRadius: 999,
          background: on ? '#1a1a2e' : '#dcd8cf', position: 'relative',
          transition: 'background 160ms ease',
        }}
      >
        <span style={{
          position: 'absolute', top: 3, left: on ? 22 : 3,
          width: 21, height: 21, borderRadius: '50%', background: '#fff',
          boxShadow: '0 1px 2px rgba(0,0,0,.25)', transition: 'left 160ms ease',
        }} />
      </span>
    </button>
  )
}
