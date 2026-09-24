// ── La VERITÀ scritta sulla copia di una fattura (Fase 0, 20 set 2026) ───────
//
// Prescrizione del commercialista (18 set): la copia di cortesia presuppone una
// fattura GIÀ trasmessa allo SdI; prima della trasmissione ciò che circola è
// una bozza e deve dirlo con un avviso «molto chiaro». Decisione di Eli
// (20 set, «Facciamo uguale»): le parole sono gli STANDARD dei concorrenti,
// non inventate — la dicitura di cortesia di Fatture in Cloud e la famiglia
// della dicitura proforma per il documento non ancora emesso.
// Fonti e roadmap: PROGETTO_COPIA_CORTESIA.md (§5 Fase 0, §6 D2).
//
// PURO: nessun accesso a rete o DB. Una sola fonte per PDF (lib/pdf/template.ts)
// e pagina cliente (/p/[token] → MobilePublicCard): le due superfici non
// possono divergere per costruzione.

export type StatoCopiaSdi = 'non_emessa' | 'in_attesa_esito' | 'copia_cortesia'

/**
 * In che stato è la COPIA di questo documento rispetto allo SdI.
 * Solo fatture e note di credito: sui preventivi (client-first) → null.
 *
 * - sdi_status assente → mai trasmessa → 'non_emessa'
 * - 'scartata' → per legge MAI emessa (si corregge e ritrasmette) → 'non_emessa'
 * - 'consegnata' | 'mancata_consegna' → emessa con esito → 'copia_cortesia'
 * - 'inviata' (o un valore futuro sconosciuto) → trasmessa ma senza esito
 *   certo → 'in_attesa_esito': dire «non costituisce fattura» sarebbe falso
 *   (è partita), dire «l'originale è consultabile» sarebbe una promessa non
 *   ancora vera — la via di mezzo onesta.
 */
export function statoCopiaSdi(
  docType: string | null | undefined,
  sdiStatus: string | null | undefined,
): StatoCopiaSdi | null {
  // Fatture, note di credito/debito e fatture di acconto (TD02): tutte
  // dichiarano il proprio stato SdI sulla copia. (La nota di debito mancava:
  // la sua copia usciva senza dicitura — chiusa col censimento Fase 2, 24 set.)
  if (docType === 'preventivo' || !docType) return null
  const s = (sdiStatus ?? '').trim()
  if (!s || s === 'scartata') return 'non_emessa'
  if (s === 'consegnata' || s === 'mancata_consegna') return 'copia_cortesia'
  return 'in_attesa_esito'
}

/**
 * La dicitura per esteso. Le parole degli standard di mercato:
 * - 'copia_cortesia': la dicitura di Fatture in Cloud (quasi verbatim, è la
 *   più diffusa e citata come standard).
 * - 'non_emessa': la famiglia della dicitura PROFORMA (Danea/FiC/prassi),
 *   con la coda adattata al nostro caso — l'originale dice «all'atto del
 *   pagamento del corrispettivo», che è il caso proforma, non il nostro.
 */
export function dicituraCopiaSdi(stato: StatoCopiaSdi, docType: string | null | undefined): string {
  const nc = docType === 'nota_credito'
  const nome = nc
    ? 'nota di credito'
    : docType === 'nota_debito'
      ? 'nota di debito'
      : docType === 'fattura_acconto'
        ? 'fattura di acconto'
        : 'fattura'
  const nomeCap = nome.charAt(0).toUpperCase() + nome.slice(1)
  switch (stato) {
    case 'non_emessa':
      return `Il presente documento non costituisce ${nome} valida ai fini del DPR 633/1972 e successive modifiche. La ${nome} definitiva viene emessa con la trasmissione al Sistema di Interscambio.`
    case 'in_attesa_esito':
      return `${nomeCap} trasmessa al Sistema di Interscambio, in attesa di esito. Copia priva di valenza fiscale.`
    case 'copia_cortesia':
      return `Copia di cortesia non valida ai fini fiscali. L'originale della ${nome} è stato inviato al Sistema di Interscambio ed è consultabile nell'area riservata del sito dell'Agenzia delle Entrate.`
  }
}

/** Esito POSITIVO dello SdI: la fattura è emessa (consegnata al canale del
 *  cliente, oppure lasciata nel suo cassetto fiscale — valida lo stesso). */
export function esitoPositivoSdi(sdiStatus: string | null | undefined): boolean {
  const s = (sdiStatus ?? '').trim()
  return s === 'consegnata' || s === 'mancata_consegna'
}

/**
 * FASE 2 (flag per cliente, standard FiC/Aruba): la copia di cortesia
 * AUTOMATICA parte solo se il cliente non l'ha rifiutata in anagrafica —
 * «Invia sempre la copia di cortesia» spento = rinuncia espressa del B2C
 * (art. 1 c.3 D.Lgs 127/2015) o preferenza di mandarla a mano.
 *
 * ⚠️ Ferma SOLO un `false` ESPLICITO: pre-089 la colonna non esiste
 * (undefined) e un cliente senza riga (null) non ha scelto nulla — in
 * entrambi i casi vale il comportamento di serie della Fase 1 (si invia).
 * Riguarda la sola copia AUTOMATICA: l'invio manuale resta sempre libero.
 */
export function copiaAutomaticaConsentita(
  client: { copia_cortesia_auto?: boolean | null } | null | undefined,
): boolean {
  return client?.copia_cortesia_auto !== false
}

/**
 * FASE 1 (modello Aruba, Eli 21 set): con la fatturazione elettronica ATTIVA,
 * l'invio al cliente di una fattura (o nota) è consentito solo DOPO l'esito
 * positivo dello SdI — prima esiste solo la bozza, che vive nell'app. È la
 * regola dei concorrenti: la copia parte quando lo SdI ha accettato, «così da
 * essere certi che al cliente arrivi la fattura approvata».
 *
 * ⚠️ Comprende anche la NOTA DI DEBITO (TD05): è una fattura integrativa, la
 * sua copia segue la stessa regola. Il flag NEXT_PUBLIC_SDI_ENABLED lo
 * controlla il CHIAMANTE (questo modulo resta puro); con SdI spento il blocco
 * non esiste e vale il flusso client-first + le diciture della Fase 0.
 */
export function copiaCortesiaBloccata(
  docType: string | null | undefined,
  sdiStatus: string | null | undefined,
): boolean {
  // Anche la FATTURA DI ACCONTO (TD02): la copia parte dopo l'esito, come
  // per ogni altro documento fiscale.
  if (docType === 'preventivo' || !docType) return false
  return !esitoPositivoSdi(sdiStatus)
}
