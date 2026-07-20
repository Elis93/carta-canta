'use server'

// ============================================================
// Server Actions — passkey (sblocco con impronta). Lettura/eliminazione
// delle passkey dell'utente per la card in Impostazioni. La registrazione
// e la verifica passano dalle API route (serve il browser WebAuthn).
// ============================================================

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export type PasskeyInfo = { id: string; device_label: string | null; created_at: string; last_used_at: string | null }

export async function listMyPasskeysAction(): Promise<{ passkeys: PasskeyInfo[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { passkeys: [], error: 'Sessione scaduta.' }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabella 056 non ancora in types/database.ts
    const admin = createAdminClient() as any
    const { data } = await admin
      .from('passkeys')
      .select('id, device_label, created_at, last_used_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    return { passkeys: (data ?? []) as PasskeyInfo[] }
  } catch {
    // migration 056 non ancora applicata → nessuna passkey
    return { passkeys: [] }
  }
}

export async function deletePasskeyAction(id: string): Promise<{ error?: string } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sessione scaduta.' }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabella 056 non ancora in types/database.ts
  const admin = createAdminClient() as any
  const { error } = await admin.from('passkeys').delete().eq('id', id).eq('user_id', user.id)
  if (error) return { error: 'Rimozione non riuscita. Riprova.' }
  return null
}
