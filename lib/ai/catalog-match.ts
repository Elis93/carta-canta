// ============================================================
// CARTA CANTA — Abbinamento voce↔catalogo (DETERMINISTICO).
// È il GUARDIANO DEI PREZZI della feature "preventivo dalle foto":
// il prezzo di una voce può venire SOLO da qui, mai dall'AI.
// Data una descrizione (suggerita dall'AI) e il catalogo dell'utente,
// trova la voce di catalogo che combacia e ne restituisce prezzo e
// unità REALI. Se non c'è un abbinamento sicuro → null (la voce sarà
// "da prezzare"). Prudente per scelta: meglio non abbinare che
// attaccare un prezzo sbagliato.
// Nessuna chiamata AI, nessuna rete: pura logica → testabile al 100%.
// ============================================================

export interface CatalogEntry {
  name: string
  unit: string | null
  unit_price: number | null
}

export interface CatalogMatch {
  unit_price: number
  unit: string | null
  catalogName: string
  score: number
}

// Parole troppo generiche per contare nell'abbinamento (evitano falsi match
// del tipo "manodopera idraulica" ~ "manodopera elettrica").
const STOPWORDS = new Set([
  'di', 'da', 'del', 'della', 'dei', 'delle', 'e', 'a', 'al', 'con', 'per',
  'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'uno', 'una', 'in', 'su', 'the',
])

/** Normalizza in token significativi: minuscolo, senza accenti/punteggiatura. */
export function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // accenti
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t))
}

/**
 * Cerca la voce di catalogo che combacia con la descrizione.
 * Soglia volutamente alta: richiede che la MAGGIOR PARTE dei token
 * significativi della voce di catalogo sia coperta dalla descrizione,
 * così "manodopera idraulica" non pesca "manodopera elettrica".
 */
export function matchCatalog(
  description: string,
  catalog: CatalogEntry[],
  threshold = 0.6
): CatalogMatch | null {
  const descTokens = new Set(tokenize(description))
  if (descTokens.size === 0) return null

  let best: CatalogMatch | null = null
  for (const entry of catalog) {
    if (entry.unit_price == null || !Number.isFinite(entry.unit_price)) continue
    const catTokens = tokenize(entry.name)
    if (catTokens.length === 0) continue

    // Quota dei token della VOCE DI CATALOGO coperti dalla descrizione:
    // garantisce che l'abbinamento riguardi davvero quella voce, non una simile.
    const covered = catTokens.filter((t) => descTokens.has(t)).length
    const score = covered / catTokens.length
    if (score >= threshold && (!best || score > best.score)) {
      best = { unit_price: entry.unit_price, unit: entry.unit, catalogName: entry.name, score }
    }
  }
  return best
}
