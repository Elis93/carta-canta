// lib/free-trial.ts
// Logica piano Free: 8 preventivi totali + 30 giorni di trial.
// Il contatore sent_quota_used è storico: viene incrementato ad ogni primo invio
// e non decrementato mai, nemmeno in caso di delete del documento.
// NON ha 'use server' — importabile sia da Server Actions che da API Routes.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export const FREE_DOC_LIMIT = 8
export const FREE_TRIAL_DAYS = 30

// DECISIONE ELI (13 lug 2026): durante la BETA la scadenza dei 30 giorni è
// DISATTIVATA — resta solo il limite degli 8 preventivi. Al lancio
// commerciale basta rimettere questo flag a true (il trigger DB continua a
// popolare free_trial_expires_at, quindi la riattivazione è immediata).
export const FREE_TRIAL_ENFORCED = false

export interface FreeTrialStatus {
  blocked: boolean
  reason: 'trial_expired' | 'doc_limit' | null
  docsUsed: number
  trialExpiresAt: Date | null
  daysRemaining: number | null
}

export type WorkspaceForFreeCheck = {
  id: string
  plan: string
  free_trial_expires_at: string | null
  /** Contatore storico degli invii: non decrementato mai, nemmeno su delete. */
  sent_quota_used: number
}

// supabase è ancora accettato per retrocompatibilità della firma ma non più usato.
export function checkFreeBlock(
  workspace: WorkspaceForFreeCheck,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _supabase?: SupabaseClient<Database>
): FreeTrialStatus {
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

  const trialExpired = FREE_TRIAL_ENFORCED && trialExpiresAt ? now > trialExpiresAt : false

  // Fonte di verità: contatore storico sul workspace, non i documenti esistenti.
  // Sopravvive alle delete — il limite Free non è aggirabile con invia + cancella.
  const docsUsed = workspace.sent_quota_used
  const docLimitReached = docsUsed >= FREE_DOC_LIMIT

  if (trialExpired) {
    return { blocked: true, reason: 'trial_expired', docsUsed, trialExpiresAt, daysRemaining }
  }

  if (docLimitReached) {
    return { blocked: true, reason: 'doc_limit', docsUsed, trialExpiresAt, daysRemaining }
  }

  return { blocked: false, reason: null, docsUsed, trialExpiresAt, daysRemaining }
}
