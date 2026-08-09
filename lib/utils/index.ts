export { cn } from './cn'

export function formatCurrency(amount: number, currency = 'EUR', locale = 'it-IT'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(date: string | Date, locale = 'it-IT'): string {
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date))
}

/**
 * Formatta un numero documento per la visualizzazione (in-app).
 * - Rimuove eventuali prefissi letterali legacy (es. "Prev001/2026" → "001/2026").
 * - Per le FATTURE antepone il marcatore "Fatt. " per distinguerle dai preventivi
 *   (che restano "001/2026"). Il numero salvato nel DB resta pulito ("001/2026").
 * - Ritorna '—' se il numero è null.
 *
 * NB: usare SOLO per la visualizzazione in-app. Email e PDF usano il numero
 * grezzo (il PDF mostra già un grande "FATTURA"/"PREVENTIVO" in testata).
 */
/**
 * Toglie SOLO i prefissi letterali storici («Prev», «Fatt») dei documenti
 * creati prima della sessione 25.
 *
 * ⚠️ NON un generico `^[A-Za-z]+`: le NOTE DI CREDITO hanno il sezionale «NC»
 * DENTRO il numero vero (`NC001/2026`), e quel taglio lo mangia — facendo
 * sparire proprio ciò che tiene la loro sequenza distinta da quella delle
 * fatture. Un `001/2026` senza NC è il numero di una fattura che esiste già.
 *
 * Va usato OVUNQUE si ripulisca un numero di documento: il 9 agosto lo stesso
 * taglio era scritto a mano in tre punti diversi, e in uno di quelli finiva
 * dentro un campo che poi veniva RISALVATO nel database.
 */
export function stripPrefissoLegacy(docNumber: string): string {
  return docNumber.replace(/^(Prev|Fatt)/i, '')
}

export function formatDocNumber(
  docNumber: string | null | undefined,
  docType?: string | null,
): string {
  if (!docNumber) return '—'
  const clean = stripPrefissoLegacy(docNumber)
  // Le fatture si distinguono con il marcatore "Fatt."
  if (docType === 'fattura') return `Fatt. ${clean}`
  return clean
}

/**
 * Come si CHIAMA un documento nei testi dell'app.
 * ⚠️ Esiste perché il repo era pieno di `doc_type === 'fattura' ? 'Fattura' :
 * 'Preventivo'`: per esclusione, una NOTA DI CREDITO finiva chiamata
 * «Preventivo».
 */
export function docTypeLabel(docType: string | null | undefined): string {
  if (docType === 'fattura') return 'Fattura'
  if (docType === 'nota_credito') return 'Nota di credito'
  return 'Preventivo'
}

/**
 * In quale sezione dell'app VIVE un documento.
 * ⚠️ La nota di credito sta fra le Fatture: mandarla su `/preventivi/{id}`
 * porta a una pagina «non trovato», perché quella rotta carica solo i
 * preventivi.
 */
export function docTypePath(docType: string | null | undefined): 'fatture' | 'preventivi' {
  return docType === 'fattura' || docType === 'nota_credito' ? 'fatture' : 'preventivi'
}

/**
 * Interpreta un importo scritto in formato italiano.
 * Gestisce correttamente sia "1.500,50" (migliaia + virgola decimale) sia
 * "85.50" (punto decimale, uso comune da tastierino): senza virgola, un solo
 * punto seguito da 1-2 cifre è il separatore decimale, altrimenti è delle
 * migliaia. Ritorna NaN se non interpretabile.
 */
export function parseImportoIt(raw: string | null | undefined): number {
  const s = (raw ?? '').trim()
  if (!s) return NaN
  let cleaned: string
  if (s.includes(',')) {
    cleaned = s.replace(/\./g, '').replace(',', '.')
  } else {
    const parts = s.split('.')
    cleaned = parts.length === 2 && parts[1].length <= 2 ? s : s.replace(/\./g, '')
  }
  const n = Number(cleaned)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[\s]+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '')
}
