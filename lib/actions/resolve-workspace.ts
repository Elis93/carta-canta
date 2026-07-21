// ============================================================
// resolveWorkspaceForUser — risolve il workspace di un utente per le azioni
// di lavoro quotidiano: prima come TITOLARE (owner_id), poi come COLLABORATORE
// invitato e accettato (workspace_members, piano Team). Stessa logica di
// getSessionWorkspace (lib/workspace-context.ts), ma con select richiesta dal
// chiamante e senza cache React (utilizzabile da server action e API route).
//
// ⚠️ NON usare per le aree riservate al titolare — abbonamento/fatturazione,
// eliminazione account, gestione team, referral, impostazioni workspace,
// profilo marketplace: lì il lookup su owner_id è una GUARDIA voluta.
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- select dinamica: le colonne richieste variano per chiamante, il tipo riga non è derivabile staticamente
export async function resolveWorkspaceForUser<T = any>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- accetta sia il client server (RLS) sia l'admin client
  supabase: any,
  userId: string,
  select: string
): Promise<T | null> {
  const { data: owned } = await supabase
    .from('workspaces')
    .select(select)
    .eq('owner_id', userId)
    .maybeSingle()
  if (owned) return owned as T

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', userId)
    .not('accepted_at', 'is', null)
    // Membro di più team: scegli sempre il PRIMO accettato (deterministico),
    // non un workspace arbitrario che cambierebbe tra una chiamata e l'altra.
    .order('accepted_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (!membership) return null

  const { data: memberWs } = await supabase
    .from('workspaces')
    .select(select)
    .eq('id', membership.workspace_id)
    .maybeSingle()
  return (memberWs as T) ?? null
}
