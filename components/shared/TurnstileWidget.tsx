'use client'

// ============================================================
// Cloudflare Turnstile — captcha anti-bot sulla registrazione.
// Si attiva SOLO se NEXT_PUBLIC_TURNSTILE_SITE_KEY è impostata (build):
// senza chiave non renderizza nulla e la registrazione funziona come prima.
// Il token finisce in un input nascosto `cf-turnstile-response` che il
// server (signupAction) verifica via siteverify.
// ============================================================

import { useEffect, useRef, useState } from 'react'
import Script from 'next/script'

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string
  reset: (id?: string) => void
  remove: (id?: string) => void
}
declare global {
  // eslint-disable-next-line no-var
  var turnstile: TurnstileApi | undefined
}

export function TurnstileWidget({ action = 'signup' }: { action?: string } = {}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)
  const [ready, setReady] = useState(false)
  const [token, setToken] = useState('')

  // Se lo script è già stato caricato (es. ritorno sulla pagina), non aspettare onLoad.
  useEffect(() => {
    if (typeof window !== 'undefined' && window.turnstile) setReady(true)
  }, [])

  useEffect(() => {
    if (!SITE_KEY || !ready || !containerRef.current || widgetIdRef.current) return
    try {
      widgetIdRef.current = window.turnstile!.render(containerRef.current, {
        sitekey: SITE_KEY,
        callback: (t: string) => setToken(t),
        'expired-callback': () => setToken(''),
        'error-callback': () => setToken(''),
        theme: 'light',
        action,
        // Non far iniettare a Cloudflare il proprio input nascosto: usiamo il
        // nostro input controllato qui sotto (evita due campi con lo stesso nome).
        'response-field': false,
      })
    } catch { /* già renderizzato */ }

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        try { window.turnstile.remove(widgetIdRef.current) } catch { /* noop */ }
        widgetIdRef.current = null
      }
    }
  }, [ready, action])

  if (!SITE_KEY) return null

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="afterInteractive"
        onLoad={() => setReady(true)}
      />
      <div style={{ marginTop: 14 }}>
        <div ref={containerRef} />
        <input type="hidden" name="cf-turnstile-response" value={token} />
      </div>
    </>
  )
}
