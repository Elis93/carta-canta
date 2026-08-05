// ============================================================
// Conversazione col cliente attaccata al documento.
//
// I messaggi NON hanno una tabella propria: vivono nel `document_log`
// (append-only, migration 034) come voci `client_message` (scritte dalla
// pagina pubblica /p/[token]) e `owner_message` (risposte dell'artigiano).
// Qui le estraiamo e le ordiniamo per data.
//
// ⚠️ Perché una funzione a parte: il log contiene anche gli INCASSI
// (`payment`, `payment_reset`). Il log grezzo non va MAI passato alla pagina
// del cliente — si passa solo il risultato di questa funzione.
//
// Funzione PURA: nessun accesso al DB, testata.
// ============================================================

export interface ConversationMessage {
  /** chi ha scritto: il cliente dalla pagina pubblica o l'artigiano dall'app */
  from: 'client' | 'owner'
  /** ISO datetime */
  at: string
  text: string
}

interface LogEntryLike {
  type?: string
  at?: string
  text?: string
}

/** Tetto di sicurezza: una conversazione lunghissima non deve gonfiare il
 *  payload della pagina pubblica. Si tengono i messaggi PIÙ RECENTI. */
const MAX_MESSAGES = 100

export function conversationFromLog(log: unknown): ConversationMessage[] {
  if (!Array.isArray(log)) return []
  const out: ConversationMessage[] = []
  for (const raw of log) {
    const e = raw as LogEntryLike | null
    if (!e || typeof e !== 'object') continue
    const from = e.type === 'client_message' ? 'client' : e.type === 'owner_message' ? 'owner' : null
    if (!from) continue
    if (typeof e.at !== 'string' || typeof e.text !== 'string') continue
    const text = e.text.trim()
    if (!text) continue
    // Data non interpretabile: la voce esiste ma non è collocabile nel tempo →
    // meglio scartarla che mostrarla con "Invalid Date".
    if (Number.isNaN(new Date(e.at).getTime())) continue
    out.push({ from, at: e.at, text })
  }
  out.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
  return out.length > MAX_MESSAGES ? out.slice(out.length - MAX_MESSAGES) : out
}

/** Quanti messaggi del CLIENTE non hanno ancora una risposta dell'artigiano
 *  dopo di loro (serve alla card in app: "1 messaggio in attesa di risposta"). */
export function unansweredClientMessages(messages: ConversationMessage[]): number {
  let count = 0
  for (const m of messages) {
    if (m.from === 'client') count++
    else count = 0 // una risposta chiude tutto ciò che c'era prima
  }
  return count
}
