import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppShell } from './_components/AppShell'

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

  // Onboarding incompleto → redirect
  if (!workspace.ragione_sociale) redirect('/onboarding')

  // Dati utente per header
  const fullName: string =
    user.user_metadata?.full_name ||
    `${user.user_metadata?.nome ?? ''} ${user.user_metadata?.cognome ?? ''}`.trim() ||
    user.email?.split('@')[0] ||
    'Utente'

  const initials = fullName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <AppShell
      workspace={workspace}
      fullName={fullName}
      userEmail={user.email ?? ''}
      initials={initials}
    >
      {children}
    </AppShell>
  )
}
