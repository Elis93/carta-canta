// ── Messaggi onesti quando una chiamata al server non riesce ──────────────
// Le Server Action, senza connessione, LANCIANO: non ritornano `{ error }`.
// Senza una rete di sicurezza il risultato è che il bottone resta bloccato
// su "Salvataggio…" oppure salta fuori la pagina di errore, e quello che
// l'artigiano ha scritto sembra perso — lo scenario più comune in cantiere,
// dove il campo va e viene.
//
// Il messaggio dice tre cose, in quest'ordine:
//  1. che cosa NON è riuscito,
//  2. che non si è perso niente,
//  3. che cosa fare adesso.
//
// ⚠️ NON diamo la colpa alla connessione quando non possiamo saperlo: lo
// stesso lancio arriva anche da un errore VERO del server. Col browser
// offline il messaggio è certo; online resta un'ipotesi ("può essere la
// linea") e si offre una via d'uscita (l'assistenza).

/**
 * @param operazione verbo all'INFINITO + complemento: "salvare il
 *   preventivo", "eliminare la voce", "inviare il sollecito".
 *   La forma impersonale ("non è stato possibile <operazione>") evita
 *   qualsiasi problema di concordanza di genere e numero: con
 *   "la spesa non è stato salvato" uscivano frasi sgrammaticate.
 */
export function networkErrorMessage(operazione: string): string {
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false
  return offline
    ? `Sei senza connessione: non è stato possibile ${operazione}. Non chiudere la pagina — riprova appena torna la linea.`
    : `Non è stato possibile ${operazione}. Può essere la linea che va e viene: non si è perso niente, riprova tra qualche secondo senza chiudere la pagina. Se continua a non funzionare, scrivici da Aiuto.`
}
