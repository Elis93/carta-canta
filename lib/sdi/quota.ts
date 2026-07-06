// ============================================================
// Quote SDI — decisioni Eli (riconciliate 6 lug 2026, tetto unico €50):
//   · Pro/Team/Lifetime: e-fattura ILLIMITATA (costo assorbito nel canone,
//     MAI mostrato all'utente — "Incluso nel piano Pro").
//   · Free: 8 trasmissioni di prova A VITA (contate all'invio, non
//     restituite alla cancellazione della fattura).
//   · Kill-switch globale: sotto-budget €15/mese ≈ 85 trasmissioni Free
//     (a ~€0,175 l'una invio+conservazione) → raggiunto il tetto, le
//     e-fatture Free vanno in pausa fino al mese successivo.
// ============================================================

import { createAdminClient } from '@/lib/supabase/admin'

export const SDI_FREE_LIFETIME = 8
const GLOBAL_FREE_MONTHLY_CAP = 85 // ≈ €15/mese a ~€0,175 a trasmissione

const PRO_PLANS = ['pro', 'team', 'lifetime']

export type SdiQuota =
  | { allowed: true; isPro: boolean; remaining: number | null } // null = illimitato
  | { allowed: false; reason: 'free_used' | 'budget_paused' | 'unavailable' }

function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7)
}

export async function getSdiQuota(workspaceId: string, plan: string): Promise<SdiQuota> {
  const isPro = PRO_PLANS.includes(plan)
  if (isPro) return { allowed: true, isPro: true, remaining: null }

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabella 044 non ancora in types/database.ts
  const db = admin as any

  try {
    // Livello 1 — quota personale a vita
    const { count: lifetime, error } = await db
      .from('sdi_usage')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
    if (error) return { allowed: false, reason: 'unavailable' }
    if ((lifetime ?? 0) >= SDI_FREE_LIFETIME) return { allowed: false, reason: 'free_used' }

    // Livello 2 — kill-switch globale mensile (sotto-budget €15)
    const { count: monthly } = await db
      .from('sdi_usage')
      .select('id', { count: 'exact', head: true })
      .eq('period', currentPeriod())
      .eq('plan_at_use', 'free')
    if ((monthly ?? 0) >= GLOBAL_FREE_MONTHLY_CAP) {
      return { allowed: false, reason: 'budget_paused' }
    }

    return { allowed: true, isPro: false, remaining: SDI_FREE_LIFETIME - (lifetime ?? 0) }
  } catch {
    return { allowed: false, reason: 'unavailable' }
  }
}

/** Registra la trasmissione (chiamata all'INVIO — mai restituita). */
export async function recordSdiUse(workspaceId: string, plan: string, documentId: string): Promise<void> {
  try {
    const admin = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabella 044 non ancora in types/database.ts
    await (admin as any).from('sdi_usage').insert({
      workspace_id: workspaceId,
      document_id: documentId,
      period: currentPeriod(),
      plan_at_use: PRO_PLANS.includes(plan) ? 'pro' : 'free',
    })
  } catch { /* non bloccare l'invio se la registrazione fallisce */ }
}

export function sdiQuotaMessage(reason: 'free_used' | 'budget_paused' | 'unavailable'): string {
  switch (reason) {
    case 'free_used':
      return `Hai usato le ${SDI_FREE_LIFETIME} e-fatture di prova incluse nel piano Free. Con Pro le e-fatture sono illimitate.`
    case 'budget_paused':
      return 'Le e-fatture di prova del piano Free riprendono il mese prossimo. Con Pro invii senza attese.'
    default:
      return 'La fatturazione elettronica non è disponibile al momento.'
  }
}
