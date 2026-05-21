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
 * Formatta un numero documento per la visualizzazione.
 * Il doc_number nel DB include già il prefisso (es. "Prev001/2026", "Fatt001/2026").
 * Ritorna '—' se il numero è null.
 */
export function formatDocNumber(
  docNumber: string | null | undefined,
  _docType?: string | null,
): string {
  if (!docNumber) return '—'
  return docNumber
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
