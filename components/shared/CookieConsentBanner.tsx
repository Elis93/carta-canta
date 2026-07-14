'use client'

// Banner consenso cookie di statistica (PostHog). Appare SOLO se PostHog è
// configurato e l'utente non ha ancora scelto. "Rifiuta" è prominente quanto
// "Accetta" (requisito Garante: rifiutare deve essere facile come accettare).
// Prima di una scelta, PostHog non parte (vedi PostHogProvider).

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ANALYTICS_CONFIGURED, getConsent, setConsent, OPEN_SETTINGS_EVENT,
} from '@/lib/consent'

export function CookieConsentBanner() {
  // Evita mismatch di hydration: niente render finché non siamo montati sul client.
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!ANALYTICS_CONFIGURED) return
    if (getConsent() === null) setVisible(true)
    // "Preferenze cookie" (footer/privacy) riapre il banner anche dopo una scelta
    function onOpen() { setVisible(true) }
    window.addEventListener(OPEN_SETTINGS_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_SETTINGS_EVENT, onOpen)
  }, [])

  if (!visible) return null

  function choose(v: 'granted' | 'denied') {
    setConsent(v)
    setVisible(false)
  }

  return (
    <div
      role="dialog"
      aria-label="Preferenze cookie"
      style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 9999,
        padding: '12px', display: 'flex', justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <div style={{
        pointerEvents: 'auto', width: '100%', maxWidth: 640,
        background: '#fff', border: '1px solid #e7e7ea', borderRadius: 14,
        boxShadow: '0 8px 30px -8px rgba(20,20,40,.28)', padding: '16px 18px',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <p style={{ fontSize: 13, color: '#3a3a44', lineHeight: 1.5, margin: 0 }}>
          Usiamo cookie tecnici necessari al funzionamento e, <strong style={{ color: '#161616' }}>solo col tuo consenso</strong>,
          cookie di statistica per capire come viene usata l&rsquo;app e migliorarla.
          Puoi accettarli o rifiutarli. Dettagli nell&rsquo;{' '}
          <Link href="/privacy" style={{ color: '#1a1a2e', textDecoration: 'underline' }}>Informativa privacy</Link>.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => choose('denied')}
            style={{
              flex: 1, minWidth: 130, height: 44, borderRadius: 11,
              border: '1px solid #e3e3e6', background: '#fff', color: '#1a1a2e',
              fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Rifiuta
          </button>
          <button
            type="button"
            onClick={() => choose('granted')}
            style={{
              flex: 1, minWidth: 130, height: 44, borderRadius: 11, border: 'none',
              background: '#1a1a2e', color: '#fff', fontSize: 14, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: '0 6px 16px -6px rgba(26,26,46,.5)',
            }}
          >
            Accetta
          </button>
        </div>
      </div>
    </div>
  )
}
