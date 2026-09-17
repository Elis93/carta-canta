// ============================================================
// CARTA CANTA — Riferimento a un documento dentro le EMAIL
//
// PERCHÉ ESISTE (bug del 12 set 2026, foto di Eli): sette template
// costruivano il riferimento con la stessa riga copiata
//   `#${documentNumber} — ${documentTitle}`
// che con un titolo VUOTO produceva l'oggetto «Il preventivo "" scade
// tra 3 giorni» e il corpo «#003/2026 — » col trattino appeso. E le
// route che al posto del titolo mancante passavano il NUMERO facevano
// uscire «003/2026 — 003/2026», il numero due volte.
//
// La regola vive QUI, una volta sola:
// - il numero si pulisce SEMPRE dai prefissi storici (Prev/Fatt);
// - niente «#»: nell'app i numeri compaiono nudi («003/2026»);
// - mai virgolette vuote, mai trattini appesi: se un pezzo manca,
//   sparisce anche la sua punteggiatura.
// PURO: niente I/O, testato in tests/unit/email/doc-ref.test.ts.
// ============================================================

import { stripPrefissoLegacy } from '@/lib/utils'

/**
 * Riferimento nel CORPO dell'email: «003/2026 — Titolo», «003/2026»,
 * «Titolo», oppure '' se non c'è niente da dire (il chiamante decide
 * come degradare la frase — di norma omettendo il riferimento).
 */
export function emailDocRef(docNumber?: string | null, title?: string | null): string {
  const num = docNumber ? stripPrefissoLegacy(docNumber).trim() : ''
  const tit = (title ?? '').trim()
  if (num && tit) return `${num} — ${tit}`
  return num || tit
}

/**
 * Riferimento nell'OGGETTO, da accodare alla parola «preventivo» /
 * «fattura»: « "Titolo"» (il titolo resta il preferito, com'era),
 * « 003/2026» quando il titolo manca, '' quando manca tutto.
 * Lo SPAZIO INIZIALE è incluso: `Il preventivo${ref} scade…` resta
 * ben formato in ogni caso, senza doppi spazi né «""».
 */
export function emailDocRefOggetto(docNumber?: string | null, title?: string | null): string {
  const tit = (title ?? '').trim()
  if (tit) return ` "${tit}"`
  const num = docNumber ? stripPrefissoLegacy(docNumber).trim() : ''
  return num ? ` ${num}` : ''
}
