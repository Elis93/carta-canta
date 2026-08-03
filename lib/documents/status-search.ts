// ============================================================
// Ricerca per STATO nelle liste documenti (Eli 3 ago, punto 10):
// nel campo di ricerca si possono scrivere anche le DICITURE
// composte che l'app mostra ("bozza fattura", "fattura annullata")
// o loro parti/plurali ("annull", "annullate", "bozze fatt").
// Logica PURA condivisa da /preventivi e /fatture.
// ============================================================

/** Parole "di contorno" che non cambiano il filtro: "fattura annullata"
    deve filtrare le annullate esattamente come "annullata" da sola. */
const GENERIC_WORDS = new Set([
  'fattura', 'fatture', 'fatt',
  'preventivo', 'preventivi', 'prev',
  'documento', 'documenti', 'doc',
  'come', 'stato', 'in', 'il', 'la', 'le', 'i', 'da',
])

function tokens(qLow: string): string[] {
  return qLow.split(/\s+/).filter(Boolean)
}

/** La query senza le parole generiche ("fattura modificata" → "modificata"):
    serve ai check speciali dei chiamanti (sdi, modificata). */
export function coreQuery(qLow: string): string {
  return tokens(qLow).filter((t) => !GENERIC_WORDS.has(t)).join(' ')
}

function matchKeyword(
  token: string,
  keywords: Record<string, string | string[]>,
  minPrefix: number
): string | string[] | undefined {
  const exact = keywords[token]
  if (exact) return exact
  if (token.length < minPrefix) return undefined
  for (const [k, v] of Object.entries(keywords)) {
    // prefisso ("annull" → "annullata") oppure plurale/genere diverso
    // ("annullate" → stem "annullat" di "annullata")
    const stem = k.slice(0, -1)
    if (k.startsWith(token) || (stem.length >= 3 && token.startsWith(stem))) return v
  }
  return undefined
}

/**
 * Stati corrispondenti alla query, o null se la query NON è una ricerca
 * per stato (→ il chiamante prosegue con la ricerca testuale normale).
 * Regola: ogni parola non-generica deve corrispondere a uno stato
 * ("bozza mario" → null, è una ricerca di testo).
 */
export function statusesFromQuery(
  qLow: string,
  keywords: Record<string, string | string[]>,
  minPrefix: number
): string[] | null {
  const ts = tokens(qLow)
  if (ts.length === 0) return null
  const statuses = new Set<string>()
  let matched = false
  for (const t of ts) {
    if (GENERIC_WORDS.has(t)) continue
    const m = matchKeyword(t, keywords, minPrefix)
    if (!m) return null
    matched = true
    for (const s of Array.isArray(m) ? m : [m]) statuses.add(s)
  }
  return matched ? [...statuses] : null
}
