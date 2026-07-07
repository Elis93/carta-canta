import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /auth/confirm?token_hash=...&type=signup&next=/onboarding
 *
 * Callback per la conferma email di Supabase.
 * Viene invocato quando l'utente clicca il link nella email di conferma.
 *
 * Supabase invia il link nella forma:
 *   https://cartacanta.app/auth/confirm?token_hash=<hash>&type=signup&next=/onboarding
 *
 * In Supabase Dashboard → Authentication → Email Templates → Confirm signup,
 * il link di conferma deve usare:
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=/onboarding
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)

  const token_hash = searchParams.get('token_hash')
  const type       = searchParams.get('type') as EmailOtpType | null
  const rawNext    = searchParams.get('next') ?? '/onboarding'
  // Solo path interni: blocca open redirect
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/onboarding'

  if (token_hash && type) {
    const supabase = await createClient()

    const { error } = await supabase.auth.verifyOtp({ token_hash, type })

    if (!error) {
      // Sessione creata — i cookie vengono scritti dal createClient (SSR).
      // Per il reset password (recovery) andiamo sempre al form cambio password,
      // ignorando il parametro ?next= per evitare redirect sbagliati.
      if (type === 'recovery') {
        return NextResponse.redirect(new URL('/reset-password/confirm', origin))
      }
      // Per gli altri tipi (signup, ecc.) usiamo il path in ?next=
      return NextResponse.redirect(new URL(next, origin))
    }

    console.error('[auth/confirm] verifyOtp error:', error.message)

    // Per il reset password: rimanda alla pagina di richiesta reset con messaggio
    // (il link potrebbe essere già stato usato o scaduto)
    if (type === 'recovery') {
      return NextResponse.redirect(new URL('/reset-password?error=link_scaduto', origin))
    }
  }

  // Token mancante, tipo errato, o link scaduto (per altri tipi)
  return NextResponse.redirect(new URL('/login?error=link_scaduto', origin))
}
