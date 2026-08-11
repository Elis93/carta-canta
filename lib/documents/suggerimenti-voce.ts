// ── Suggerimenti voce mentre si scrive (richiesta Eli, 11 ago 2026) ─────────
//
// «Quando inserisco una nuova voce e questa voce esiste già nel catalogo o
// nei listini, vorrei che mi comparisse come suggerimento… non voglio una
// spatafiata di voci: alla prima lettera i primi dieci, poi sempre più mirati.»
//
// Questo modulo è PURO (niente React, niente Supabase): riceve il testo
// digitato e l'elenco delle fonti già caricate, restituisce al massimo
// MAX_SUGGERIMENTI risultati ordinati per pertinenza. Il filtraggio è in
// memoria: a ogni lettera la lista si restringe senza round-trip di rete,
// che è esattamente il comportamento «da grande app» chiesto.
//
// 🔒 Regola B.2: le fonti portano unit_cost (margine privato) — questo dato
// resta nel form dell'artigiano e non arriva mai a PDF/pagine pubbliche/email.

export const MAX_SUGGERIMENTI = 10

export type FonteVoce = {
  /** Testo che verrà inserito nella descrizione della voce */
  descrizione: string
  /** Nome della voce di catalogo (se diverso dalla descrizione): si cerca anche su questo */
  alias?: string | null
  unit: string
  unit_price: number
  vat_rate: number | null
  /** Costo d'acquisto — SOLO per il margine privato (B.2) */
  unit_cost: number | null
  /** Listino fornitore di origine (per l'aggancio scadenza) */
  supplier_list_id: string | null
  fonte: 'catalogo' | 'listino'
  /** Nome del listino, mostrato come provenienza */
  fonteNome?: string | null
}

/** minuscole + accenti normalizzati + spazi collassati: «Elèttrico» ≡ «elettrico» */
export function normalizzaTesto(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Pertinenza di un testo rispetto alla query (già normalizzati):
//   0 = il testo INIZIA con la query così com'è scritta
//   1 = ogni parola della query è l'inizio di una parola del testo
//       («caldaia cond» → «Caldaia a condensazione»)
//   2 = ogni parola della query compare da qualche parte nel testo
//  -1 = non pertinente
function pertinenza(testo: string, query: string, parole: string[]): number {
  if (!testo) return -1
  if (testo.startsWith(query)) return 0
  const paroleTesto = testo.split(' ')
  if (parole.every((p) => paroleTesto.some((t) => t.startsWith(p)))) return 1
  if (parole.every((p) => testo.includes(p))) return 2
  return -1
}

/**
 * Filtra e ordina le fonti per la query digitata. Al massimo `max` risultati:
 * prima chi inizia con la query, poi chi la contiene per parole, poi il resto.
 * A parità di pertinenza vince la descrizione più corta (più vicina a ciò che
 * si sta scrivendo), poi l'ordine alfabetico. I doppioni esatti
 * (stessa descrizione e stesso prezzo) compaiono una volta sola — e siccome
 * il catalogo viene passato PRIMA dei listini, a restare è la voce di catalogo.
 */
export function suggerisciVoci(
  query: string,
  fonti: FonteVoce[],
  max: number = MAX_SUGGERIMENTI,
): FonteVoce[] {
  const q = normalizzaTesto(query)
  if (!q) return []
  const parole = q.split(' ')

  const pertinenti: { fonte: FonteVoce; tier: number; chiave: string }[] = []
  for (const f of fonti) {
    const desc = normalizzaTesto(f.descrizione)
    if (!desc) continue
    const tDesc = pertinenza(desc, q, parole)
    const tAlias = f.alias ? pertinenza(normalizzaTesto(f.alias), q, parole) : -1
    const tier = tDesc === -1 ? tAlias : tAlias === -1 ? tDesc : Math.min(tDesc, tAlias)
    if (tier === -1) continue
    pertinenti.push({ fonte: f, tier, chiave: `${desc}|${f.unit_price}` })
  }

  pertinenti.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier
    const la = a.fonte.descrizione.length
    const lb = b.fonte.descrizione.length
    if (la !== lb) return la - lb
    return a.fonte.descrizione.localeCompare(b.fonte.descrizione, 'it')
  })

  const visti = new Set<string>()
  const out: FonteVoce[] = []
  for (const p of pertinenti) {
    if (visti.has(p.chiave)) continue
    visti.add(p.chiave)
    out.push(p.fonte)
    if (out.length >= max) break
  }
  return out
}
