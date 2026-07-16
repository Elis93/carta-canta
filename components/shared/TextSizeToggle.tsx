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

import { useEffect, useState } from 'react'

const KEY = 'cc_large'

export function TextSizeToggle() {
  const [on, setOn] = useState(false)
  // Evita mismatch: lo stato reale si legge solo sul client
  const [ready, setReady] = useState(false)

  useEffect(() => {
    try { setOn(localStorage.getItem(KEY) === '1') } catch { /* private mode */ }
    setReady(true)
  }, [])

  function toggle() {
    const next = !on
    setOn(next)
    try { localStorage.setItem(KEY, next ? '1' : '0') } catch { /* private mode */ }
    document.documentElement.classList.toggle('cc-large', next)
  }

  return (
    <button
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
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 15, fontWeight: 600, color: '#161616' }}>
          Testo grande e leggibile
        </span>
        <span style={{ display: 'block', fontSize: 13, color: 'var(--cc-muted)', marginTop: 2, lineHeight: 1.5 }}>
          Ingrandisce scritte e pulsanti in tutta l&rsquo;app e aggiunge una breve
          spiegazione sotto le voci dei menu.
        </span>
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
