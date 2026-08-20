// ============================================================
// CARTA CANTA — Definizioni piani e feature gating
// Fonte di verità per i limiti di ogni piano.
// ============================================================

import type { Database } from '@/types/database'

export type PlanType = Database['public']['Enums']['plan_type']

// FIX-21 (sessione FIX-05): l'AI Import è presentato come "Incluso"/feature
// del piano Pro/Team, ma il bottone nel form è disabilitato ("IN ARRIVO")
// finché il flag NEXT_PUBLIC_AI_IMPORT_ENABLED non è 'true' (vedi
// AiImportButton.tsx) — promettere una funzione non ancora attiva confonde
// l'utente. Questa costante permette a tutte le superfici di copy
// (impostazioni/piano, abbonamento, pricing) di mostrare "(in arrivo)"
// finché il flag è off, e "Incluso"/senza suffisso quando è on.
export const AI_IMPORT_ENABLED = process.env.NEXT_PUBLIC_AI_IMPORT_ENABLED === 'true'

/** Etichetta feature AI Import coerente con lo stato del flag */
export function aiImportLabel(base: string = 'AI Import'): string {
  return AI_IMPORT_ENABLED ? base : `${base} (in arrivo)`
}

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
    maxDocuments: 8,
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
  // FIX-28: lifetime rimosso dall'UI ma mantenuto qui per utenti esistenti
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
  stripeMode: 'subscription' | 'none'
  popular?: boolean
  features: string[]
}

// FIX-28: lifetime escluso dalla pricing UI (piano non più venduto)
export const PLAN_PRICING: Record<Exclude<PlanType, 'free' | 'lifetime'>, PlanPricing> = {
  pro: {
    name: 'Pro',
    description: 'Per artigiani che vogliono crescere',
    monthly: 19,
    yearly: 182,
    monthlyFromYearly: 15.17,
    stripeMode: 'subscription',
    popular: true,
    features: [
      'Preventivi e fatture illimitati',
      'Template illimitati',
      aiImportLabel('AI Import da foto/PDF'),
      'Filigrana rimovibile dal PDF',
      'Bilancio entrate/uscite e listini fornitori',
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
