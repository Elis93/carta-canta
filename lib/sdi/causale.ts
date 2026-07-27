// ============================================================
// Diciture di legge del regime forfettario per l'XML FatturaPA.
// Il campo <Causale> è ripetibile e lungo max 200 caratteri: le due
// diciture viaggiano come DUE <Causale> separate (join con '\n',
// spezzato in xml.ts). Fase 1 della ritenuta d'acconto (27 lug):
// senza la riga del comma 67 un condominio committente trattiene
// il 4% per errore a un forfettario, che invece è ESENTE.
// ============================================================

export const CAUSALE_FORFETTARIO_IVA =
  'Operazione effettuata ai sensi dell’art. 1, commi da 54 a 89, della Legge n. 190/2014 e successive modificazioni — regime forfettario. Operazione senza applicazione dell’IVA.'

export const CAUSALE_FORFETTARIO_RITENUTA =
  'Compenso non soggetto a ritenuta d’acconto ai sensi dell’art. 1, comma 67, della Legge n. 190/2014.'

/** Causale completa per le fatture dei forfettari (una riga per <Causale>). */
export function forfettarioCausale(): string {
  return `${CAUSALE_FORFETTARIO_IVA}\n${CAUSALE_FORFETTARIO_RITENUTA}`
}
