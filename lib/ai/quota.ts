// ============================================================
// AI Import — quote e serbatoio (tabella ai_import_usage, migration 039)
//
// Tre livelli di protezione (decisione Eli 5 lug 2026 — tetto UNICO €50/mese):
//   1. Quota personale: Free 1 import A VITA (contato solo al salvataggio),
//      Pro/Team/Lifetime 15 al mese.
//   2. Serbatoio mensile dei gratuiti: 300 + 100 × ogni Pro attivo.
//   3. Kill-switch: cap assoluto 1500 import Free/mese (≈ sotto-budget €15).
//
// I conteggi globali usano l'admin client (attraversano i workspace).
// ============================================================

import { createAdminClient } from '@/lib/supabase/admin'

export const AI_IMPORT_FREE_LIFETIME = 1
export const AI_IMPORT_PRO_MONTHLY = 15
const TANK_BASE = 300
const TANK_PER_PRO = 100
const TANK_HARD_CAP = 1500 // kill-switch: ≈ €15/mese di sotto-budget

const PRO_PLANS = ['pro', 'team', 'lifetime']

export type AiImportQuota =
  | { allowed: true; isPro: boolean; remaining: number }
  | { allowed: false; reason: 'free_used' | 'pro_monthly' | 'tank_empty' | 'unavailable' }

function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7)
}

export async function getAiImportQuota(workspaceId: string, plan: string): Promise<AiImportQuota> {
  const isPro = PRO_PLANS.includes(plan)
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabella 039 non ancora in types/database.ts
  const db = admin as any
  const period = currentPeriod()

  try {
    if (isPro) {
      const { count, error } = await db
        .from('ai_import_usage')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .eq('period', period)
      if (error) return { allowed: false, reason: 'unavailable' }
      const used = count ?? 0
      if (used >= AI_IMPORT_PRO_MONTHLY) return { allowed: false, reason: 'pro_monthly' }
      return { allowed: true, isPro: true, remaining: AI_IMPORT_PRO_MONTHLY - used }
    }

    // Free — livello 1: quota a vita
    const { count: lifetimeCount, error: lifetimeError } = await db
      .from('ai_import_usage')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
    if (lifetimeError) return { allowed: false, reason: 'unavailable' }
    if ((lifetimeCount ?? 0) >= AI_IMPORT_FREE_LIFETIME) {
      return { allowed: false, reason: 'free_used' }
    }

    // Free — livelli 2+3: serbatoio globale del mese
    const [{ count: tankUsed }, { count: proCount }] = await Promise.all([
      db
        .from('ai_import_usage')
        .select('id', { count: 'exact', head: true })
        .eq('period', period)
        .eq('plan_at_use', 'free'),
      db
        .from('workspaces')
        .select('id', { count: 'exact', head: true })
        .in('plan', PRO_PLANS),
    ])
    const tankCapacity = Math.min(TANK_BASE + TANK_PER_PRO * (proCount ?? 0), TANK_HARD_CAP)
    if ((tankUsed ?? 0) >= tankCapacity) return { allowed: false, reason: 'tank_empty' }

    return { allowed: true, isPro: false, remaining: AI_IMPORT_FREE_LIFETIME - (lifetimeCount ?? 0) }
  } catch {
    return { allowed: false, reason: 'unavailable' }
  }
}

/** Registra un import SALVATO (chiamato solo al salvataggio nel catalogo). */
export async function recordAiImportUse(workspaceId: string, plan: string, itemsCount: number): Promise<void> {
  try {
    const admin = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabella 039 non ancora in types/database.ts
    await (admin as any).from('ai_import_usage').insert({
      workspace_id: workspaceId,
      period: currentPeriod(),
      plan_at_use: PRO_PLANS.includes(plan) ? 'pro' : 'free',
      items_count: itemsCount,
    })
  } catch { /* non bloccare il salvataggio se la registrazione fallisce */ }
}

/** Messaggio utente per quota esaurita — "opzione A" (mai "riprova più tardi"). */
export function quotaExhaustedMessage(reason: 'free_used' | 'pro_monthly' | 'tank_empty' | 'unavailable'): string {
  switch (reason) {
    case 'free_used':
    case 'tank_empty':
      return 'Hai finito gli import gratuiti. Con Pro importi quando vuoi.'
    case 'pro_monthly':
      return `Hai usato i ${AI_IMPORT_PRO_MONTHLY} import di questo mese. Si ricaricano il mese prossimo.`
    default:
      return 'AI Import non è disponibile al momento.'
  }
}
