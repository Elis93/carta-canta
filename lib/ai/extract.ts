// ============================================================
// CARTA CANTA — AI Extractor (OpenAI GPT-4o-mini)
// Estrae voci da immagini di preventivi/fatture via vision API.
// Output SEMPRE validato con Zod prima di essere restituito.
// ============================================================

import OpenAI from 'openai'
import { ExtractResultSchema } from './types'
import type { ExtractResult } from './types'

// Lazy init — evita errori al build se la chiave non è configurata
let _openai: OpenAI | null = null
function getOpenAI(): OpenAI {
  if (!_openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY non configurata')
    }
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return _openai
}

// ── Prompt di sistema ───────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Sei un assistente specializzato nell'estrazione di dati strutturati da preventivi, fatture e listini prezzi italiani.

Il tuo compito è analizzare l'immagine del documento e restituire un oggetto JSON con questa struttura esatta:

{
  "items": [
    {
      "description": "descrizione della voce",
      "unit": "unità di misura (pz/ore/mq/ml/kg/gg/mc/lt)",
      "quantity": numero,
      "unit_price": numero,
      "discount_pct": numero o null,
      "vat_rate": numero o null,
      "confidence": numero tra 0 e 1
    }
  ],
  "suggested_title": "titolo suggerito per il preventivo",
  "suggested_notes": "eventuali note o condizioni"
}

REGOLE IMPORTANTI:
- "confidence" indica la tua certezza sull'estrazione: 1.0 = certissimo, 0.5 = dubbioso, 0.2 = incerto
- Per "unit_price" usa sempre il prezzo UNITARIO (non il totale della riga)
- Per "vat_rate" usa: 22 (standard), 10 (ristrutturazioni), 5, 4, 0 (esente) — o null se non specificato
- Se il documento è un preventivo forfettario, lascia "vat_rate" a null
- "discount_pct" va da 0 a 100 — null se non c'è sconto
- Non inventare voci che non vedi chiaramente: abbassa "confidence" se non sei sicuro
- Valori monetari in EUR, senza simbolo (es. 150.00 non "€150,00")
- Le quantità decimali usano il punto come separatore (es. 2.5 non "2,5")
- Restituisci SOLO il JSON, senza testo aggiuntivo`

// ── Estrazione con OpenAI vision ────────────────────────────────────────────

export async function extractWithOpenAI(
  imageBase64: string,
  mimeType: string
): Promise<ExtractResult> {
  const openai = getOpenAI()

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    max_tokens: 2000,
    temperature: 0,   // deterministico per parsing strutturato
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
            image_url: {
              url: `data:${mimeType};base64,${imageBase64}`,
              detail: 'high',
            },
          },
          {
            type: 'text',
            text: 'Estrai tutte le voci da questo documento e restituisci il JSON strutturato.',
          },
        ],
      },
    ],
  })

  const raw = response.choices[0]?.message?.content
  if (!raw) throw new Error('OpenAI ha restituito una risposta vuota')

  // Valida output con Zod — regola CLAUDE_v4.md §5
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('OpenAI ha restituito JSON non valido')
  }

  const validated = ExtractResultSchema.safeParse(parsed)
  if (!validated.success) {
    const firstIssue = validated.error.issues[0]?.message ?? 'Schema non valido'
    throw new Error(`Output AI non conforme: ${firstIssue}`)
  }

  return { ...validated.data, provider: 'openai' }
}
