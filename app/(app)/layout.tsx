import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { AppShell } from './_components/AppShell'
import { TourController } from '@/components/tour/TourController'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Il middleware garantisce che questa route group sia accessibile solo agli utenti
  // autenticati. Se user è null qui è un'anomalia (es. errore di rete verso Supabase
  // durante getUser(), o breve race condition nel refresh del token).
  //
  // NON redirezionare a /login: il middleware vede ancora l'utente come autenticato
  // (i cookie sono validi per lui) e reindirizzerebbe subito a /dashboard,
  // creando il loop  layout→/login→middleware→/dashboard→layout→/login.
  //
  // Propaghiamo invece un errore all'error boundary (app/(app)/error.tsx),
  // che mostra all'utente il pulsante "Riprova". Al secondo tentativo il token
  // è di solito già stato aggiornato correttamente.
  if (!user) {
    throw new Error(
      'Sessione non disponibile. Ricarica la pagina o rieffettua il login.'
    )
  }

  // Carica workspace — prima come owner, poi come membro invitato (Team plan).
  let { data: workspace } = await supabase
    .from('workspaces')
    .select('id, name, plan, ragione_sociale, logo_url')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!workspace) {
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .not('accepted_at', 'is', null)
      .limit(1)
      .maybeSingle()

    if (membership) {
      const { data: memberWorkspace } = await supabase
        .from('workspaces')
        .select('id, name, plan, ragione_sociale, logo_url')
        .eq('id', membership.workspace_id)
        .maybeSingle()
      workspace = memberWorkspace
    }
  }

  if (!workspace) redirect('/onboarding')

  // Onboarding incompleto → redirect, MA rispetta "Completa più tardi"
  // (cookie cc_onboarding_skip impostato dal bottone nell'onboarding).
  if (!workspace.ragione_sociale) {
    const skipped = (await cookies()).get('cc_onboarding_skip')?.value === '1'
    if (!skipped) redirect('/onboarding')
  }

  // Dati utente per header
  const fullName: string =
    user.user_metadata?.full_name ||
    `${user.user_metadata?.nome ?? ''} ${user.user_metadata?.cognome ?? ''}`.trim() ||
    user.email?.split('@')[0] ||
    'Utente'

  // Iniziali dall'azienda (coerenti con WorkspaceLogo) — NON dal nome account utente
  const displayName = workspace.ragione_sociale ?? workspace.name
  const initials = displayName
    .split(' ')
    .map((n: string) => n[0])
    .filter(Boolean)
    .join('')
    .toUpperCase()
    .slice(0, 2)

  // Tutorial primo accesso: legge il flag in modo TOLLERANTE — se la colonna
  // onboarding_tour_done non esiste ancora (migration 037 non applicata) la
  // query fallisce e il tour resta disattivato (tourDone=true).
  let tourDone = true
  try {
    const { data: tourRow, error: tourError } = await supabase
      .from('workspaces')
      .select('onboarding_tour_done' as 'id')
      .eq('id', workspace.id)
      .maybeSingle()
    if (!tourError && tourRow) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonna 037 non ancora in types/database.ts
      tourDone = (tourRow as any).onboarding_tour_done === true
    }
  } catch { /* colonna mancante */ }

  return (
    <AppShell
      workspace={workspace}
      fullName={fullName}
      userEmail={user.email ?? ''}
      initials={initials}
    >
      {children}
      <Suspense fallback={null}>
        <TourController tourDone={tourDone} />
      </Suspense>
    </AppShell>
  )
}
