import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'

type WorkspaceRow = Database['public']['Tables']['workspaces']['Row']

/**
 * PERF — contesto sessione condiviso per richiesta.
 *
 * Layout e pagina facevano OGNUNO: getUser() → workspace per owner →
 * fallback membro (2-3 round trip Supabase ciascuno, in serie).
 * React cache() memoizza per singola richiesta: la prima chiamata (layout o
 * pagina, renderizzano in parallelo) esegue le query, le altre riusano la
 * stessa Promise. Risparmio: ~3 round trip per navigazione.
 *
 * Il workspace è selezionato con '*' (riga intera) così ogni pagina trova
 * le colonne che le servono senza select dedicate.
 */
export const getSessionUser = cache(async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
})

export const getSessionWorkspace = cache(async () => {
  const { supabase, user } = await getSessionUser()
  if (!user) {
    return { supabase, user: null, workspace: null as WorkspaceRow | null }
  }

  // Prima come owner, poi come membro invitato (piano Team).
  let { data: workspace } = await supabase
    .from('workspaces')
    .select('*')
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
        .select('*')
        .eq('id', membership.workspace_id)
        .maybeSingle()
      workspace = memberWorkspace
    }
  }

  return { supabase, user, workspace: workspace as WorkspaceRow | null }
})
