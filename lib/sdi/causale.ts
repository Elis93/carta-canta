// ============================================================
// Diciture di legge del regime forfettario per l'XML FatturaPA.
// Il campo <Causale> è ripetibile e lungo max 200 caratteri: le due
// diciture viaggiano come DUE <Causale> separate (join con '\n',
// spezzato in xml.ts). Fase 1 della ritenuta d'acconto (27 lug):
// senza la riga del comma 67 un condominio committente trattiene
// il 4% per errore a un forfettario, che invece è ESENTE.
//
// ⚖️ 18 set 2026: la dicitura IVA è quella PRESCRITTA PER ISCRITTO dallo
// studio del commercialista e vive in UN posto solo (calcoli.ts), così
// PDF e XML non possono divergere.
// ============================================================

import { FORFETTARIO_LEGAL_NOTICE } from '@/lib/fiscal/calcoli'
import { dettaglioBeniSignificativi, testoDicituraBeni, type VoceSplittabile } from '@/lib/fiscal/beni-significativi'

export const CAUSALE_FORFETTARIO_IVA = FORFETTARIO_LEGAL_NOTICE

export const CAUSALE_FORFETTARIO_RITENUTA =
  'Compenso non soggetto a ritenuta d’acconto ai sensi dell’art. 1, comma 67, della Legge n. 190/2014.'

/** Causale completa per le fatture dei forfettari (una riga per <Causale>). */
export function forfettarioCausale(): string {
  return `${CAUSALE_FORFETTARIO_IVA}\n${CAUSALE_FORFETTARIO_RITENUTA}`
}

const fmtIt = (n: number) =>
  n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/**
 * ⚖️ BENI SIGNIFICATIVI nella fattura ELETTRONICA (collaudo T25, 26 set 2026).
 * L'obbligo dell'art. 1 c.19 L. 205/2017 (e della circ. 71/E §5.1-5.2) vale
 * «in fattura» — e la fattura, per il Fisco, è l'XML trasmesso, non il PDF.
 * Fino a oggi la dicitura col valore del bene stava SOLO sul PDF: la ACC
 * 004/2026 del collaudo è partita senza. Ora la stessa frase del PDF (una
 * sola funzione, `testoDicituraBeni`) entra anche in <Causale>.
 *  · fattura e nota di credito → calcolata dalle voci GREZZE (con la marcatura),
 *    come fa il PDF;
 *  · fattura di acconto (TD02) → le sue righe sono sintetiche e non hanno la
 *    marcatura: la dicitura «in quota» (71/E §5.2) è già scritta nelle note
 *    del documento alla creazione, e si riprende da lì.
 */
export function causaleBeniSignificativi(
  docType: string | null | undefined,
  rawItems: VoceSplittabile[],
  fiscalRegime: string | null | undefined,
  vatRateDefault: number | null | undefined,
  notes: string | null | undefined,
): string | null {
  if (docType === 'fattura' || docType === 'nota_credito') {
    const split = dettaglioBeniSignificativi(rawItems, fiscalRegime, vatRateDefault)
    return split ? testoDicituraBeni(split, fmtIt) : null
  }
  if (docType === 'fattura_acconto' && typeof notes === 'string' && notes.trim().startsWith('Beni significativi')) {
    return notes.trim()
  }
  return null
}

/** Unisce le righe di causale (una per <Causale>), saltando le vuote. */
export function unisciCausale(...righe: Array<string | null | undefined>): string | null {
  const r = righe.filter((x): x is string => !!x && x.trim() !== '')
  return r.length ? r.join('\n') : null
}
