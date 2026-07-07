// ============================================================
// CARTA CANTA — Estrazione dati da FOTO SCONTRINO/RICEVUTA
// Legge una foto di scontrino e restituisce importo, data, categoria,
// fornitore, descrizione — per pre-compilare la "Nuova spesa" del Bilancio.
//
// Stessa infrastruttura dell'import listino (Mistral vision primario,
// OpenAI GPT-4o-mini fallback). Output SEMPRE validato con Zod prima
// dell'uso (regola CLAUDE.md §B.1).
// ============================================================

import OpenAI from 'openai'
import { Mistral } from '@mistralai/mistralai'
import { z } from 'zod/v4'
import { EXPENSE_CATEGORIES } from '@/lib/constants/expense-categories'

// ── Schema Zod dell'output ──────────────────────────────────────────────────

export const ReceiptSchema = z.object({
  /** Totale pagato in EUR */
  amount: z.number({ error: 'Importo non valido' }).nonnegative().default(0),
  /** Data in formato ISO YYYY-MM-DD, o null se non leggibile */
  date: z.string().nullable().optional(),
  /** Una delle categorie preset, o "Altro" */
  category: z.string().nullable().optional(),
  /** Nome dell'esercente/fornitore */
  vendor: z.string().nullable().optional(),
  /** Descrizione breve suggerita per la spesa */
  description: z.string().nullable().optional(),
  /** 0–1: confidenza complessiva dell'AI */
  confidence: z.number().min(0).max(1).default(0.5),
})

export type ReceiptResult = z.infer<typeof ReceiptSchema> & {
  provider: 'openai' | 'mistral'
}

// ── Prompt condiviso ────────────────────────────────────────────────────────

const CATEGORIES = EXPENSE_CATEGORIES.join(', ')

const SYSTEM_PROMPT = `Sei un assistente che estrae i dati da una foto di uno SCONTRINO o RICEVUTA italiana, per registrare una spesa aziendale.

Restituisci SOLO un oggetto JSON con questa struttura esatta:

{
  "amount": numero,            // TOTALE pagato in EUR (il totale finale, non i singoli articoli)
  "date": "YYYY-MM-DD" o null, // data dello scontrino
  "category": "una tra: ${CATEGORIES}",
  "vendor": "nome del negozio/esercente" o null,
  "description": "descrizione breve della spesa (es. 'Materiale edile' o 'Rifornimento carburante')",
  "confidence": numero tra 0 e 1
}

REGOLE:
- "amount" è il TOTALE (cerca "TOTALE", "TOT", "TOTALE COMPLESSIVO", "IMPORTO PAGATO"), in EUR, con punto decimale (es. 47.50)
- "category" DEVE essere una tra: ${CATEGORIES}. Scegli la più adatta (benzina/gasolio → Carburante; materiali/negozio edile → Materiali; utensili/macchinari → Attrezzatura; F24/bolli/contributi → Tasse e contributi; altrimenti → Altro)
- "date" nel formato YYYY-MM-DD; se non leggibile usa null
- "confidence": 1 = certissimo, 0.5 = dubbioso, 0.2 = incerto. Abbassala se la foto è sfocata o parziale
- Restituisci SOLO il JSON, senza testo aggiuntivo`

const USER_TEXT = 'Estrai importo totale, data, categoria e fornitore da questo scontrino.'

// ── Client lazy (evita errori al build se le chiavi non ci sono) ────────────

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

// ── Estrazione con Mistral vision (primario) ────────────────────────────────

export async function scanReceiptWithMistral(imageBase64: string, mimeType: string): Promise<ReceiptResult> {
  const mistral = getMistral()
  const response = await mistral.chat.complete({
    model: 'pixtral-12b-2409',
    responseFormat: { type: 'json_object' },
    temperature: 0,
    maxTokens: 800,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'image_url', imageUrl: { url: `data:${mimeType};base64,${imageBase64}` } },
          { type: 'text', text: USER_TEXT },
        ],
      },
    ],
  })
  const content = response.choices?.[0]?.message?.content
  const raw = typeof content === 'string' ? content : null
  if (!raw) throw new Error('Mistral ha restituito una risposta vuota')
  return validate(raw, 'mistral')
}

// ── Estrazione con OpenAI vision (fallback) ─────────────────────────────────

export async function scanReceiptWithOpenAI(imageBase64: string, mimeType: string): Promise<ReceiptResult> {
  const openai = getOpenAI()
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    max_tokens: 800,
    temperature: 0,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}`, detail: 'high' } },
          { type: 'text', text: USER_TEXT },
        ],
      },
    ],
  })
  const raw = response.choices?.[0]?.message?.content ?? null
  if (!raw) throw new Error('OpenAI ha restituito una risposta vuota')
  return validate(raw, 'openai')
}

// ── Validazione condivisa ───────────────────────────────────────────────────

function validate(raw: string, provider: 'openai' | 'mistral'): ReceiptResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error(`${provider} ha restituito JSON non valido`)
  }
  const result = ReceiptSchema.safeParse(parsed)
  if (!result.success) {
    const firstIssue = result.error.issues[0]?.message ?? 'Schema non valido'
    throw new Error(`Output ${provider} non conforme: ${firstIssue}`)
  }
  // Normalizza la categoria a un preset noto (match case-insensitive)
  const cat = result.data.category
  const preset = cat ? (EXPENSE_CATEGORIES as readonly string[]).find((c) => c.toLowerCase() === cat.toLowerCase()) : undefined
  const normalized = preset ?? (cat ? cat.slice(0, 40) : null)
  return { ...result.data, category: normalized, provider }
}
