// ============================================================
// Proposte a livelli (Base / Premium) — totali SEPARATI.
//
// PERCHÉ ESISTE (Eli, 7 ago 2026: "non si capisce se il totale è della
// proposta base o premium"): quando «Proponi più opzioni» è attivo, il
// documento porta le voci di TUTTE le proposte, ma i totali salvati in
// `documents` (subtotal/tax_amount/total) seguono una proposta sola — la
// Base — perché finché il cliente non sceglie è quella che fa fede.
// Il risultato era un numero senza etichetta: chi guardava non poteva
// sapere a quale delle due si riferisse.
//
// Qui i totali si calcolano UNA PROPOSTA ALLA VOLTA, con lo stesso motore
// fiscale del resto dell'app (`calcolaDocumento`): mai una somma di Base +
// Premium, che sarebbe una cifra che non esiste in nessuno scenario.
//
// ⚠️ Lo sconto globale del documento si applica a OGNI proposta: è uno
// sconto sul lavoro, non su una variante. Stesso comportamento della pagina
// pubblica, dove il cliente vede i totali delle proposte già scontati.
// ============================================================

import { calcolaDocumento } from '@/lib/fiscal/calcoli'
import type { FiscalOptions } from '@/types/index'

export type TierKey = 'base' | 'consigliata' | 'premium'

export const TIER_ORDER: readonly TierKey[] = ['base', 'consigliata', 'premium'] as const

export const TIER_LABEL: Record<TierKey, string> = {
  base: 'Base',
  consigliata: 'Consigliata',
  premium: 'Premium',
}

/** Voce nella forma minima che serve qui: il resto lo ignoriamo. */
export interface VoceConTier {
  description?: unknown
  unit?: unknown
  quantity?: unknown
  unit_price?: unknown
  discount_pct?: unknown
  vat_rate?: unknown
  bonus_tipo?: unknown
  bene_significativo?: unknown
  option_tier?: unknown
}

export interface TotaleProposta {
  tier: TierKey
  /** "Base" / "Premium" — pronto da mostrare */
  label: string
  subtotal: number
  taxAmount: number
  bollo: number
  total: number
  /** Quante voci compongono la proposta */
  count: number
}

/** Il livello di una voce; tutto ciò che non è riconosciuto è Base. */
export function tierOf(item: VoceConTier): TierKey {
  const t = String(item?.option_tier ?? 'base')
  return (TIER_ORDER as readonly string[]).includes(t) ? (t as TierKey) : 'base'
}

/** true se il documento contiene più di una proposta. */
export function hasPiuProposte(items: VoceConTier[]): boolean {
  return new Set(items.map(tierOf)).size > 1
}

/**
 * Un totale per ogni proposta presente, nell'ordine Base → Consigliata →
 * Premium. Le proposte senza voci non compaiono.
 */
export function totaliPerProposta(
  items: VoceConTier[],
  fiscalOpts: FiscalOptions
): TotaleProposta[] {
  return TIER_ORDER.flatMap((tier) => {
    const voci = items.filter((i) => tierOf(i) === tier)
    if (voci.length === 0) return []

    const perCalc = voci.map((v, idx) => ({
      id: String(idx),
      document_id: '',
      sort_order: idx,
      description: String(v.description ?? ''),
      unit: (v.unit as string | null) ?? 'pz',
      quantity: Number(v.quantity ?? 1),
      unit_price: Number(v.unit_price ?? 0),
      discount_pct: (v.discount_pct as number | null) ?? null,
      vat_rate: (v.vat_rate as number | null) ?? null,
      bonus_tipo: (v.bonus_tipo as string | null) ?? null,
      bene_significativo: (v.bene_significativo as boolean | null) ?? null,
      total: 0,
      ai_generated: false as boolean | null,
      ai_confidence: null as number | null,
    }))

    // Le proposte vivono SOLO sui preventivi: il bollo non si applica mai
    // (11 ago) — forzato qui così NESSUN chiamante può sbagliare.
    const f = calcolaDocumento(perCalc, { ...fiscalOpts, doc_type: 'preventivo' })
    return [{
      tier,
      label: TIER_LABEL[tier],
      subtotal: f.subtotal,
      taxAmount: f.taxAmount,
      bollo: f.bollo,
      total: f.total,
      count: voci.length,
    }]
  })
}
