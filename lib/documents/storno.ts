// ============================================================
// STORNO — il tetto delle note di credito su una fattura.
//
// L'INVARIANTE (decisione Eli, 10 ago, col passaggio al multi-nota):
//   «La somma delle note di credito ATTIVE di una fattura non supera
//    il totale della fattura.»
//
// ⚠️ La ricognizione ha scoperto che il tetto NON esisteva nemmeno per la
// nota singola: la nota nasceva a importo pieno e il form permetteva di
// ALZARE gli importi — si poteva stornare più di quanto fatturato. Queste
// funzioni sono la fondazione: le usa la creazione (per far nascere la nota
// col residuo), la pagina della nota (per l'avviso) e la trasmissione (per
// il blocco fail-closed).
// ============================================================

import { roundFiscale } from '@/lib/fiscal/calcoli'

/**
 * Tolleranza del tetto: 1 centesimo, la stessa dello SdI (00421/00423).
 * Un residuo violato da un arrotondamento non deve bloccare una nota
 * legittima; uno vero sì.
 */
export const TOLLERANZA_STORNO = 0.01

/** Una nota conta nel tetto se non è annullata (le cestinate non arrivano qui). */
export function notaAttiva(n: { status: string | null }): boolean {
  return n.status !== 'rejected'
}

/** Somma dei totali delle note ATTIVE (annullate escluse). */
export function sommaNoteAttive(note: Array<{ total: number | null; status: string | null }>): number {
  return roundFiscale(
    note.filter(notaAttiva).reduce((s, n) => s + Number(n.total ?? 0), 0)
  )
}

/** Quanto si può ancora stornare. Mai negativo. */
export function residuoStornabile(totaleFattura: number, sommaNote: number): number {
  return Math.max(0, roundFiscale(totaleFattura - sommaNote))
}

/**
 * La nota (più le eventuali sorelle) supera il totale della fattura?
 * È il controllo BLOCCANTE della trasmissione.
 */
export function superaIlTetto(
  totaleNota: number,
  sommaAltreNote: number,
  totaleFattura: number,
): boolean {
  return roundFiscale(totaleNota + sommaAltreNote) > totaleFattura + TOLLERANZA_STORNO
}

/**
 * Prezzo unitario ridotto in proporzione al residuo, arrotondato PER DIFETTO
 * al centesimo.
 *
 * ⚠️ Per difetto, non mezzo-in-su: la seconda nota deve nascere DENTRO il
 * residuo. Arrotondando in su, una nota appena creata potrebbe già superare
 * il tetto di qualche centesimo — e il primo incontro dell'artigiano con la
 * funzione sarebbe un avviso di errore su importi che non ha mai toccato.
 */
export function scalaPrezzo(prezzo: number, fattore: number): number {
  if (!Number.isFinite(fattore) || fattore <= 0) return 0
  if (fattore >= 1) return prezzo
  // Prima si toglie il rumore binario (6 decimali bastano e avanzano per un
  // prezzo), POI si arrotonda per difetto al centesimo: senza questo passo
  // 100 × 0.29 = 28.999999999999996 diventerebbe 28.99 invece di 29.
  const preciso = Math.round(prezzo * fattore * 1e6) / 1e6
  // Epsilon ASSOLUTO in scala centesimi (1e-9 ≪ mezzo centesimo): anche
  // `33.3 × 100` in floating point fa 3329.999…95, e il floor lo mangerebbe.
  return Math.floor(preciso * 100 + 1e-9) / 100
}
