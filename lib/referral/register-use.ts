// ============================================================
// Registrazione dell'uso di un codice referral alla registrazione.
// Condiviso da signupAction (email/password) e da /auth/callback (OAuth):
// prima il referral valeva SOLO per la registrazione via form, non con
// Google — chi si iscriveva da un link ?ref con Google perdeva il credito.
// Best-effort: non deve mai bloccare la registrazione.
// ============================================================

import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Collega il nuovo iscritto (refereeOwnerId = owner del workspace appena creato)
 * al workspace del referrer titolare di `code`. No-op se il codice non esiste,
 * se il workspace non è ancora pronto, o se referrer e referee coincidono
 * (un auto-invito non deve contare).
 */
export async function registerReferralUse(code: string, refereeOwnerId: string): Promise<void> {
  const clean = code.trim().toUpperCase()
  if (!clean) return
  try {
    const admin = createAdminClient()
    // Le tabelle referral non sono nei tipi generati (migration 018)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = admin as any
    const { data: refCodeRow } = await db
      .from('referral_codes')
      .select('workspace_id')
      .eq('code', clean)
      .maybeSingle()
    if (!refCodeRow) return

    const { data: newWs } = await admin
      .from('workspaces')
      .select('id')
      .eq('owner_id', refereeOwnerId)
      .maybeSingle()

    if (newWs && newWs.id !== refCodeRow.workspace_id) {
      await db.from('referral_uses').insert({
        referrer_workspace_id: refCodeRow.workspace_id,
        referee_workspace_id: newWs.id,
        code: clean,
      })
    }
  } catch (e) {
    // Non critico — log silenzioso
    console.warn('[referral] registration failed', e)
  }
}
