// ============================================================
// Come si LEGGE lo stato di un documento, per tipo e per genere.
//
// ⚠️ PERCHÉ VIVONO QUI E NON DENTRO LA HOME: erano due funzioni scritte nella
// pagina della dashboard, e tutte e due decidevano il tipo con
// `docType === 'fattura'` — cioè per esclusione. Finché i tipi erano due
// funzionava; con la NOTA DI CREDITO, il ramo «tutto il resto» le dava le
// parole del preventivo: una nota annullata si leggeva «Rifiutato», una nota
// inviata «Preventivo inviato».
//
// È lo stesso difetto di `docTypeLabel`/`docTypePath` (9 ago), e la cura è la
// stessa: una regola sola, in un posto solo, con dei test sotto.
// ============================================================

import { docTypeLabel } from '@/lib/utils'

/**
 * «La fattura», «la nota di credito», «il preventivo».
 * Serve per la concordanza: «inviata» o «inviato», «annullata» o «rifiutato».
 */
export function isFemminile(docType: string | null | undefined): boolean {
  return docType === 'fattura' || docType === 'nota_credito' || docType === 'nota_debito'
}

/**
 * Riga di attività della Home, per esteso: «Fattura pagata», «Nota di credito
 * annullata», «Preventivo inviato».
 */
export function eventoLabel(status: string, docType: string | null | undefined): string {
  const nome = docTypeLabel(docType)
  const f = isFemminile(docType)
  switch (status) {
    case 'draft':    return `Bozza ${nome.toLowerCase()}`
    case 'sent':     return `${nome} inviat${f ? 'a' : 'o'}`
    case 'viewed':   return `${nome} visualizzat${f ? 'a' : 'o'}`
    // ⚠️ Solo la FATTURA si incassa. Su una nota di credito il denaro TORNA al
    // cliente — e infatti «Segna pagata» lì non esiste (9 ago): chiamarla
    // «pagata» la farebbe leggere col segno sbagliato.
    case 'accepted': return docType === 'fattura' ? 'Fattura pagata' : `${nome} accettat${f ? 'a' : 'o'}`
    case 'rejected': return f ? `${nome} annullata` : `${nome} rifiutato`
    case 'expired':  return `${nome} scadut${f ? 'a' : 'o'}`
    default:         return nome
  }
}

/**
 * Pillola corta della Home su mobile: lo spazio è quello che è, il tipo lo dice
 * già il numero accanto.
 */
export function badgeLabel(status: string, docType: string | null | undefined): string {
  const f = isFemminile(docType)
  switch (status) {
    case 'draft':    return 'Bozza'
    case 'sent':     return 'Inviato'
    case 'viewed':   return 'Visto'
    case 'accepted': return docType === 'fattura' ? 'Pagata' : (f ? 'Accettata' : 'Accettato')
    case 'rejected': return f ? 'Annullata' : 'Rifiutato'
    case 'expired':  return 'Scaduto'
    default:         return status
  }
}
