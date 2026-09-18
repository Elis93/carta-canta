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

export const CAUSALE_FORFETTARIO_IVA = FORFETTARIO_LEGAL_NOTICE

export const CAUSALE_FORFETTARIO_RITENUTA =
  'Compenso non soggetto a ritenuta d’acconto ai sensi dell’art. 1, comma 67, della Legge n. 190/2014.'

/** Causale completa per le fatture dei forfettari (una riga per <Causale>). */
export function forfettarioCausale(): string {
  return `${CAUSALE_FORFETTARIO_IVA}\n${CAUSALE_FORFETTARIO_RITENUTA}`
}
