// ============================================================
// dati-fattura — i dati del CLIENTE che una fattura deve riportare per legge.
//
// Art. 21 c.2 DPR 633/1972 (verificato sulle fonti, 25 ago 2026):
//   lett. e) ditta, denominazione o ragione sociale (o nome e cognome) e
//            RESIDENZA O DOMICILIO del cessionario/committente;
//   lett. f) numero di PARTITA IVA del cessionario/committente — oppure, se
//            è un privato che non agisce nell'esercizio d'impresa, arte o
//            professione, il CODICE FISCALE.
//
// Vale per fattura, nota di credito e nota di debito (sono tutte «fatture»
// ai fini dell'art. 21). NON vale per i preventivi: non sono documenti
// fiscali, e bloccare lì sarebbe un ostacolo inventato.
//
// ⚠️ Qui si chiede il MINIMO di legge (nome · indirizzo+città · P.IVA o CF):
// CAP e provincia completano l'indirizzo ma la norma chiede «residenza o
// domicilio» — pretenderli qui bloccherebbe invii legittimi. La trasmissione
// SdI ha le sue guardie più strette (doc-xml: indirizzo completo con CAP),
// che restano dove sono.
// ============================================================

export interface ClienteFattura {
  name?: string | null
  surname?: string | null
  indirizzo?: string | null
  citta?: string | null
  piva?: string | null
  codice_fiscale?: string | null
}

/** true se il tipo documento è una fattura ai fini dell'art. 21. */
export function richiedeDatiFattura(docType: string | null | undefined): boolean {
  return docType === 'fattura' || docType === 'nota_credito' || docType === 'nota_debito'
}

/**
 * Elenco dei dati del cliente che MANCANO per emettere una fattura valida.
 * Vuoto = tutto a posto. `null`/`undefined` = nessun cliente.
 */
export function datiFatturaMancanti(c: ClienteFattura | null | undefined): string[] {
  if (!c) return ['il cliente']
  const out: string[] = []
  if (!String(c.name ?? '').trim()) out.push('nome o ragione sociale')
  if (!String(c.indirizzo ?? '').trim()) out.push('indirizzo')
  if (!String(c.citta ?? '').trim()) out.push('città')
  // Basta UNO dei due identificativi: P.IVA (impresa/professionista) o
  // codice fiscale (privato). Quale dei due spetti al cliente lo sa solo
  // l'artigiano — qui si verifica che almeno uno ci sia.
  const piva = String(c.piva ?? '').replace(/\D/g, '')
  const cf = String(c.codice_fiscale ?? '').trim()
  if (!piva && !cf) out.push('partita IVA o codice fiscale')
  return out
}

/** Messaggio di blocco pronto (schema §B.2: cosa · perché · cosa fare). */
export function messaggioDatiFattura(mancanti: string[], docType?: string): string {
  const docLabel = docType === 'nota_credito' ? 'Nota di credito non inviabile'
    : docType === 'nota_debito' ? 'Nota di debito non inviabile'
    : 'Fattura non inviabile'
  const elenco = mancanti.length === 1 ? mancanti[0] : mancanti.slice(0, -1).join(', ') + ' e ' + mancanti[mancanti.length - 1]
  return `${docLabel}: nella scheda del cliente ${mancanti.length === 1 ? 'manca' : 'mancano'} ${elenco} — dati obbligatori in fattura (art. 21 DPR 633/1972). Completa la scheda del cliente in rubrica e riprova.`
}
