// ============================================================
// CARTA CANTA — Definizioni piani e feature gating
// Fonte di verità per i limiti di ogni piano.
// ============================================================

import type { Database } from '@/types/database'

export type PlanType = Database['public']['Enums']['plan_type']

// ── Limiti e feature per piano ────────────────────────────────────────────

export interface PlanFeatures {
  maxDocuments: number    // Infinity per illimitati
  maxTemplates: number
  aiImport: boolean
  watermark: boolean       // true = watermark sul PDF
  teamMembers: number      // 0 = solo owner
  approvalWorkflow: boolean
}

export const PLAN_FEATURES: Record<PlanType, PlanFeatures> = {
  free: {
    maxDocuments: 10,
    maxTemplates: 1,
    aiImport: false,
    watermark: true,
    teamMembers: 0,
    approvalWorkflow: false,
  },
  pro: {
    maxDocuments: Infinity,
    maxTemplates: Infinity,
    aiImport: true,
    watermark: false,
    teamMembers: 0,
    approvalWorkflow: false,
  },
  team: {
    maxDocuments: Infinity,
    maxTemplates: Infinity,
    aiImport: true,
    watermark: false,
    teamMembers: 5,
    approvalWorkflow: true,
  },
  lifetime: {
    maxDocuments: Infinity,
    maxTemplates: Infinity,
    aiImport: true,
    watermark: false,
    teamMembers: 0,
    approvalWorkflow: false,
  },
}

// ── Pricing per la UI (non da Stripe — prezzi di listino) ─────────────────

export interface PlanPricing {
  name: string
  description: string
  monthly: number       // prezzo mensile (€)
  yearly: number        // prezzo annuale totale (€)
  monthlyFromYearly: number  // prezzo mensile equivalente da piano annuale
  oneTime?: number      // solo per Lifetime
  stripeMode: 'subscription' | 'payment' | 'none'
  popular?: boolean
  features: string[]
}

export const PLAN_PRICING: Record<Exclude<PlanType, 'free'>, PlanPricing> = {
  pro: {
    name: 'Pro',
    description: 'Per artigiani che vogliono crescere',
    monthly: 19,
    yearly: 182,
    monthlyFromYearly: 15.17,
    stripeMode: 'subscription',
    popular: true,
    features: [
      'Preventivi illimitati',
      'Template illimitati',
      'AI Import da foto/PDF',
      'PDF senza watermark',
      'Link pubblico + accettazione digitale',
      'Auto-save ogni 30 secondi',
      'Supporto email prioritario',
    ],
  },
  team: {
    name: 'Team',
    description: 'Per studi e piccole imprese',
    monthly: 49,
    yearly: 470,
    monthlyFromYearly: 39.17,
    stripeMode: 'subscription',
    features: [
      'Tutto di Pro',
      'Fino a 5 collaboratori',
      'Workflow approvazione preventivi',
      'Permessi per ruolo (admin/operator)',
      'Dashboard condivisa',
      'Supporto prioritario dedicato',
    ],
  },
  lifetime: {
    name: 'Lifetime',
    description: 'Paghi una volta, usi per sempre',
    monthly: 0,
    yearly: 0,
    monthlyFromYearly: 0,
    oneTime: 299,
    stripeMode: 'payment',
    features: [
      'Tutto di Pro per sempre',
      'Aggiornamenti inclusi',
      'Una tantum — nessun abbonamento',
      'Garanzia rimborso 30 giorni',
    ],
  },
}

// ── Utility ───────────────────────────────────────────────────────────────

/** Restituisce i limiti del piano corrente */
export function getPlanFeatures(plan: PlanType): PlanFeatures {
  return PLAN_FEATURES[plan]
}

/** Verifica se il piano ha accesso a una feature */
export function canUsePlanFeature(plan: PlanType, feature: keyof PlanFeatures): boolean {
  const f = PLAN_FEATURES[plan][feature]
  return typeof f === 'boolean' ? f : (f as number) > 0
}

/** Verifica se il piano è a pagamento */
export function isPaidPlan(plan: PlanType): boolean {
  return plan !== 'free'
}
