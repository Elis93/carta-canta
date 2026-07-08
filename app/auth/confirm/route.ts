import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createElement } from 'react'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/send'
import { WelcomeEmail } from '@/lib/email/templates/welcome'

// Email di benvenuto al PRIMO accesso confermato (type=signup).
// In produzione le conferme email sono obbligatorie: la sessione al signup è
// null, quindi signupAction NON manda la welcome (esce prima). È QUI che
// l'utente vero conferma → è il punto giusto per inviarla. Best-effort: non
// deve mai bloccare il redirect all'onboarding. Il token è monouso, quindi
// l'invio avviene una sola volta.
async function sendWelcomeBestEffort(
  supabase: Awaited<ReturnType<typeof createClient>>,
  origin: string
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) return
    const meta = (user.user_metadata ?? {}) as { nome?: string; full_name?: string }
    const userName = meta.nome || meta.full_name?.split(' ')[0] || 'artigiano'

    const { data: ws } = await supabase
      .from('workspaces')
      .select('name, ragione_sociale')
      .eq('owner_id', user.id)
      .maybeSingle()
    const workspaceName = ws?.ragione_sociale || ws?.name || userName

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? origin
    await sendEmail({
      to: user.email,
      subject: `Benvenuto in Carta Canta, ${userName}`,
      react: createElement(WelcomeEmail, {
        userName,
        workspaceName,
        ctaUrl: `${appUrl}/preventivi/nuovo`,
      }),
    })
  } catch (e) {
    console.warn('[auth/confirm] welcome email non inviata (non bloccante):', e)
  }
}

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
      // Primo accesso confermato: manda la email di benvenuto (best-effort).
      // Attesa breve (Resend ~200-500ms) così la lambda non viene congelata
      // prima dell'invio; un errore non impedisce comunque il redirect.
      if (type === 'signup') {
        await sendWelcomeBestEffort(supabase, origin)
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
