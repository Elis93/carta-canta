// ============================================================
// CARTA CANTA — AI Fallback (Mistral-small)
// Usato quando OpenAI non risponde o restituisce un errore.
// Stesso contratto di extract.ts — output validato con Zod.
// ============================================================

import { Mistral } from '@mistralai/mistralai'
import { ExtractResultSchema } from './types'
import type { ExtractResult } from './types'

let _mistral: Mistral | null = null
function getMistral(): Mistral {
  if (!_mistral) {
    if (!process.env.MISTRAL_API_KEY) {
      throw new Error('MISTRAL_API_KEY non configurata')
    }
    _mistral = new Mistral({ apiKey: process.env.MISTRAL_API_KEY })
  }
  return _mistral
}

// ── Stessa struttura JSON richiesta da OpenAI ───────────────────────────────

const SYSTEM_PROMPT = `Sei un assistente specializzato nell'estrazione di dati da preventivi e fatture italiane.

Analizza il documento e restituisci SOLO un oggetto JSON con questa struttura:

{
  "items": [
    {
      "description": "descrizione voce",
      "unit": "pz/ore/mq/ml/kg/gg/mc/lt",
      "quantity": numero,
      "unit_price": numero,
      "discount_pct": numero o null,
      "vat_rate": numero o null,
      "confidence": numero 0-1
    }
  ],
  "suggested_title": "titolo suggerito",
  "suggested_notes": "note opzionali"
}

Regole: usa "unit_price" unitario (non totale), "vat_rate" in 22/10/5/4/0 o null, numeri con punto decimale, confidence 1=certissimo 0=incerto. Solo JSON.`

// ── Modelli Mistral supportati per vision ────────────────────────────────────
// pixtral-12b-2409 — modello vision di Mistral
// mistral-small-latest — senza vision, solo testo

const MISTRAL_VISION_MODEL = 'pixtral-12b-2409'

// ── Estrazione con Mistral vision ───────────────────────────────────────────

export async function extractWithMistral(
  imageBase64: string,
  mimeType: string
): Promise<ExtractResult> {
  const mistral = getMistral()

  const response = await mistral.chat.complete({
    model: MISTRAL_VISION_MODEL,
    responseFormat: { type: 'json_object' },
    temperature: 0,
    maxTokens: 2000,
    messages: [
      {
        role: 'system',
        content: SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            imageUrl: {
              url: `data:${mimeType};base64,${imageBase64}`,
            },
          },
          {
            type: 'text',
            text: 'Estrai le voci da questo documento.',
          },
        ],
      },
    ],
  })

  const content = response.choices?.[0]?.message?.content
  const raw = typeof content === 'string' ? content : null
  if (!raw) throw new Error('Mistral ha restituito una risposta vuota')

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('Mistral ha restituito JSON non valido')
  }

  const validated = ExtractResultSchema.safeParse(parsed)
  if (!validated.success) {
    const firstIssue = validated.error.issues[0]?.message ?? 'Schema non valido'
    throw new Error(`Output Mistral non conforme: ${firstIssue}`)
  }

  return { ...validated.data, provider: 'mistral' }
}
