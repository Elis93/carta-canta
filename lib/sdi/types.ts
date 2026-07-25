// ============================================================
// Layer di astrazione "provider SDI" — tipi condivisi.
// Anti lock-in (DECISIONE_SDI.md, decisione 4): il resto dell'app parla
// SOLO con questa interfaccia; OpenAPI (o un futuro provider) sta dietro.
// ============================================================

/**
 * Sentinella scritta in `documents.sdi_error` IMMEDIATAMENTE PRIMA di chiamare
 * il provider (dopo il claim). Serve a distinguere due crash altrimenti
 * identici (entrambi lasciano status='inviata' con sent_at/provider_id null):
 *   · crash PRIMA della chiamata → marker ASSENTE → nulla è partito → il
 *     reclaim ("Sblocca e riprova") è sicuro;
 *   · crash DOPO la chiamata (lambda killata sulla risposta) → marker
 *     PRESENTE → la fattura POTREBBE essere stata trasmessa → il reclaim
 *     rifiuta (una seconda trasmissione fiscale è il danno peggiore).
 * Testo leggibile in italiano: se mai trapelasse in UI, resta sensato.
 */
export const SDI_SEND_ATTEMPT_MARKER = 'Trasmissione avviata: in attesa di conferma.'

export interface SdiCedente {
  denominazione: string
  piva: string            // solo cifre, senza prefisso IT
  codiceFiscale: string | null
  indirizzo: string
  cap: string
  citta: string
  provincia: string
  regimeFiscale: 'RF19' | 'RF01' | 'RF02'  // forfettario | ordinario | minimi
  email: string | null
}

export interface SdiCessionario {
  denominazione: string
  piva: string | null
  codiceFiscale: string | null
  indirizzo: string | null
  cap: string | null
  citta: string | null
  provincia: string | null
  /** 7 caratteri; '0000000' per privati senza canale */
  codiceDestinatario: string
  pec: string | null
}

export interface SdiRiga {
  descrizione: string
  quantita: number
  prezzoUnitario: number
  totale: number
  aliquotaIva: number      // 0 per forfettari (Natura N2.2)
}

export interface SdiInvoice {
  numero: string           // es. "004/2026"
  data: string             // YYYY-MM-DD
  cedente: SdiCedente
  cessionario: SdiCessionario
  righe: SdiRiga[]
  imponibile: number
  imposta: number
  totale: number
  bollo: number            // 0 oppure 2.00 (virtuale, DM 17/06/2014)
  /** Dicitura di legge (forfettario) da riportare nell'XML */
  causale: string | null
}

export type SdiSendResult =
  | { ok: true; providerId: string; mock: boolean }
  | { ok: false; error: string }

export interface SdiProvider {
  readonly name: string
  /** true = provider di prova (nessuna trasmissione reale allo SdI) */
  readonly isMock: boolean
  /**
   * Configurazione anagrafica del cedente sul provider (una volta per
   * workspace — business_registry_configuration su OpenAPI, con
   * apply_legal_storage attivo). Idempotente.
   */
  ensureConfiguration(cedente: SdiCedente, webhookUrl: string): Promise<{ ok: boolean; error?: string }>
  /** Invio fattura (+ conservazione a norma in un'unica richiesta). */
  sendInvoice(invoice: SdiInvoice, xml: string): Promise<SdiSendResult>
  /**
   * Interroga il provider sull'esito di una fattura già inviata (pull).
   * `esito: null` = ancora in attesa. Complementare al webhook: funziona
   * anche se i callback non sono configurati o non arrivano.
   */
  fetchEsito(providerId: string): Promise<
    { ok: true; esito: SdiEsito | null; message: string | null } | { ok: false; error: string }
  >
}

/** Esito normalizzato ricevuto dal webhook del provider */
export type SdiEsito = 'consegnata' | 'mancata_consegna' | 'scartata'
