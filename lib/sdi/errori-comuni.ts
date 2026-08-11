// ── I 10 scarti SdI più comuni, spiegati in parole semplici (11 ago 2026) ───
//
// La ricerca sui competitor dice che gli SCARTI sono la lamentela n.2 degli
// artigiani (dopo i fallimenti silenziosi): lo SdI risponde con codici e
// messaggi tecnici («00311 CodiceDestinatario non valido») e l'artigiano non
// sa né cos'è successo né cosa fare. Questo modulo traduce.
//
// ⚠️ COME SI RICONOSCE L'ERRORE: se nel messaggio c'è il CODICE (es. 00311),
// decide lui — arriva dalla risposta vera dello SdI ed è l'unico modo di
// distinguere «IdFiscaleIVA non valido» del cliente (00305) da quello
// dell'artigiano (00301), che hanno lo stesso testo. La tabella dei codici è
// presa dall'elenco controlli UFFICIALE dell'Agenzia delle Entrate, non dai
// blog (che sui numeri si contraddicono). Senza codice si va di PAROLE del
// messaggio. Se non riconosciamo l'errore si ritorna null e la card mostra il
// consiglio generico di sempre — mai una spiegazione inventata.
//
// Modulo PURO: stringa dentro, spiegazione fuori. Testato.

export interface ErroreSdiSpiegato {
  /** Chiave stabile (per test e analisi) */
  chiave: string
  /** Cos'è successo, in parole semplici */
  titolo: string
  /** Perché succede */
  spiegazione: string
  /** Cosa fare nell'app, passo per passo */
  rimedio: string
}

interface RegolaErrore extends ErroreSdiSpiegato {
  /** Almeno UNA di queste frasi deve comparire nel testo (normalizzato) */
  parole: string[]
  /** Codici associati (secondari: confermano, non decidono da soli) */
  codici: string[]
}

/**
 * Minuscole, senza accenti, e la punteggiatura diventa spazio: così
 * «<IdFiscaleIVA> del <CessionarioCommittente>» diventa
 * «idfiscaleiva del cessionariocommittente» e le frasi-chiave combaciano
 * qualunque sia la grafia del provider.
 */
