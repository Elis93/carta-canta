'use server'

// ============================================================
// CARTA CANTA — Server Actions per il sistema referral
// ============================================================

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Helper: recupera il workspace_id dell'utente corrente
async function getWorkspaceId(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: ws } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (ws) return ws.id

  const { data: m } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .not('accepted_at', 'is', null)
    .limit(1)
    .maybeSingle()

  return m?.workspace_id ?? null
}

// ── Recupera (o crea) il codice referral del workspace corrente ───────────
export async function getMyReferralCode(): Promise<string | null> {
  const workspaceId = await getWorkspaceId()
  if (!workspaceId) return null

  // Usa la RPC idempotente (SECURITY DEFINER, bypassa RLS)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any
  const { data } = await admin.rpc('get_or_create_referral_code', {
    p_workspace_id: workspaceId,
  })

  return (data as string | null) ?? null
}

// ── Statistiche referral per l'utente corrente ────────────────────────────
export interface ReferralStats {
  code: string | null
  totalUses: number        // iscrizioni tramite il codice
  paidConversions: number  // referee passati a piano pagamento (= rewards emessi)
  pendingRewards: number   // premi non ancora applicati (no stripe customer)
  totalFreeMonths: number  // mesi gratuiti maturati (applicati + pending)
}

export async function getMyReferralStats(): Promise<ReferralStats> {
  const empty: ReferralStats = {
    code: null,
    totalUses: 0,
    paidConversions: 0,
    pendingRewards: 0,
    totalFreeMonths: 0,
  }

  const workspaceId = await getWorkspaceId()
  if (!workspaceId) return empty

  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // Codice
  const { data: codeRow } = await db
    .from('referral_codes')
    .select('code')
    .eq('workspace_id', workspaceId)
    .maybeSingle() as { data: { code: string } | null }

  const code = codeRow?.code ?? null
  if (!code) return empty

  // Usi totali e premi
  const [{ data: uses }, { data: rewards }] = await Promise.all([
    db
      .from('referral_uses')
      .select('referee_workspace_id')
      .eq('referrer_workspace_id', workspaceId) as Promise<{ data: Array<{ referee_workspace_id: string }> | null }>,
    db
      .from('referral_rewards')
      .select('free_months, applied_at')
      .eq('workspace_id', workspaceId) as Promise<{ data: Array<{ free_months: number; applied_at: string | null }> | null }>,
  ])

  return {
    code,
    totalUses:       uses?.length ?? 0,
    paidConversions: rewards?.length ?? 0,
    pendingRewards:  rewards?.filter((r) => !r.applied_at).length ?? 0,
    totalFreeMonths: rewards?.reduce((s, r) => s + r.free_months, 0) ?? 0,
  }
}
