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
// /auth/ è un PUBLIC_PREFIX nel middleware (proxy.ts) — nessun auth check.

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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

  const supabase = await createClient()

  // Scambia il code PKCE con una sessione; i cookie vengono scritti da createClient
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.user) {
    console.error('[auth/callback] exchangeCodeForSession:', error?.message)
    return NextResponse.redirect(new URL('/login?error=oauth_failed', origin))
  }

  const user = data.user

  // Crea il workspace se l'utente non ne ha ancora uno
  const wsResult = await ensureWorkspace(user.id, {
    email:    user.email,
    fullName: user.user_metadata?.full_name ?? user.user_metadata?.name,
  })

  if (wsResult === 'error') {
    console.error('[auth/callback] ensureWorkspace failed for user', user.id)
    return NextResponse.redirect(new URL('/login?error=oauth_failed', origin))
  }

  // Nuovo utente OAuth → onboarding per completare ragione sociale, P.IVA, ecc.
  if (wsResult === 'created') {
    return NextResponse.redirect(new URL('/onboarding', origin))
  }

  // Utente esistente — verifica che l'onboarding sia stato completato
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('ragione_sociale')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!workspace?.ragione_sociale) {
    return NextResponse.redirect(new URL('/onboarding', origin))
  }

  return NextResponse.redirect(new URL(next, origin))
}
