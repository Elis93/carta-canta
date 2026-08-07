// ============================================================
// Cerca una funzione nell'app (Eli, 7 ago 2026).
//
// PERCHÉ: solo dentro «Altro» ci sono diciotto voci, le Impostazioni hanno
// quattro sezioni, Account tre — e alcune cose si sono spostate più di una
// volta. Chi non usa l'app tutti i giorni non ricorda in quale cassetto sta
// una funzione, e la ricerca è l'unico modo per non doverlo indovinare.
//
// ⚠️ DUE SCELTE che tengono in piedi tutto il resto:
//
//  1. **Si cercano FUNZIONI E PAGINE, non documenti** (decisione di Eli). Un
//     campo che trova insieme «Mario Rossi» e «iban» mescola due bisogni
//     diversi; per i documenti ci sono già le ricerche dentro Preventivi e
//     Fatture, che sanno filtrare anche per stato.
//
//  2. **Dizionario scritto a mano, nessuna magia.** I sinonimi sono le parole
//     che usa l'artigiano ("bonifico", "buttato", "impronta"), non i nomi
//     interni. Un cerca che risponde "niente" alla parola giusta perde la
//     fiducia di chi lo usa e non viene più riaperto: meglio una lista curata
//     che si allarga quando qualcuno ci dice "ho cercato X e non l'ho
//     trovato", che un algoritmo che indovina a volte.
//
// Per aggiungere una voce: una riga in VOCI_APP. Nient'altro.
// ============================================================

export interface VoceApp {
  /** Come si chiama nell'app, esattamente */
  label: string
  /** Dove sta, in parole ("Altro › Impostazioni") */
  dove: string
  href: string
  /** Una riga che dice a cosa serve */
  desc?: string
  /**
   * Le parole con cui la si cerca. ⚠️ Vanno scritte come le direbbe
   * l'artigiano, non come le chiamiamo noi.
   */
  parole: string[]
}

