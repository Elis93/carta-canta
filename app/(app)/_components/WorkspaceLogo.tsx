'use client'

// ============================================================
// WorkspaceLogo — logo del workspace, o iniziali se manca/rotto.
// Estratto dall'AppShell (F22): lo usa anche la scheda profilo
// della pagina Altro, così il "logo con le iniziali" è LO STESSO
// ovunque (logo caricato → si vede il logo, non le iniziali).
//
// Nota fetch fallito: senza lo stato d'errore un logo_url rotto
// mostrerebbe l'icona broken-image del browser (il motivo per cui
// questo è un client component con useState).
// ============================================================

import { useState } from 'react'

export function WorkspaceLogo({
  logoUrl,
  displayName,
  size = 28,
  fallbackInitials,
  round = false,
}: {
  logoUrl: string | null
  displayName: string
  /** Lato in px (28 = header/sidebar, 46 = scheda profilo in Altro) */
  size?: number
  /** Iniziali da mostrare senza logo — Altro passa quelle della PERSONA
   *  (userInitials), identiche al tondo della Home (richiesta Eli 17 lug) */
  fallbackInitials?: string
  /** true = cerchio (come il tondo della Home); false = quadrato smussato */
  round?: boolean
}) {
  const [error, setError] = useState(false)

  // Iniziali dalla ragione sociale (es. "Rossi Idraulica" → "RI"),
  // salvo override del chiamante
  const initials = fallbackInitials || (displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase() || 'CC')

  const radius = Math.round(size * 0.28)

  if (logoUrl && !error) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- logo esterno (Supabase Storage), dimensione fissa
      <img
        src={logoUrl}
        alt={displayName}
        style={{ width: size, height: size, borderRadius: radius, objectFit: 'cover', flexShrink: 0 }}
        onError={() => setError(true)}
      />
    )
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: round ? '50%' : radius,
        background: 'var(--cc-navy, #1a1a2e)',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        // Nel tondo lo stile combacia con l'avatar della Home (peso 500)
        fontWeight: round ? 500 : 700,
        fontSize: Math.max(11, Math.round(size * (round ? 0.33 : 0.34))),
      }}
    >
      {initials}
    </div>
  )
}
