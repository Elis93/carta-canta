import type { NextRequest } from 'next/server'
import { NextResponse, after } from 'next/server'
import { createElement } from 'react'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/send'
import { WelcomeEmail } from '@/lib/email/templates/welcome'

// Email di benvenuto al PRIMO accesso confermato (type=signup).
// In produzione le conferme email sono obbligatorie: la sessione al signup è
// null, quindi signupAction NON manda la welcome (esce prima). È QUI che
// l'utente vero conferma → è il punto giusto per inviarla. Il token è monouso,
// quindi l'invio avviene una sola volta.
//
// L'invio vero e proprio (chiamata esterna a Resend, potenzialmente lenta) è
// schedulato con after(): parte DOPO che la risposta di redirect è stata
// inviata, così l'onboarding non si blocca mai se Resend è lento o in errore.
// I dati (nome + workspace) si leggono prima con query veloci e affidabili a
// Supabase, così after() non dipende dai cookie della richiesta.
async function scheduleWelcomeEmail(
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
    const to = user.email

    after(async () => {
      try {
        await sendEmail({
          to,
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
    })
  } catch (e) {
    console.warn('[auth/confirm] preparazione welcome email fallita (non bloccante):', e)
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
  // Anti open-redirect: solo path interni. Allineato a loginAction e
  // /auth/callback — blocca anche `:` e `\` (un `\` viene normalizzato in `//`
  // da new URL → host esterno). Audit sicurezza 20 lug.
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') && !rawNext.includes(':') && !rawNext.includes('\\')
    ? rawNext
    : '/onboarding'

  if (token_hash && type) {
    // ⚠️ RECUPERO PASSWORD — il token NON si verifica più qui, su una GET
    // (collaudo Eli 21 ago: `otp_expired` su un link fresco). Gli scanner
    // della posta — Gmail compreso — APRONO i link delle email per
    // controllarli, e un token monouso verificato alla GET arrivava già
    // bruciato al tocco umano. Il link atterra ora su una pagina-ponte
    // (/reset-password/verifica) e la verifica parte dal BOTTONE, con una
    // POST: uno scanner carica la pagina ma non preme mai il tasto.
    if (type === 'recovery') {
      const dest = new URL('/reset-password/verifica', origin)
      dest.searchParams.set('token_hash', token_hash)
      return NextResponse.redirect(dest)
    }

    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ token_hash, type })

    if (!error) {
      // Sessione creata — i cookie vengono scritti dal createClient (SSR).
      // Primo accesso confermato: schedula la email di benvenuto (parte dopo
      // il redirect via after(), non blocca mai l'onboarding).
      if (type === 'signup') {
        await scheduleWelcomeEmail(supabase, origin)
      }
      // Per gli altri tipi (signup, ecc.) usiamo il path in ?next=
      return NextResponse.redirect(new URL(next, origin))
    }

    console.error('[auth/confirm] verifyOtp error:', error.status, error.code, error.message)
  }

  // Token mancante, tipo errato, o link scaduto (per altri tipi)
  return NextResponse.redirect(new URL('/login?error=link_scaduto', origin))
}