export const VOCI_APP: VoceApp[] = [
  // ── Documenti ──────────────────────────────────────────────────────────
  { label: 'Nuovo preventivo', dove: 'Preventivi', href: '/preventivi/nuovo',
    parole: ['preventivo', 'nuovo preventivo', 'fare un preventivo', 'offerta', 'stima'] },
  { label: 'Preventivi', dove: 'Barra in basso', href: '/preventivi',
    desc: 'Tutti i preventivi, con i filtri per stato',
    parole: ['preventivi', 'elenco preventivi', 'accettati', 'rifiutati', 'bozze'] },
  { label: 'Preventivi in scadenza', dove: 'Preventivi › Scadenze', href: '/preventivi/scadenze',
    parole: ['scadenza', 'scadenze', 'in scadenza', 'sollecito', 'sollecitare', 'ricordare al cliente'] },
  { label: 'Nuova fattura', dove: 'Fatture', href: '/fatture/nuovo',
    parole: ['fattura', 'nuova fattura', 'fatturare', 'emettere fattura'] },
  { label: 'Fatture', dove: 'Barra in basso', href: '/fatture',
    desc: 'Tutte le fatture, pagate e da incassare',
    parole: ['fatture', 'elenco fatture', 'pagate', 'da incassare'] },
  { label: 'Fatture in scadenza', dove: 'Fatture › Scadenze', href: '/fatture/scadenze',
    parole: ['incassare', 'da incassare', 'insoluti', 'non mi hanno pagato', 'scadute'] },

  // ── Il lavoro di ogni giorno ───────────────────────────────────────────
  { label: 'Lavori', dove: 'Altro', href: '/lavori',
    desc: 'Il cantiere: da fare, in corso, finito',
    parole: ['lavori', 'cantiere', 'commessa', 'lavoro in corso', 'rapportino', 'ore', 'timer'] },
  { label: 'Agenda appuntamenti', dove: 'Altro', href: '/calendario',
    parole: ['agenda', 'appuntamenti', 'calendario', 'settimana', 'quando devo andare'] },
  { label: 'Sopralluoghi', dove: 'Altro', href: '/sopralluoghi',
    desc: 'Foto e appunti presi dal cliente',
    parole: ['sopralluogo', 'sopralluoghi', 'visita', 'foto dal cliente', 'appunti'] },
  { label: 'Clienti', dove: 'Altro', href: '/clienti',
    desc: 'La rubrica dei tuoi clienti',
    parole: ['clienti', 'rubrica', 'anagrafica', 'contatti', 'indirizzo cliente', 'partita iva cliente'] },

  // ── Strumenti ──────────────────────────────────────────────────────────
  { label: 'Bilancio', dove: 'Altro › Strumenti', href: '/bilancio',
    desc: 'Quanto entra, quanto esce, quanto resta',
    parole: ['bilancio', 'guadagno', 'quanto guadagno', 'spese', 'uscite', 'entrate', 'cassa', 'utile'] },
  { label: 'Catalogo e listini', dove: 'Altro › Strumenti', href: '/catalogo',
    desc: 'Le tue voci pronte e i listini dei fornitori',
    parole: ['catalogo', 'listino', 'listini', 'fornitore', 'fornitori', 'prezzi', 'voci pronte', 'ricarico'] },
  { label: 'Calcoli', dove: 'Altro › Strumenti', href: '/calcoli',
    desc: 'Metri quadri, volume, piastrelle, vernice',
    parole: ['calcoli', 'metri quadri', 'mq', 'piastrelle', 'vernice', 'volume', 'quantità', 'misure'] },
  { label: 'Template documenti', dove: 'Altro › Strumenti', href: '/template',
    desc: 'L’aspetto dei tuoi preventivi e fatture',
    parole: ['template', 'modello', 'aspetto', 'grafica', 'colore', 'carta intestata', 'font'] },
  { label: 'Fatti trovare dai clienti', dove: 'Altro › Strumenti', href: '/farti-trovare',
    desc: 'La tua vetrina pubblica e le richieste che arrivano',
    parole: ['vetrina', 'profilo pubblico', 'farmi trovare', 'nuovi clienti', 'richieste', 'pubblicità'] },
  { label: 'Recensioni', dove: 'Altro › Strumenti', href: '/recensioni',
    parole: ['recensioni', 'recensione', 'stelle', 'feedback', 'giudizi'] },

  // ── Impostazioni ───────────────────────────────────────────────────────
  { label: 'Dati dell’attività', dove: 'Impostazioni › Generale', href: '/impostazioni',
    desc: 'Ragione sociale, indirizzo, telefono, logo',
    parole: ['ragione sociale', 'indirizzo', 'telefono', 'logo', 'dati attività', 'nome ditta'] },
  { label: 'Preavviso delle scadenze', dove: 'Impostazioni › Generale', href: '/impostazioni',
    desc: 'Quanti giorni prima avvisarti in Home',
    parole: ['preavviso', 'giorni prima', 'avvisami', 'validità preventivi', 'quanto dura il preventivo'] },
  { label: 'Impostazioni fiscali', dove: 'Impostazioni › Fiscale', href: '/impostazioni?tab=fiscale',
    desc: 'Regime, P.IVA, ATECO, costo orario',
    parole: ['fiscale', 'partita iva', 'p.iva', 'forfettario', 'regime', 'ateco', 'iva', 'bollo', 'ritenuta', 'costo orario'] },
  { label: 'Come farti pagare', dove: 'Impostazioni › Pagamenti', href: '/impostazioni?tab=pagamenti',
    desc: 'IBAN e istruzioni di pagamento sui documenti',
    parole: ['iban', 'bonifico', 'coordinate', 'come mi pagano', 'pagamento', 'banca', 'conto'] },
  { label: 'Notifiche', dove: 'Impostazioni › Notifiche', href: '/impostazioni?tab=notifiche',
    desc: 'Cosa ti avvisa, per email e in campanella',
    parole: ['notifiche', 'avvisi', 'campanella', 'email automatiche', 'promemoria'] },

  // ── Account, sicurezza, dati ───────────────────────────────────────────
  { label: 'Indirizzo di accesso', dove: 'Altro › Account e sicurezza', href: '/account',
    parole: ['email', 'indirizzo di accesso', 'con che email entro', 'account'] },
  { label: 'Blocco dell’app', dove: 'Account e sicurezza › Sicurezza', href: '/account?sez=sicurezza',
    desc: 'Impronta o volto per aprire l’app',
    parole: ['impronta', 'blocco', 'bloccare app', 'password app', 'volto', 'faccia', 'sicurezza', 'proteggere'] },
  { label: 'Esci da tutti i dispositivi', dove: 'Account e sicurezza › Sicurezza', href: '/account?sez=sicurezza',
    parole: ['esci', 'logout', 'ho perso il telefono', 'chiudere sessioni', 'accessi'] },
  { label: 'Scarica i tuoi dati', dove: 'Account e sicurezza › Dati', href: '/account?sez=dati',
    parole: ['scarica dati', 'esporta', 'backup', 'i miei dati', 'copia'] },
  { label: 'Il tuo commercialista', dove: 'Account e sicurezza › Dati', href: '/account?sez=dati',
    desc: 'Pacchetto da mandargli e accesso in sola lettura',
    parole: ['commercialista', 'studio', 'contabile', 'registro fatture', 'csv'] },
  { label: 'Elimina account', dove: 'Altro › Account e sicurezza', href: '/account',
    parole: ['elimina account', 'cancellare account', 'chiudere account', 'disdire'] },

  // ── Il resto ───────────────────────────────────────────────────────────
  { label: 'Cestino', dove: 'Altro', href: '/cestino',
    desc: 'Documenti eliminati, recuperabili per 15 giorni',
    parole: ['cestino', 'cancellato', 'eliminato', 'buttato', 'recuperare', 'ripristinare', 'per sbaglio'] },
  { label: 'Abbonamento', dove: 'Altro', href: '/abbonamento',
    parole: ['abbonamento', 'piano', 'pro', 'pagare app', 'fattura carta canta', 'disdetta', 'prezzo'] },
  { label: 'Aiuto e contatti', dove: 'Altro', href: '/aiuto',
    desc: 'Domande frequenti e come scriverci',
    parole: ['aiuto', 'assistenza', 'supporto', 'domande', 'faq', 'non funziona', 'problema'] },
  { label: 'Tutorial e guide', dove: 'Altro › Aiuto', href: '/aiuto?sez=tutorial',
    parole: ['tutorial', 'guida', 'giro guidato', 'come si usa', 'spiegazione'] },
  { label: 'Novità', dove: 'Altro', href: '/novita',
    parole: ['novità', 'cosa è cambiato', 'aggiornamenti', 'nuove funzioni'] },
  { label: 'Invita un collega', dove: 'Altro', href: '/referral',
    parole: ['invita', 'referral', 'amico', 'collega', 'codice invito', 'premio'] },
]

