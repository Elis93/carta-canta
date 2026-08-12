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

/**
 * Somma delle BASI delle note ATTIVE (annullate escluse).
 *
 * ⚠️ Base = totale − bollo della nota: da quando la nota porta il SUO bollo
 * (N4 chiusa sulle fonti, 11 ago), sommare i totali conterebbe i 2 € di
 * imposta come se fossero operazioni stornate — e su una fattura da 100 €
 * una nota piena da 102 € (100 + bollo) sembrerebbe superare il tetto.
 */
export function sommaNoteAttive(
  note: Array<{ total: number | null; bollo_amount?: number | null; status: string | null }>,
): number {
  return roundFiscale(
    note.filter(notaAttiva).reduce(
      (s, n) => s + baseStornabile(Number(n.total ?? 0), Number(n.bollo_amount ?? 0)),
      0,
    )
  )
}

/**
 * La base su cui si ragiona: il totale del documento MENO il suo bollo.
 *
 * ⚠️ Il bollo NON è un'operazione stornabile: è un'imposta, e ogni documento
 * (fattura E nota) paga il suo — il bollo della fattura originaria non si
 * recupera stornando (confermato sulle fonti l'11 ago). Senza questa
 * sottrazione, su una fattura forfettaria da 100 € + 2 € di bollo la prima
 * nota «piena» lasciava un residuo fantasma di 2 €: il tasto restava acceso
 * a fattura già stornata per intero (trovato al ricontrollo del 10 ago).
 */
export function baseStornabile(totale: number, bollo: number, ritenuta = 0): number {
  // ⚠️ La RITENUTA si RIAGGIUNGE (12 ago): `documents.total` della fattura col
  // condominio è già al netto del 4% trattenuto, ma la ritenuta è una vicenda
  // di PAGAMENTO, non una riduzione dell'operazione — le note di credito
  // stornano l'operazione al lordo. Senza il riaggiungo, lo storno pieno di
  // una fattura da 1.000+IVA 220−rit. 40 = 1.180 veniva bloccato dal tetto
  // (la NC piena vale 1.220) e l'unico rimedio offerto era una NC con
  // imponibile fiscalmente sbagliato.
  return Math.max(0, roundFiscale(totale - Math.max(0, bollo) + Math.max(0, ritenuta)))
}

/**
 * L'importo della ritenuta di un documento, ricostruito dai suoi campi con la
 * STESSA formula del motore (afterDiscount × pct): non è salvato come cifra.
 */
export function importoRitenuta(doc: {
  subtotal?: number | null
  discount_pct?: number | null
  discount_fixed?: number | null
  ritenuta_pct?: number | null
}): number {
  const pct = Number(doc.ritenuta_pct ?? 0)
  if (!(pct > 0)) return 0
  const afterDiscount = Math.max(
    0,
    roundFiscale(Number(doc.subtotal ?? 0) * (1 - (Number(doc.discount_pct ?? 0) / 100)) - Number(doc.discount_fixed ?? 0)),
  )
  return roundFiscale(afterDiscount * pct / 100)
}

/** Quanto si può ancora stornare. Mai negativo. */
export function residuoStornabile(totaleFattura: number, sommaNote: number): number {
  return Math.max(0, roundFiscale(totaleFattura - sommaNote))
}

/**
 * La nota (più le eventuali sorelle) supera la base della fattura?
 * È il controllo BLOCCANTE della trasmissione.
 * ⚠️ Tutti e tre i valori sono BASI (totale − bollo del rispettivo
 * documento): mai passare totali col bollo dentro.
 */
export function superaIlTetto(
  baseNota: number,
  sommaAltreNote: number,
  baseFattura: number,
): boolean {
  return roundFiscale(baseNota + sommaAltreNote) > baseFattura + TOLLERANZA_STORNO
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
