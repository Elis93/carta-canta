// ============================================================
// Parsing dell'input "ore di lavoro" (formato italiano) → minuti interi.
// Estratto da OreLavoroCard per essere testabile in isolamento.
// - Ammette UN SOLO separatore decimale (virgola o punto): "1.5.5" (malformato)
//   verrebbe letto da parseImportoIt come 155 ore in silenzio → va rifiutato.
// - Ammette il segno meno per le correzioni ("-2" = togli 2 ore).
// ============================================================

import { parseImportoIt } from '@/lib/utils'

export type ParsedHours = { minutes: number } | { error: string }

/** Valida e converte le ore digitate in minuti interi, oppure ritorna un errore. */
export function parseManualHours(input: string): ParsedHours {
  const raw = input.trim().replace(/\s/g, '')
  if (!/^-?\d+(?:[.,]\d+)?$/.test(raw)) {
    return { error: 'Inserisci le ore in cifre (es. 1,5 — usa il segno meno per correggere).' }
  }
  const h = parseImportoIt(raw)
  if (!Number.isFinite(h) || h === 0) {
    return { error: 'Inserisci le ore (es. 1,5).' }
  }
  return { minutes: Math.round(h * 60) }
}
