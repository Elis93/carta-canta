// GET /auth/callback?code=...&next=/dashboard
//
// Callback OAuth di Supabase. Supabase riceve la risposta dal provider
// (Google/Apple) e redirige qui con un PKCE code temporaneo.
//
// Flusso:
//   1. Scambia code → sessione (+ imposta cookie)
//   2. ensureWorkspace() — crea workspace se l'utente è nuovo
//   3. Nuovo utente  → /onboarding  (per completare ragione sociale ecc.)
//      Utente già noto, onboarding completo → /dashboard (o ?next=)
//      Utente già noto, onboarding incompleto → /onboarding
//
// ── NOTA COOKIE (FIX-11, premessa superata) ─────────────────────────────────
// Il pattern request-based nacque dall'ipotesi che i cookie scritti via
// cookieStore.set() non passassero attraverso NextResponse.redirect(). Sui
// sorgenti di Next 16.2.11 l'ipotesi è SMENTITA (appendMutableCookies li
// propaga anche ai redirect dei route handler). Il pattern resta perché è
// esplicito e testato in produzione (identico a proxy.ts):
// • setAll() scrive i cookie sia su request.cookies (in-memory, per le
//   query Supabase successive) sia su supabaseResponse (un NextResponse.next)
// • redirectWithSession() copia i cookie da supabaseResponse al 302 finale
// Questo garantisce che il browser riceva i Set-Cookie di sessione anche
// attraverso il redirect e non entri in un loop di login.
// ────────────────────────────────────────────────────────────────────────────

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import type { Database } from '@/types/database'
import { ensureWorkspace } from '@/lib/actions/workspace'
import { registerReferralUse } from '@/lib/referral/register-use'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const rawNext = searchParams.get('next') ?? '/dashboard'
  // Solo path interni: blocca open redirect ("//evil.com", "https://evil.com")
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') && !rawNext.includes(':') && !rawNext.includes('\\') && !rawNext.startsWith('/api/') ? rawNext : '/dashboard'

  // Mancanza del code = flusso OAuth non completato
  if (!code) {
    console.warn('[auth/callback] missing code param')
    return NextResponse.redirect(new URL('/login?error=oauth_failed', origin))
  }

  // Raccoglie i cookie impostati da exchangeCodeForSession in un NextResponse
  // intermedio, da cui li copieremo nel redirect finale (vedi redirectWithSession).
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // 1. Aggiorna request.cookies in-memory → le query Supabase successive
          //    (es. workspace select) vedono i token appena stabiliti.
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          // 2. Ricrea supabaseResponse con la request mutata e vi scrive i
          //    Set-Cookie, pronti per essere copiati nel redirect finale.
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const isRecovery = searchParams.get('type') === 'recovery' || next.startsWith('/reset-password')

  // ⚠️ NIENTE signOut PRIMA dello scambio (bug trovato il 21 ago leggendo il
  // sorgente di supabase-js): `signOut()` cancella anche il cookie
  // `<storageKey>-code-verifier` (GoTrueClient `_removeSession`), che è
  // ESATTAMENTE il segreto PKCE di cui `exchangeCodeForSession` ha bisogno.
  // Il signOut «di cortesia» aggiunto il 12 ago rendeva quindi IMPOSSIBILE
  // completare un recupero password che passasse da qui: lo scambio falliva
  // sempre e si finiva su /login con un errore generico.
  // L'ordine giusto è: si scambia (la sessione nuova SOSTITUISCE la vecchia,
  // quindi il problema dell'eredità non si pone), e solo se lo scambio
  // FALLISCE si chiude la sessione locale — così nessuno resta dentro l'app
  // senza che gli sia stata chiesta una password.
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.user) {
    console.error('[auth/callback] exchangeCodeForSession:', error?.status, error?.code, error?.message)
    if (isRecovery) {
      const { error: outErr } = await supabase.auth.signOut({ scope: 'local' })
      if (outErr) console.warn('[auth/callback] signOut post-fallimento:', outErr.message)
      const dest = new URL('/reset-password?error=link_scaduto', origin)
      if (error?.code) dest.searchParams.set('m', error.code)
      return NextResponse.redirect(dest)
    }
    return NextResponse.redirect(new URL('/login?error=oauth_failed', origin))
  }

  const user = data.user

  // Helper: costruisce un redirect 302 copiando i Set-Cookie di sessione
  function redirectWithSession(dest: URL): NextResponse {
    const res = NextResponse.redirect(dest)
    supabaseResponse.cookies.getAll().forEach(({ name, value, ...opts }) => {
      res.cookies.set(name, value, opts)
    })
    return res
  }

  // ── Password reset (recovery) — RAMO DI RISERVA ───────────────────────────
  // Il flusso email VERO non passa di qui: il template Recovery di Supabase
  // punta a /auth/confirm?token_hash=…&type=recovery (verifica su POST dalla
  // pagina-ponte /reset-password/verifica, 21-24 ago). Questo ramo copre solo
  // il caso in cui il template tornasse al flusso PKCE con ?code=: meglio un
  // ramo dormiente che un recovery che atterra in dashboard. Nessun controllo
  // workspace/onboarding: la sessione è appena stabilita, redirect diretto.
  // Doppio controllo: parametro `next` (se preservato da Supabase) OPPURE
  // parametro `type=recovery` (aggiunto da Supabase come fallback).
  const type = searchParams.get('type')
  if (next.startsWith('/reset-password') || type === 'recovery') {
    return redirectWithSession(new URL('/reset-password/confirm', origin))
  }

  // Crea il workspace se l'utente non ne ha ancora uno
  const wsResult = await ensureWorkspace(user.id, {
    email:    user.email,
    fullName: user.user_metadata?.full_name ?? user.user_metadata?.name,
  })

  if (wsResult === 'error') {
    console.error('[auth/callback] ensureWorkspace failed for user', user.id)
    return redirectWithSession(new URL('/login?error=oauth_failed', origin))
  }

  // Commercialista: chi entra per l'area /studio va dritto lì — l'onboarding
  // artigiano (ragione sociale, P.IVA…) non lo riguarda e lo bloccherebbe.
  if (next.startsWith('/studio')) {
    return redirectWithSession(new URL(next, origin))
  }

  // Nuovo utente OAuth → onboarding per completare ragione sociale, P.IVA, ecc.
  if (wsResult === 'created') {
    // Invito commercialista (?studio) e referral (?ref) propagati da OAuthButtons:
    // col form email/password viaggiavano nei campi hidden; con Google si
    // perdevano. Li applichiamo qui, best-effort (non bloccano l'onboarding).
    const ccStudio = (searchParams.get('cc_studio') ?? '').toLowerCase()
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ccStudio) && ccStudio.length <= 200) {
      try {
        // Suggerisce il collegamento allo studio in Impostazioni (consenso
        // dell'artigiano) — stesso metadato del signup email/password.
        await supabase.auth.updateUser({ data: { studio_invite_email: ccStudio } })
      } catch (e) {
        console.warn('[auth/callback] studio_invite_email set failed', e)
      }
    }
    const ccRef = (searchParams.get('cc_ref') ?? '').toUpperCase()
    if (/^[A-Z0-9]{4,8}$/.test(ccRef)) {
      await registerReferralUse(ccRef, user.id)
    }
    return redirectWithSession(new URL('/onboarding', origin))
  }

  // Utente esistente — verifica che l'onboarding sia stato completato
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('ragione_sociale')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!workspace?.ragione_sociale) {
    return redirectWithSession(new URL('/onboarding', origin))
  }

  return redirectWithSession(new URL(next, origin))
}
