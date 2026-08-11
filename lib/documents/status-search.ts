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
  'come', 'stato', 'in', 'il', 'la', 'le', 'i', 'da', 'con',
  'collegata', 'collegate', 'collegato',
])

/** Diciture di stato delle FATTURE (fonte unica: usata dalla lista fatture
    e dalla ricerca "fattura collegata" dentro la lista preventivi). */
export const FATTURA_STATUS_KEYWORDS: Record<string, string | string[]> = {
  'bozza': 'draft', 'bozze': 'draft',
  'inviata': 'sent', 'inviato': 'sent', 'inviati': 'sent',
  'aperta': 'viewed', 'aperto': 'viewed',
  'pagata': 'accepted', 'pagato': 'accepted', 'pagati': 'accepted', 'pagamento': 'accepted',
  'annullata': 'rejected', 'annullato': 'rejected',
  'scaduta': 'expired', 'scaduto': 'expired',
}

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

const FATTURA_WORDS = new Set(['fattura', 'fatture', 'fatt'])

/**
 * Ricerca "FATTURA COLLEGATA" dentro la lista PREVENTIVI (Eli 3 ago sera,
 * chiarimento punto 10): scrivendo "fattura annullata" / "bozza fattura" /
 * "fattura" si cercano i preventivi che HANNO una fattura collegata (in
 * quello stato). La parola "fattura" è l'interruttore.
 * Ritorna:
 *  - null                → non è una ricerca di questo tipo
 *  - { statuses: null }  → qualsiasi fattura collegata ("fattura" da sola)
 *  - { statuses: [...] } → fattura collegata in quegli stati
 */
export function linkedFatturaQuery(qLow: string): { statuses: string[] | null } | null {
  const ts = tokens(qLow)
  if (!ts.some((t) => FATTURA_WORDS.has(t))) return null
  const rest = ts.filter((t) => !GENERIC_WORDS.has(t))
  if (rest.length === 0) return { statuses: null }
  const statuses = statusesFromQuery(rest.join(' '), FATTURA_STATUS_KEYWORDS, 2)
  // "fattura mario" → non è una ricerca di stato: lascia la ricerca testuale
  return statuses ? { statuses } : null
}

/** Esiti SdI (valori della colonna sdi_status) per la ricerca "sdi <esito>"
    nella lista fatture (Eli 3 ago sera). Stesse diciture dei badge. */
const SDI_ESITO_KEYWORDS: Record<string, string> = {
  'inviata': 'inviata', 'inviate': 'inviata', 'inviato': 'inviata',
  'consegnata': 'consegnata', 'consegnate': 'consegnata',
  'emessa': 'mancata_consegna', 'emesse': 'mancata_consegna', 'mancata': 'mancata_consegna',
  'scartata': 'scartata', 'scartate': 'scartata',
}

/**
 * Ricerca SdI nella lista FATTURE: la parola "sdi" è l'interruttore.
 *  - null              → non è una ricerca SdI
 *  - { esiti: null }   → tutte le fatture passate dallo SdI ("sdi" da sola)
 *  - { esiti: [...] }  → solo quegli esiti ("sdi consegnata", "sdi scartate")
 * "sdi caldaia" (parola non-esito) → null: resta la ricerca testuale.
 */
export function sdiEsitoQuery(qLow: string): { esiti: string[] | null } | null {
  const ts = tokens(qLow)
  if (!ts.includes('sdi')) return null
  const rest = ts.filter((t) => t !== 'sdi' && !GENERIC_WORDS.has(t))
  if (rest.length === 0) return { esiti: null }
  const esiti = new Set<string>()
  for (const t of rest) {
    const m = matchKeyword(t, SDI_ESITO_KEYWORDS, 3)
    if (!m) return null
    for (const s of Array.isArray(m) ? m : [m]) esiti.add(s)
  }
  return { esiti: [...esiti] }
}

// ── «Nota di credito» nel cerca (Eli, 9 ago: *"deve essere cercabile parziale
// o totale"*) ────────────────────────────────────────────────────────────────
// Si scrive come viene: «nota di credito», «nota credito», «note», «credito»,
// «nc», o un pezzo qualsiasi («not», «cred», «nota di cre»).
//
// ⚠️ Le parole si controllano UNA PER UNA e devono TUTTE appartenere al
// vocabolario della nota di credito. Senza questa condizione «nota caldaia»
// filtrerebbe le note di credito invece di cercare «caldaia» nel testo — cioè
// la ricerca ruberebbe una parola che l'artigiano usa per altro.
const NOTA_CREDITO_WORDS = ['nota', 'note', 'credito', 'crediti', 'nc', 'td04', 'storno', 'stornare']

// Stesso schema per la nota di DEBITO. ⚠️ «nota» e «note» stanno in ENTRAMBI i
// vocabolari: da sole devono trovare tutte e due le famiglie, ed è la lista
// chiamante a unire i due filtri — cercare «nota» e vedere solo metà delle
// note sarebbe peggio che non cercarle affatto.
const NOTA_DEBITO_WORDS = ['nota', 'note', 'debito', 'debiti', 'nd', 'td05', 'integrazione', 'integrare']

export function isNotaDebitoQuery(qLow: string): boolean {
  const ts = tokens(qLow).filter((t) => !GENERIC_WORDS.has(t) && t !== 'di')
  if (ts.length === 0) return false
  return ts.every((t) =>
    NOTA_DEBITO_WORDS.some((w) => (t.length <= 2 ? t === w : w.startsWith(t) && t.length >= 3))
  )
}

export function isNotaCreditoQuery(qLow: string): boolean {
  const ts = tokens(qLow).filter((t) => !GENERIC_WORDS.has(t) && t !== 'di')
  if (ts.length === 0) return false
  return ts.every((t) =>
    // parziale in ENTRAMBI i versi: «cred» sta dentro «credito» (uno digita
    // poco), e «creditooo» no — ma «nc» è di due lettere e va confrontato
    // per intero, altrimenti prenderebbe qualunque parola che lo contiene.
    NOTA_CREDITO_WORDS.some((w) => (t.length <= 2 ? t === w : w.startsWith(t) && t.length >= 3))
  )
}
