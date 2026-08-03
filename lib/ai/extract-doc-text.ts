// ============================================================
// CARTA CANTA — AI Extractor dal TESTO di un DOCUMENTO (PDF di
// listini/preventivi/prezzari → voci strutturate).
// Nato il 3 ago: il vecchio percorso PDF→immagine passava da
// Chromium, che su Vercel Lambda NON funziona (manca libnss3 —
// regola nota B.8) → l'import PDF falliva SEMPRE in produzione.
// Ora il testo del PDF viene estratto server-side (unpdf, puro JS)
// e strutturato da un modello TESTUALE: stesso contratto JSON e
// stessa validazione Zod del percorso vision (ExtractResultSchema).
// Mistral primario (UE) → fallback OpenAI, come da decisione Eli.
// ============================================================

import OpenAI from 'openai'
import { Mistral } from '@mistralai/mistralai'
import { ExtractResultSchema } from './types'
import type { ExtractResult } from './types'

let _openai: OpenAI | null = null
function getOpenAI(): OpenAI {
  if (!_openai) {
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY non configurata')
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return _openai
}

let _mistral: Mistral | null = null
function getMistral(): Mistral {
  if (!_mistral) {
    if (!process.env.MISTRAL_API_KEY) throw new Error('MISTRAL_API_KEY non configurata')
    _mistral = new Mistral({ apiKey: process.env.MISTRAL_API_KEY })
  }
  return _mistral
}

const MISTRAL_TEXT_MODEL = 'mistral-small-latest'
const OPENAI_TEXT_MODEL = 'gpt-4o-mini'

/** Tetto sul testo passato al modello: i prezzari regionali superano le
    40 pagine — oltre questo taglio si importa la prima parte (l'utente può
    rifare l'import con un PDF più mirato). */
export const DOC_TEXT_MAX_CHARS = 15_000

const SYSTEM_PROMPT = `Sei un assistente specializzato nell'estrazione di dati strutturati dal TESTO di preventivi, fatture, listini prezzi e prezzari italiani (testo estratto da un PDF: l'impaginazione può essere spezzata).

Restituisci un oggetto JSON con questa struttura esatta:

{
  "items": [
    {
      "description": "descrizione della voce",
      "unit": "unità di misura (pz/ore/mq/ml/kg/gg/mc/lt/cad/a corpo)",
      "quantity": numero,
      "unit_price": numero,
      "discount_pct": numero o null,
      "vat_rate": numero o null,
      "confidence": numero tra 0 e 1
    }
  ],
  "suggested_title": "titolo suggerito",
  "suggested_notes": "eventuali note o condizioni"
}

REGOLE IMPORTANTI:
- "confidence": 1.0 = certissimo, 0.5 = dubbioso, 0.2 = incerto
- Per "unit_price" usa sempre il prezzo UNITARIO della voce (non il totale della riga)
- In un LISTINO/PREZZARIO ogni voce ha in genere quantity 1: la quantità conta solo se il testo la indica per una riga di documento
- Se una voce ha un codice articolo (es. "E.19.10.10.a"), mettilo ALL'INIZIO della description
- Nei prezzari con "analisi" (scomposizione in materiali/manodopera/noli) estrai SOLO le voci finite col loro prezzo, non le righe dell'analisi
- "vat_rate": 22, 10, 5, 4, 0 — o null se non specificata
- "discount_pct" da 0 a 100 — null se non c'è sconto
- Non inventare voci: se una riga è ambigua, estraila con confidence bassa o saltala
- Valori monetari in EUR senza simbolo (150.00), decimali col punto (2.5)
- Restituisci SOLO il JSON`

function parseAndValidate(raw: string | null, provider: 'openai' | 'mistral'): ExtractResult {
  if (!raw) throw new Error(`${provider} ha restituito una risposta vuota`)
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error(`${provider} ha restituito JSON non valido`)
  }
  const validated = ExtractResultSchema.safeParse(parsed)
  if (!validated.success) {
    const firstIssue = validated.error.issues[0]?.message ?? 'Schema non valido'
    throw new Error(`Output ${provider} non conforme: ${firstIssue}`)
  }
  return { ...validated.data, provider }
}

async function withMistral(text: string): Promise<ExtractResult> {
  const response = await getMistral().chat.complete({
    model: MISTRAL_TEXT_MODEL,
    responseFormat: { type: 'json_object' },
    temperature: 0,
    maxTokens: 4000,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Testo del documento:\n\n${text}` },
    ],
  })
  const content = response.choices?.[0]?.message?.content
  return parseAndValidate(typeof content === 'string' ? content : null, 'mistral')
}

async function withOpenAI(text: string): Promise<ExtractResult> {
  const response = await getOpenAI().chat.completions.create({
    model: OPENAI_TEXT_MODEL,
    response_format: { type: 'json_object' },
    temperature: 0,
    max_tokens: 4000,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Testo del documento:\n\n${text}` },
    ],
  })
  return parseAndValidate(response.choices?.[0]?.message?.content ?? null, 'openai')
}

/** Mistral primario → OpenAI fallback. Lancia solo se falliscono ENTRAMBI. */
export async function extractItemsFromDocumentText(text: string): Promise<ExtractResult & { _fallback?: boolean }> {
  const capped = text.length > DOC_TEXT_MAX_CHARS ? text.slice(0, DOC_TEXT_MAX_CHARS) : text
  try {
    return await withMistral(capped)
  } catch (err) {
    console.warn('[AI Extract PDF] Mistral fallito, provo OpenAI:', err instanceof Error ? err.message : err)
  }
  const result = await withOpenAI(capped)
  return { ...result, _fallback: true }
}
