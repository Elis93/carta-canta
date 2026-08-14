// lib/free-trial.ts
// Logica piano Free: 8 preventivi + 8 fatture inviati + 30 giorni di trial.
// I contatori sent_quota_used (preventivi) e sent_invoice_quota_used (fatture,
// 083) sono storici: incrementati al primo invio e non decrementati mai,
// nemmeno in caso di delete del documento.
// NON ha 'use server' — importabile sia da Server Actions che da API Routes.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export const FREE_DOC_LIMIT = 8       // preventivi inviati
export const FREE_INVOICE_LIMIT = 8   // fatture inviate (083, decisione Eli 12 ago)
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
  /** Contatore storico degli invii di PREVENTIVI: non decrementato mai. */
  sent_quota_used: number
  /** Contatore storico degli invii di FATTURE (083). Opzionale: i chiamanti
   *  che controllano solo i preventivi non lo selezionano. */
  sent_invoice_quota_used?: number
}

// docType decide QUALE limite/contatore si guarda:
// - 'preventivo' (default): FREE_DOC_LIMIT su sent_quota_used;
// - 'fattura': FREE_INVOICE_LIMIT su sent_invoice_quota_used (083).
// Le note di credito NON passano di qui (non consumano quota).
// supabase non è più usato ma resta accettato per retrocompatibilità.
export function checkFreeBlock(
  workspace: WorkspaceForFreeCheck,
  docType: 'preventivo' | 'fattura' = 'preventivo',
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
  const isFattura = docType === 'fattura'
  const docsUsed = isFattura ? (workspace.sent_invoice_quota_used ?? 0) : workspace.sent_quota_used
  const limit = isFattura ? FREE_INVOICE_LIMIT : FREE_DOC_LIMIT
  const docLimitReached = docsUsed >= limit

  if (trialExpired) {
    return { blocked: true, reason: 'trial_expired', docsUsed, trialExpiresAt, daysRemaining }
  }

  if (docLimitReached) {
    return { blocked: true, reason: 'doc_limit', docsUsed, trialExpiresAt, daysRemaining }
  }

  return { blocked: false, reason: null, docsUsed, trialExpiresAt, daysRemaining }
}