/** Minuscolo, senza accenti e senza doppi spazi: "P.IVA" e "piva" pareggiano. */
export function normalizza(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Le voci che rispondono alla ricerca, dalla più pertinente.
 *
 * Ordine: prima chi comincia con quello che hai scritto, poi chi lo contiene.
 * ⚠️ TUTTE le parole digitate devono trovare riscontro ("costo orario" non
 * deve restituire ogni voce che contiene "costo"), altrimenti più si scrive
 * più risultati escono — l'opposto di quello che ci si aspetta.
 */
export function cercaFunzioni(query: string, limite = 8): VoceApp[] {
  const q = normalizza(query)
  if (q.length < 2) return []
  const parole = q.split(' ')

  const punteggio = (v: VoceApp): number => {
    const campi = [v.label, v.dove, v.desc ?? '', ...v.parole].map(normalizza)
    let totale = 0
    for (const p of parole) {
      let migliore = 0
      for (const campo of campi) {
        if (campo === p) migliore = Math.max(migliore, 100)
        else if (campo.startsWith(p)) migliore = Math.max(migliore, 60)
        else if (campo.split(' ').some((w) => w.startsWith(p))) migliore = Math.max(migliore, 40)
        else if (campo.includes(p)) migliore = Math.max(migliore, 15)
      }
      if (migliore === 0) return 0   // una parola senza riscontro esclude la voce
      totale += migliore
    }
    // A parità, vince chi la porta nel nome e non solo nei sinonimi
    if (normalizza(v.label).includes(q)) totale += 25
    return totale
  }

  return VOCI_APP
    .map((v) => ({ v, p: punteggio(v) }))
    .filter((x) => x.p > 0)
    .sort((a, b) => b.p - a.p)
    .slice(0, limite)
    .map((x) => x.v)
}
