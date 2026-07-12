// ============================================================
// Helper CSV condivisi — formato "Excel italiano":
// separatore ";", importi con la virgola, date gg/mm/aaaa.
// csvCell include l'anti CSV/formula-injection (un valore che inizia
// con = + - @ TAB CR verrebbe eseguito come formula da Excel).
// Usati dagli export per il commercialista (bilancio, registro fatture).
// ============================================================

export function csvCell(v: string): string {
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v
  return /[";\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export function itAmount(n: number): string {
  return n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function itDate(d: Date): string {
  // Sempre in ora italiana: sul server (UTC) una fattura inviata l'1/1 alle
  // 00:30 di Roma verrebbe altrimenti stampata come 31/12.
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Rome' })
}

/**
 * Data YYYY-MM-DD valida DAVVERO (il solo regex accetta 2026-13-45).
 * Il round-trip via toISOString smaschera anche i giorni "arrotolati"
 * da JS (2026-02-30 → 2 marzo).
 */
export function isValidIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

/**
 * Mezzanotte di Roma per una data YYYY-MM-DD, come istante UTC.
 * Serve per i confini from/to degli export: il server gira in UTC e
 * `new Date('YYYY-MM-DDT00:00:00')` sposterebbe il confine di 1-2 ore.
 */
export function romeDayStart(dateStr: string): Date {
  const probe = new Date(`${dateStr}T00:00:00Z`)
  const tzName = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Rome', timeZoneName: 'longOffset' })
    .formatToParts(probe)
    .find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+01:00'
  const m = tzName.match(/GMT([+-]\d{2}):?(\d{2})?/)
  const off = m ? `${m[1]}:${m[2] ?? '00'}` : '+01:00'
  return new Date(`${dateStr}T00:00:00${off}`)
}
