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
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
