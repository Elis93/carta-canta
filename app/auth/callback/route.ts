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
// ── NOTA COOKIE (FIX-11) ────────────────────────────────────────────────────
// Non usiamo createClient() (che si affida a cookies() di next/headers)
// perché in Next.js 16 + Vercel i cookie scritti via cookieStore.set()
// NON vengono automaticamente propagati a un NextResponse.redirect().
// Usiamo invece il pattern request-based (identico a proxy.ts):
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

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

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

  // Scambia il code PKCE con una sessione; i cookie vengono raccolti in setAll
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.user) {
    console.error('[auth/callback] exchangeCodeForSession:', error?.message)
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

  // ── Password reset (recovery) ─────────────────────────────────────────────
  // Se next punta alla pagina di conferma reset, non servono controlli workspace
  // né onboarding: la sessione è appena stabilita, redirect diretto.
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

  // Nuovo utente OAuth → onboarding per completare ragione sociale, P.IVA, ecc.
  if (wsResult === 'created') {
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
