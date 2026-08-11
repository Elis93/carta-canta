// ============================================================
// Il NUMERO di un documento: formato, validazione, varianti di ricerca.
//
// ⚠️ ESISTE PERCHÉ LA REGOLA ERA SCRITTA A MANO IN PIÙ PUNTI. `DOC_NUMBER_RE`
// viveva in due copie (il form e la Server Action) e il formato della nota di
// credito in una terza: aggiungere lo spazio al sezionale «NC» senza toccare
// tutte e tre avrebbe prodotto un numero che il form RIFIUTA come «formato non
// valido» — cioè la funzione che non parte, in silenzio.
// È la stessa lezione del 9 agosto sul taglio dei prefissi.
// ============================================================

/**
 * Formato ammesso per il numero di un documento.
 *
 * Da 1 a 6 cifre, slash, anno a 4 cifre, con un eventuale **sezionale**
 * davanti — e uno spazio facoltativo fra il sezionale e il numero:
 * `001/2026` · `Prev001/2026` (storico) · `NC 001/2026`.
 *
 * ⚠️ Lo spazio è consentito anche allo SdI: nel tracciato FatturaPA il campo
 * `Numero` è **String20Type**, `xs:normalizedString` con pattern
 * `(\p{IsBasicLatin}{1,20})` — e lo spazio (U+0020) sta nel blocco Basic
 * Latin. L'unico vincolo di contenuto è il controllo **00425**: il numero deve
 * contenere almeno un carattere numerico. Le nostre cifre ci sono sempre.
 */
// Lo spazio è ammesso SOLO dopo un sezionale (mai « 001/2026» con lo spazio
// orfano), e il sezionale è al massimo di 8 lettere: 8 + spazio + 6 cifre +
// slash + 4 cifre = 20 — il tetto dello String20Type FatturaPA.
export const DOC_NUMBER_RE = /^(?:[A-Za-z]{1,8} ?)?\d{1,6}\/\d{4}$/

/** Sezionale delle note di credito: separato da quello delle fatture. */
export const NC_PREFIX = 'NC'

/**
 * Numero di una nota di credito: `NC 001/2026`.
 *
 * ⚠️ Lo spazio è una scelta di LEGGIBILITÀ (Eli, 10 ago), non una decorazione:
 * il sezionale resta parte del numero, ed è ciò che tiene la sequenza delle
 * note distinta da quella delle fatture — `001/2026` da solo è il numero di
 * una fattura che esiste già.
 */
export function formatNotaCreditoNumber(seq: number, year: number): string {
  return `${NC_PREFIX} ${String(seq).padStart(3, '0')}/${year}`
}

/** Sezionale della nota di DEBITO: «ND 001/2026». Stessa forma della nota di
 *  credito e stessa ragione — una sequenza propria tiene i tre registri
 *  (fatture, note di credito, note di debito) distinti e leggibili. */
export const ND_PREFIX = 'ND'
export function formatNotaDebitoNumber(seq: number, year: number): string {
  return `${ND_PREFIX} ${String(seq).padStart(3, '0')}/${year}`
}

/**
 * Come si scrive un numero dentro un NOME DI FILE (PDF, XML).
 * Lo slash non è ammesso nei nomi di file; lo spazio sì, ma un allegato che si
 * chiama «NC 001-2026.pdf» si spezza in mille modi diversi fra client di posta
 * e sistemi operativi.
 */
export function docNumberSlug(v: string): string {
  return v.replace(/\//g, '-').replace(/\s+/g, '-')
}

/**
 * Le grafie ALTERNATIVE di un numero digitato nella ricerca.
 *
 * ⚠️ Serve perché le due grafie convivono: le note create prima del 10 agosto
 * sono salvate `NC001/2026`, quelle nuove `NC 001/2026`. Chi cerca «NC001»
 * deve trovare anche le seconde, e viceversa — altrimenti la ricerca nega
 * l'esistenza di un documento che esiste (è la regola dell'8 agosto
 * sull'archivio, applicata al numero).
 *
 * Ritorna sempre la query originale per prima, e le varianti solo quando ha
 * senso — mai una lista di rumore.
 */
export function numeroVarianti(q: string): string[] {
  const base = q.trim()
  if (!base) return []
  const out = [base]
  // «nc001» → «nc 001»: lettere attaccate a cifre, si prova anche staccate.
  const staccato = base.replace(/^([A-Za-z]+)(\d)/, '$1 $2')
  if (staccato !== base) out.push(staccato)
  // «nc 001» → «nc001»: il caso opposto, per i documenti vecchi.
  const attaccato = base.replace(/^([A-Za-z]+)\s+(\d)/, '$1$2')
  if (attaccato !== base && !out.includes(attaccato)) out.push(attaccato)
  return out
}
