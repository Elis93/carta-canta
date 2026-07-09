// ============================================================
// Area /studio del commercialista — controllo accessi (server only).
// L'accesso si deriva SEMPRE dai link attivi in accountant_links,
// matchati sull'email CONFERMATA dell'utente autenticato — MAI da
// parametri dell'URL (l'admin client bypassa la RLS: un IDOR qui =
// accesso cross-tenant). Revoca a effetto immediato (check per-request).
// ============================================================

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export interface StudioUser {
  id: string
  email: string
}

export interface ClientWorkspace {
  id: string
  name: string
  ragione_sociale: string | null
  piva: string | null
}

/** Utente loggato con email confermata, o null. */
export async function getStudioUser(): Promise<StudioUser | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return null
  // Email deve essere confermata (in prod le conferme sono obbligatorie).
  if (!user.email_confirmed_at) return null
  return { id: user.id, email: user.email.toLowerCase() }
}

/**
 * Workspace (clienti) a cui il commercialista ha accesso attivo.
 * Segna anche accepted_at/user_id al primo accesso (record-keeping;
 * l'autorizzazione resta basata sul match email + revoked_at null).
 */
export async function listClientWorkspacesForAccountant(user: StudioUser): Promise<ClientWorkspace[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabella 051 non in types/database.ts
  const admin = createAdminClient() as any
  let links: Array<{ id: string; workspace_id: string; accepted_at: string | null }> = []
  try {
    const { data } = await admin
      .from('accountant_links')
      .select('id, workspace_id, accepted_at')
      .eq('accountant_email', user.email) // user.email è già minuscolo (match esatto, no wildcard LIKE)
      .is('revoked_at', null)
    links = (data ?? []) as typeof links
  } catch {
    return [] // migration 051 non applicata
  }
  if (links.length === 0) return []

  // Bind al primo accesso (best-effort)
  const toAccept = links.filter((l) => !l.accepted_at).map((l) => l.id)
  if (toAccept.length > 0) {
    try {
      await admin
        .from('accountant_links')
        .update({ accepted_at: new Date().toISOString(), accountant_user_id: user.id })
        .in('id', toAccept)
    } catch { /* non blocca */ }
  }

  const admin2 = createAdminClient()
  const { data: wss } = await admin2
    .from('workspaces')
    .select('id, name, ragione_sociale, piva')
    .in('id', links.map((l) => l.workspace_id))
    .is('deleted_at', null)
  return ((wss ?? []) as ClientWorkspace[])
    .sort((a, b) => (a.ragione_sociale ?? a.name).localeCompare(b.ragione_sociale ?? b.name))
}

/**
 * Verifica che l'utente abbia un link ATTIVO verso quel workspace.
 * Ritorna il workspace o null. NON fidarsi mai del solo parametro URL.
 */
export async function assertAccountantAccess(
  user: StudioUser,
  workspaceId: string
): Promise<ClientWorkspace | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabella 051 non in types/database.ts
  const admin = createAdminClient() as any
  let link: { id: string } | null = null
  try {
    const { data } = await admin
      .from('accountant_links')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('accountant_email', user.email) // user.email è già minuscolo (match esatto, no wildcard LIKE)
      .is('revoked_at', null)
      .maybeSingle()
    link = data
  } catch {
    return null
  }
  if (!link) return null

  const admin2 = createAdminClient()
  const { data: ws } = await admin2
    .from('workspaces')
    .select('id, name, ragione_sociale, piva')
    .eq('id', workspaceId)
    .is('deleted_at', null)
    .maybeSingle()
  return (ws as ClientWorkspace) ?? null
}
