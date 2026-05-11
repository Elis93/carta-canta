// lib/free-trial.ts
// Logica piano Free: 8 preventivi totali (non bozze) + 30 giorni di trial.
// NON ha 'use server' — importabile sia da Server Actions che da API Routes.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export const FREE_DOC_LIMIT = 8
export const FREE_TRIAL_DAYS = 30

export interface FreeTrialStatus {
  blocked: boolean
  reason: 'trial_expired' | 'doc_limit' | null
  docsUsed: number
  trialExpiresAt: Date | null
  daysRemaining: number | null
}

type WorkspaceInput = {
  id: string
  plan: string
  free_trial_expires_at: string | null
}

export async function checkFreeBlock(
  workspace: WorkspaceInput,
  supabase: SupabaseClient<Database>
): Promise<FreeTrialStatus> {
  if (workspace.plan !== 'free') {
    return { blocked: false, reason: null, docsUsed: 0, trialExpiresAt: null, daysRemaining: null }
  }

  const now = new Date()
  const trialExpiresAt = workspace.free_trial_expires_at
    ? new Date(workspace.free_trial_expires_at)
    : null

  const daysRemaining = trialExpiresAt
    ? Math.ceil((trialExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null

  const trialExpired = trialExpiresAt ? now > trialExpiresAt : false

  // Conta preventivi non-bozza (ogni invio/registrazione manuale consuma uno slot)
  const { count } = await supabase
    .from('documents')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspace.id)
    .eq('doc_type', 'preventivo')
    .neq('status', 'draft')

  const docsUsed = count ?? 0
  const docLimitReached = docsUsed >= FREE_DOC_LIMIT

  if (trialExpired) {
    return { blocked: true, reason: 'trial_expired', docsUsed, trialExpiresAt, daysRemaining }
  }

  if (docLimitReached) {
    return { blocked: true, reason: 'doc_limit', docsUsed, trialExpiresAt, daysRemaining }
  }

  return { blocked: false, reason: null, docsUsed, trialExpiresAt, daysRemaining }
}
