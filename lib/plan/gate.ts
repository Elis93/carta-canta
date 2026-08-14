// lib/plan/gate.ts
// Fondamenta del gating Pro→Free (downgrade, decisione Eli 12 ago).
// Regola: su Free le funzioni Pro si VEDONO ma sono bloccate e non
// richiamabili; i dati Pro NON si cancellano (tornando Pro riappaiono).
// Il gating vero va SEMPRE messo sul server; questi helper danno un
// linguaggio unico invece dei tanti `plan === 'free'` sparsi.

/** true se il piano non ha le funzioni Pro (Free o assente). */
export function isFreePlan(plan: string | null | undefined): boolean {
  return (plan ?? 'free') === 'free'
}

/** Copy unico dei blocchi Pro (tono formale, § 11 ago). */
export const PRO_LOCK_LABEL = 'Funzione Pro'
export const PRO_LOCK_CTA = 'Torna a Pro per sbloccare'
export const PRO_LOCK_HREF = '/abbonamento'
