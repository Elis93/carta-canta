// ============================================================
// CARTA CANTA — AI Extraction Types
// Tutti i tipi e lo schema Zod per la validazione dell'output AI.
// L'output AI viene SEMPRE validato prima di essere usato (regola CLAUDE_v4.md §5).
// ============================================================

import { z } from 'zod/v4'

// ── Schema Zod per voce estratta ────────────────────────────────────────────

export const ExtractedItemSchema = z.object({
  description: z.string().min(1, 'Descrizione mancante'),
  unit: z.string().default('pz'),
  quantity: z.number({ error: 'Quantità non valida' }).positive().default(1),
  unit_price: z.number({ error: 'Prezzo non valido' }).nonnegative().default(0),
  discount_pct: z.number().min(0).max(100).nullable().optional(),
  vat_rate: z.number().nonnegative().nullable().optional(),
  /** 0–1: grado di confidenza dell'AI sull'estrazione di questa voce */
  confidence: z.number().min(0).max(1).default(0.5),
})

export const ExtractResultSchema = z.object({
  items: z.array(ExtractedItemSchema).min(1, 'Nessuna voce estratta'),
  /** Titolo suggerito per il preventivo */
  suggested_title: z.string().optional(),
  /** Note aggiuntive suggerite */
  suggested_notes: z.string().optional(),
})

// ── Tipi derivati ───────────────────────────────────────────────────────────

export type ExtractedItem = z.infer<typeof ExtractedItemSchema>
export type ExtractResult = z.infer<typeof ExtractResultSchema> & {
  provider: 'openai' | 'mistral'
}

// ── Tipi per il payload della richiesta API ─────────────────────────────────

export const ACCEPTED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
] as const

export type AcceptedMimeType = typeof ACCEPTED_MIME_TYPES[number]

export const MAX_FILE_SIZE_MB = 10
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

// ── Confidence thresholds ───────────────────────────────────────────────────

export const CONFIDENCE_HIGH = 0.8    // verde
export const CONFIDENCE_MED  = 0.5    // giallo
// < 0.5 → rosso

export function confidenceLabel(c: number): 'high' | 'medium' | 'low' {
  if (c >= CONFIDENCE_HIGH) return 'high'
  if (c >= CONFIDENCE_MED)  return 'medium'
  return 'low'
}

export function confidenceColor(c: number): string {
  if (c >= CONFIDENCE_HIGH) return 'text-green-600'
  if (c >= CONFIDENCE_MED)  return 'text-amber-500'
  return 'text-destructive'
}
