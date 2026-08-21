'use client'

// ============================================================
// OAuthButtons
// Pulsanti di accesso con provider OAuth (Google, in futuro Apple).
// Usa il Supabase browser client — deve essere un Client Component.
//
// Il flow:
//   signInWithOAuth() → redirect a Google → /auth/callback?code=...
//   La route /auth/callback scambia il code e gestisce il workspace.
// ============================================================

import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

// Logo Google "G" multicolore — SVG inline, zero dipendenze extra
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 shrink-0" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04
           2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23
           1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99
           20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18
           C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09
           14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6
           3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  )
}

export function OAuthButtons() {
  const [loading, setLoading] = useState(false)

  // Reimposta il loading quando l'utente torna indietro dalla pagina Google
  // (bfcache su iOS/Android: la pagina viene "congelata" e ripristinata senza
  // rieseguire il codice JS, quindi setLoading(false) non viene mai chiamato).
  useEffect(() => {
    function handlePageShow(e: PageTransitionEvent) {
      if (e.persisted) setLoading(false)
    }
    window.addEventListener('pageshow', handlePageShow)
    return () => window.removeEventListener('pageshow', handlePageShow)
  }, [])

  async function handleGoogle() {
    if (loading) return
    setLoading(true)
    try {
      const supabase = createClient()
      const params = new URLSearchParams(window.location.search)
      // Il callback riceve i parametri come query string preservata da Supabase
      // (già così per ?next=). Costruiamo l'URL con URL/searchParams.
      const cb = new URL(`${window.location.origin}/auth/callback`)

      // Propaga ?redirect= della pagina login al callback (?next=): chi arriva
      // da /login?redirect=/studio con Google deve atterrare su /studio, non
      // su /dashboard. Stessa validazione anti open-redirect del callback.
      const raw = params.get('redirect') ?? ''
      if (raw.startsWith('/') && !raw.startsWith('//') && !raw.includes(':') && !raw.includes('\\')) {
        cb.searchParams.set('next', raw)
      }

      // Invito commercialista→artigiano (?studio=email) e referral (?ref=CODICE):
      // prima viaggiavano SOLO col form email/password → chi si iscriveva con
      // Google da un link ?studio/?ref perdeva invito e referral. Ora li
      // propaghiamo al callback (URL o, per lo studio, sessionStorage di first-touch).
      const studio = (params.get('studio') ?? sessionStorage.getItem('cc_studio') ?? '').toLowerCase()
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(studio) && studio.length <= 200) {
        cb.searchParams.set('cc_studio', studio)
      }
      const ref = (params.get('ref') ?? '').toUpperCase()
      if (/^[A-Z0-9]{4,8}$/.test(ref)) {
        cb.searchParams.set('cc_ref', ref)
      }

      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          // Supabase redirige qui dopo l'autenticazione Google
          redirectTo: cb.toString(),
          // Google deve SEMPRE mostrare la scelta dell'account (Eli, 21 ago:
          // «non posso selezionare con quale account entrare» — senza questo
          // parametro, con un solo account già autorizzato Google salta la
          // schermata e rientra dritto con quello).
          queryParams: { prompt: 'select_account' },
        },
      })
      // signInWithOAuth redirige il browser — non serve gestire il risultato.
      // setLoading(false) non verrà mai raggiunto in caso di successo.
    } catch {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        className="w-full gap-2"
        onClick={handleGoogle}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <GoogleIcon />
        )}
        Continua con Google
      </Button>
    </div>
  )
}
