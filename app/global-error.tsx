'use client'

import { useEffect } from 'react'

// ⚠️ global-error SOSTITUISCE il root layout, quindi globals.css (importato
// solo lì) può non essere caricato quando questa pagina appare: SOLO stili
// inline, niente classi Tailwind.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[GlobalError]', error)
  }, [error])

  return (
    <html lang="it">
      <body
        style={{
          minHeight: '100vh',
          margin: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          padding: 32,
          textAlign: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          background: '#faf9f6',
          color: '#161616',
        }}
      >
        <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Errore critico</h2>
        <p style={{ fontSize: 14, color: '#6b7280', maxWidth: 384, margin: 0, lineHeight: 1.5 }}>
          Si è verificato un errore imprevisto. Prova a ricaricare la pagina.
          {error.digest && (
            <span style={{ display: 'block', marginTop: 4, fontFamily: 'monospace', fontSize: 12, opacity: 0.6 }}>
              ID: {error.digest}
            </span>
          )}
        </p>
        <button
          onClick={reset}
          style={{
            padding: '8px 16px',
            borderRadius: 6,
            border: '1px solid #d1d5db',
            background: '#fff',
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          Ricarica
        </button>
        <a href="/" style={{ fontSize: 13, color: '#1a1a2e' }}>Torna alla Home</a>
      </body>
    </html>
  )
}
