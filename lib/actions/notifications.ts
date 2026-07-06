'use server'

// Segna lette le notifiche della campanella (notification_reads, migration 040).

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function markNotificationsReadAction(
  keys: string[],
  opts?: { revalidate?: boolean }
): Promise<{ error?: string } | null> {
  if (!Array.isArray(keys) || keys.length === 0 || keys.length > 200) return null
  const cleanKeys = keys.filter((k) => typeof k === 'string' && /^[a-z_]+:[\w-]+$/.test(k))
  if (cleanKeys.length === 0) return null

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato.' }

  let { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
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
    if (membership) workspace = { id: membership.workspace_id }
  }
  if (!workspace) return { error: 'Workspace non trovato.' }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabella 040 non ancora in types/database.ts
    await (supabase as any)
      .from('notification_reads')
      .upsert(
        cleanKeys.map((k) => ({ workspace_id: workspace!.id, notif_key: k })),
        { onConflict: 'workspace_id,notif_key' }
      )
  } catch { /* migration 040 non ancora applicata */ }

  // revalidate: false quando l'utente sta NAVIGANDO verso il documento —
  // la revalidation concorrente può interrompere la navigazione in corso
  // (il tocco sembrava "morto"). Le pagine rileggono comunque dal DB.
  if (opts?.revalidate !== false) {
    revalidatePath('/notifiche')
    revalidatePath('/dashboard')
  }
  return null
}
