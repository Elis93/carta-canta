// ============================================================
// CARTA CANTA — AI Extractor da TESTO (note sopralluogo → voci).
// Trasforma appunti sbrigativi dell'artigiano ("Rifacimento piastrelle
// 2 euro 100mq") in voci strutturate del preventivo. Stesso contratto
// JSON e stessa validazione Zod dell'AI import (ExtractResultSchema).
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

const SYSTEM_PROMPT = `Sei un assistente per artigiani italiani. Ricevi gli APPUNTI presi durante un sopralluogo (testo libero, spesso dettato a voce, sintetico e sgrammaticato) e li trasformi in voci di preventivo strutturate.

Restituisci un oggetto JSON con questa struttura esatta:
{
  "items": [
    {
      "description": "descrizione della voce",
      "unit": "unità di misura (pz/ore/mq/ml/kg/gg/mc/lt/a corpo/cad)",
      "quantity": numero,
      "unit_price": numero,
      "discount_pct": null,
      "vat_rate": null,
      "confidence": numero tra 0 e 1
    }
  ],
  "suggested_title": "titolo breve del lavoro"
}

REGOLE:
- Gli appunti degli artigiani sono compatti: "Rifacimento piastrelle 2 euro 100mq" significa descrizione "Rifacimento piastrelle", prezzo unitario 2 EUR, quantità 100, unità "mq".
- "unit_price" è SEMPRE il prezzo unitario. Se dagli appunti capisci solo il totale, usa quantity 1 e unit "a corpo" col totale come unit_price.
- Se manca il prezzo, metti unit_price 0 e confidence bassa (0.3): l'artigiano lo compilerà.
- Se manca la quantità, usa 1.
- Ignora le parti degli appunti che non sono lavori/materiali (nomi, indirizzi, promemoria personali).
- Non inventare voci: se una riga è ambigua, estraila con confidence bassa piuttosto che indovinare i numeri.
- "vat_rate" e "discount_pct" sempre null (li gestisce l'artigiano).
- Valori con il punto decimale (es. 2.5), senza simbolo euro.
- Restituisci SOLO il JSON.`

async function parseAndValidate(raw: string | null, provider: 'openai' | 'mistral'): Promise<ExtractResult> {
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

export async function extractItemsFromTextMistral(text: string): Promise<ExtractResult> {
  const response = await getMistral().chat.complete({
    model: MISTRAL_TEXT_MODEL,
    responseFormat: { type: 'json_object' },
    temperature: 0,
    maxTokens: 2000,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Appunti del sopralluogo:\n\n${text}` },
    ],
  })
  const content = response.choices?.[0]?.message?.content
  return parseAndValidate(typeof content === 'string' ? content : null, 'mistral')
}

export async function extractItemsFromTextOpenAI(text: string): Promise<ExtractResult> {
  const response = await getOpenAI().chat.completions.create({
    model: OPENAI_TEXT_MODEL,
    response_format: { type: 'json_object' },
    temperature: 0,
    max_tokens: 2000,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Appunti del sopralluogo:\n\n${text}` },
    ],
  })
  return parseAndValidate(response.choices?.[0]?.message?.content ?? null, 'openai')
}
