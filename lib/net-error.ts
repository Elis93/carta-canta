// ── Messaggi onesti quando la rete manca ──────────────────────────────────
// Le Server Action, senza connessione, LANCIANO: non ritornano `{ error }`.
// Senza un try/catch attorno alla chiamata il risultato è che il bottone
// resta bloccato su "Salvataggio…" (oppure salta fuori la pagina di errore)
// e quello che l'artigiano ha scritto sembra perso — lo scenario più comune
// in cantiere, dove il campo va e viene.
//
// Questi messaggi dicono tre cose, in quest'ordine:
//  1. che cosa NON è successo (il salvataggio),
//  2. che i dati sono ancora lì,
//  3. che cosa fare adesso (non chiudere, riprovare).

/**
 * @param soggetto come si chiama la cosa non salvata, minuscolo e con
 *                 l'articolo: "il sopralluogo", "la spesa", "il rapportino".
 */
export function saveNetworkError(soggetto: string): string {
  // NB: la frase è costruita per NON dover concordare genere e numero col
  // soggetto ("non è stato possibile salvare la spesa / il preventivo"):
  // con "non è stato salvato" uscivano frasi sgrammaticate al femminile.
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false
  return offline
    ? `Sei senza connessione: non è stato possibile salvare ${soggetto}. Non chiudere la pagina — riprova appena torna la linea.`
    : `Salvataggio non riuscito: la connessione sembra assente o instabile. Non è stato possibile salvare ${soggetto}, ma quello che hai scritto è ancora qui: riprova tra qualche secondo senza chiudere la pagina.`
}
