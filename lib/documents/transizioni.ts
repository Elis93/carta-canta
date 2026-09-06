// ============================================================
// Messaggi umani quando un cambio di stato viene rifiutato.
//
// PERCHÉ (collaudo di Eli, 6 ago 2026): premendo "Segna pagata" su una
// fattura che risultava già pagata usciva, in faccia all'utente,
//
//     Transizione da "accepted" a "accepted" non consentita
//
// cioè il nome interno degli stati e la parola "transizione". Chi legge non
// ha modo di capire né cosa è successo né cosa fare — e il caso più comune
// (doppio tocco, oppure la pagina rimasta indietro rispetto al database) ha
// una soluzione banale: ricaricare.
//
// ⚠️ REGOLA: nessun messaggio mostrato all'utente contiene i nomi tecnici
// degli stati (draft/sent/viewed/accepted/rejected/expired). Se aggiungi una
// transizione, aggiungi qui la sua spiegazione.
// ============================================================

type DocKind = 'fattura' | 'preventivo'

/** Come si chiama uno stato quando lo legge una persona. */
function nomeStato(status: string, kind: DocKind): string {
  const fattura: Record<string, string> = {
    draft: 'bozza',
    sent: 'inviata',
    viewed: 'vista dal cliente',
    accepted: 'pagata',
    rejected: 'annullata',
    expired: 'scaduta',
  }
  const preventivo: Record<string, string> = {
    draft: 'bozza',
    sent: 'inviato',
    viewed: 'visto dal cliente',
    accepted: 'accettato',
    rejected: 'rifiutato',
    expired: 'scaduto',
  }
  const mappa = kind === 'fattura' ? fattura : preventivo
  return mappa[status] ?? status
}

export function spiegaTransizioneRifiutata(
  da: string,
  a: string,
  kind: DocKind,
): string {
  const doc = kind === 'fattura' ? 'fattura' : 'preventivo'
  const ricarica = 'Ricarica la pagina per vedere lo stato aggiornato.'

  // Caso di gran lunga più frequente: si chiede lo stato in cui il documento
  // GIÀ si trova. Quasi sempre è un doppio tocco, o una scheda lasciata
  // aperta mentre il documento cambiava altrove. Non è un errore dell'utente.
  if (da === a) {
    if (kind === 'fattura' && a === 'accepted') {
      return `Questa fattura risulta già pagata: l’incasso è stato registrato. ${ricarica}`
    }
    if (kind === 'fattura' && a === 'rejected') {
      return `Questa fattura risulta già annullata. ${ricarica}`
    }
    return `Questo ${doc} è già «${nomeStato(a, kind)}». ${ricarica}`
  }

  // Da un documento chiuso non si esce con un cambio di stato diretto.
  if (kind === 'fattura' && da === 'accepted') {
    return 'Questa fattura è già pagata. Per correggere, usa «Segna come non pagata»: azzera l’incasso e la riporta in bozza.'
  }
  if (kind === 'preventivo' && da === 'accepted') {
    return 'Questo preventivo è già accettato. Per annullare usa «Segna come non accettato»: torna in attesa (disponibile solo se l’avevi segnato accettato tu, non se l’ha firmato il cliente).'
  }
  if (kind === 'fattura' && da === 'rejected') {
    return 'Questa fattura è annullata. Per rimetterla in circolo usa «Riattiva»: torna in bozza, modificabile e reinviabile.'
  }

  return `Questo ${doc} è «${nomeStato(da, kind)}»: da qui non si può passare a «${nomeStato(a, kind)}». ${ricarica}`
}