function normalizza(testo: string): string {
  return testo
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

// ⚠️ L'ORDINE CONTA: la prima regola che combacia vince, quindi le più
// specifiche stanno in alto (es. «codicedestinatario» prima del generico
// «non valido»). Ogni `parole` è una frase già normalizzata (minuscole,
// senza accenti, senza spazi dove il tracciato scrive attaccato).
const REGOLE: RegolaErrore[] = [
  {
    chiave: 'codice_destinatario',
    parole: ['codicedestinatario', 'codice destinatario'],
    codici: ['00311', '00312'],
    titolo: 'Il codice destinatario del cliente non è valido',
    spiegazione:
      'Il codice di 7 caratteri che dice allo SdI dove recapitare la fattura è sbagliato o non esiste.',
    rimedio:
      'Apri la scheda del cliente in Rubrica e controlla il codice destinatario (7 caratteri, lettere e numeri). Se il cliente non te ne ha dato uno, lascia il campo vuoto: per i privati la fattura va comunque a buon fine. Poi ritrasmetti.',
  },
  {
    chiave: 'piva_cliente',
    parole: ['idfiscaleiva del cessionario', 'idfiscaleiva non valido', 'partita iva del cessionario', 'partita iva del cliente'],
    codici: ['00305'],
    titolo: 'La partita IVA del cliente non risulta valida',
    spiegazione:
      'Lo SdI controlla la P.IVA del cliente in Anagrafe Tributaria: quella scritta non esiste o è cessata.',
    rimedio:
      'Apri la scheda del cliente in Rubrica e ricontrolla la partita IVA cifra per cifra (chiedigliela di nuovo se serve: un numero solo sbagliato basta per lo scarto). Poi ritrasmetti.',
  },
  {
    chiave: 'cf_cliente',
    parole: ['codicefiscale del cessionario', 'codice fiscale del cessionario', 'codicefiscale non valido'],
    codici: ['00306'],
    titolo: 'Il codice fiscale del cliente non risulta valido',
    spiegazione:
      'Lo SdI controlla il codice fiscale del cliente in Anagrafe Tributaria: quello scritto non esiste.',
    rimedio:
      'Apri la scheda del cliente in Rubrica e ricontrolla il codice fiscale lettera per lettera. Poi ritrasmetti.',
  },
  {
    chiave: 'dati_artigiano',
    parole: ['del cedente', 'cedente prestatore', 'idtrasmittente', 'trasmittente non valido'],
    codici: ['00301', '00302', '00303'],
    titolo: 'I TUOI dati fiscali non risultano validi',
    spiegazione:
      'Il problema non è il cliente: è la partita IVA o il codice fiscale della tua attività che lo SdI non riconosce.',
    rimedio:
      'Vai in Impostazioni › Fiscale e ricontrolla la tua partita IVA e il codice fiscale. Se sono giusti e lo scarto si ripete, parlane col commercialista: può esserci un disallineamento in Anagrafe Tributaria.',
  },
  {
    chiave: 'duplicata',
    parole: ['duplicat'],
    codici: ['00404', '00409'],
    titolo: 'Fattura già trasmessa (duplicato)',
    spiegazione:
      'Allo SdI risulta già una fattura con questo numero, questo anno e questa partita IVA: la seconda trasmissione viene respinta.',
    rimedio:
      'Controlla se questa fattura è già stata trasmessa (magari da un altro programma, o da un doppio tocco). Se è già passata non serve fare nulla; se invece è un documento nuovo con un numero già usato, correggi il numero e ritrasmetti.',
  },
  {
    chiave: 'manca_identificativo_cliente',
    parole: ['idfiscaleiva e codicefiscale non valorizzati', 'ne idfiscaleiva ne codicefiscale'],
    codici: ['00417'],
    titolo: 'Il cliente non ha né partita IVA né codice fiscale',
    spiegazione:
      'Una fattura elettronica deve dire CHI è il cliente: serve almeno uno fra partita IVA e codice fiscale.',
    rimedio:
      'Apri la scheda del cliente in Rubrica e aggiungi la partita IVA (se è un’azienda) o il codice fiscale (se è un privato). Poi ritrasmetti.',
  },
  {
    chiave: 'iva_non_quadra',
    parole: ['imposta non calcolata', 'valore dell imposta', 'valore del campo imposta', 'imposta non corrisponde', 'imposta non risulta'],
    codici: ['00421', '00422'],
    titolo: 'I conti dell’IVA non tornano',
    spiegazione:
      'Lo SdI rifà il calcolo imponibile × aliquota e trova una differenza. Capita sui documenti salvati con una versione vecchia dell’app.',
    rimedio:
      'Apri il documento, toccalo con Modifica e risalvalo senza cambiare nulla: l’app ricalcola i totali nel modo che lo SdI si aspetta. Poi ritrasmetti.',
  },
  {
    chiave: 'prezzo_non_quadra',
    parole: ['prezzototale', 'prezzo totale', 'prezzounitario'],
    codici: ['00423'],
    titolo: 'Quantità × prezzo non torna su una voce',
    spiegazione:
      'Su una riga del documento il totale non corrisponde a quantità × prezzo unitario (di solito per un arrotondamento).',
    rimedio:
      'Apri il documento, toccalo con Modifica e risalvalo: l’app riallinea i conti delle voci. Poi ritrasmetti.',
  },
  {
    chiave: 'numero_senza_cifre',
    parole: ['almeno un carattere numerico', 'numero non valido'],
    codici: ['00425'],
    titolo: 'Il numero del documento non contiene cifre',
    spiegazione:
      'Il numero della fattura deve contenere almeno un numero (es. «001/2026»): un numero di sole lettere viene respinto.',
    rimedio:
      'Apri il documento con Modifica e correggi il campo Numero (basta che contenga una cifra). Poi ritrasmetti.',
  },
  {
    chiave: 'formato_file',
    parole: ['non conforme al formato', 'nomenclatura', 'non integro', 'firma non valida'],
    codici: ['00200', '00102', '00103', '00106'],
    titolo: 'Il file della fattura non rispetta il formato',
    spiegazione:
      'Il problema è tecnico, nel file trasmesso — spesso un carattere speciale nel testo delle voci o nei dati (&, <, >, virgolette).',
    rimedio:
      'Apri il documento con Modifica, controlla che descrizioni e dati non contengano simboli strani, risalva e ritrasmetti. Se lo scarto si ripete, scrivici dall’assistenza: è un problema nostro, non tuo.',
  },
]

/**
 * Traduce il messaggio d'errore dello SdI in una spiegazione con rimedio.
 * Decide il CODICE quando c'è (viene dalla risposta vera dello SdI); le
 * PAROLE del messaggio fanno da ripiego. Errore non riconosciuto → null:
 * la card mostra il consiglio generico, mai una spiegazione inventata.
 */
export function spiegaErroreSdi(sdiError: string | null | undefined): ErroreSdiSpiegato | null {
  if (!sdiError) return null
  const testo = normalizza(sdiError)

  // 1. Il CODICE, se c'è: arriva dalla risposta vera dello SdI ed è l'unico
  //    modo di distinguere errori col testo identico (00305 cliente vs
  //    00301 artigiano).
  const codici = testo.match(/\b00\d{3}\b/g) ?? []
  for (const codice of codici) {
    const regola = REGOLE.find((r) => r.codici.includes(codice))
    if (regola) {
      const { parole: _p, codici: _c, ...spiegato } = regola
      return spiegato
    }
  }

  // 2. Le parole del messaggio, per i provider che rispondono solo in prosa.
  //    Nel dubbio cliente/artigiano vince il cliente: è il caso di gran lunga
  //    più frequente (la P.IVA dell'artigiano è già stata verificata alla
  //    registrazione).
  for (const regola of REGOLE) {
    if (regola.parole.some((p) => testo.includes(p))) {
      const { parole: _p, codici: _c, ...spiegato } = regola
      return spiegato
    }
  }

  return null
}
