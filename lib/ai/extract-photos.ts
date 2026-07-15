// ============================================================
// CARTA CANTA — AI Extractor da FOTO del cantiere (photo-to-quote).
// L'AI guarda le foto + le note dell'artigiano e propone SOLO l'elenco
// dei LAVORI (descrizioni). NON emette prezzi (il campo non esiste nello
// schema: il prezzo lo attacca il nostro codice dal catalogo, mai l'AI).
// Le QUANTITÀ solo se ESPLICITE nelle note; altrimenti null + flag.
// Mistral pixtral (UE) primario → OpenAI gpt-4o-mini fallback.
// ============================================================

import OpenAI from 'openai'
import { Mistral } from '@mistralai/mistralai'
import { z } from 'zod/v4'

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

// ── Schema: NESSUN CAMPO PREZZO (l'AI non lo può emettere) ───────────────────
export const ScopeItemSchema = z.object({
  description: z.string().min(1),
  unit: z.string().default('pz'),
  // quantità SOLO se esplicita nelle note dell'artigiano, altrimenti null
  quantity: z.number().positive().nullable().default(null),
  // true = la quantità era scritta nelle note; false = non c'era (→ "da compilare")
  quantity_from_notes: z.boolean().default(false),
  confidence: z.number().min(0).max(1).default(0.5),
})
export const ScopeResultSchema = z.object({
  items: z.array(ScopeItemSchema).default([]),
  suggested_title: z.string().optional(),
})
export type ScopeItem = z.infer<typeof ScopeItemSchema>
export type ScopeResult = z.infer<typeof ScopeResultSchema> & { provider: 'openai' | 'mistral' }

const SYSTEM_PROMPT = `Sei un assistente per artigiani italiani (idraulici, elettricisti, imbianchini, piastrellisti). Ricevi una o più FOTO di un cantiere/ambiente e, se presenti, gli APPUNTI dettati dall'artigiano. Il tuo compito è proporre l'ELENCO DEI LAVORI da preventivare (una checklist), NON il preventivo con i prezzi.

Restituisci SOLO un oggetto JSON:
{
  "items": [
    { "description": "descrizione del lavoro/voce", "unit": "unità (pz/ore/mq/ml/kg/gg/mc/lt/a corpo/cad)", "quantity": numero oppure null, "quantity_from_notes": true/false, "confidence": 0..1 }
  ],
  "suggested_title": "titolo breve del lavoro"
}

REGOLE FERREE (rispettale sempre):
- NON indicare MAI prezzi: non esiste alcun campo prezzo. Il prezzo lo mette l'artigiano.
- NON stimare MAI misure o quantità dalle foto. La "quantity" può essere valorizzata SOLO se un numero è ESPLICITAMENTE scritto negli appunti dell'artigiano (es. "bagno 12 mq" → quantity 12, unit "mq", quantity_from_notes true). In tutti gli altri casi: quantity null e quantity_from_notes false.
- Proponi solo lavori PLAUSIBILI e visibili: meglio poche voci corrette che tante inventate. Se un lavoro è dubbio, mettilo con confidence bassa.
- DETTAGLI DI POSA/INSTALLAZIONE (es. "a pavimento" vs "sospeso", "a muro", "a incasso" vs "esterno"): indicali SOLO se sono inequivocabili nella foto (es. un water sospeso si riconosce perché NON tocca il pavimento e la cassetta è a incasso). Se non riesci a distinguere la variante con certezza, usa la descrizione SENZA quel dettaglio e abbassa la confidence: un dettaglio sbagliato è peggio di un dettaglio mancante.
- Usa i nomi del catalogo dell'artigiano (che ti passo come contesto) quando descrivono lo stesso lavoro, così le voci combaciano col suo listino. Se il catalogo ha più varianti che differiscono solo per il dettaglio di posa, scegli la variante solo se la foto la conferma; altrimenti nessuna variante specifica.
- unit: scegli l'unità sensata per il tipo di lavoro (mq per superfici, ore per manodopera, cad/pz per pezzi), ma NON dedurne la quantità.
- Restituisci SOLO il JSON, niente altro.`

function buildUserText(notes: string, catalogNames: string[]): string {
  const parts: string[] = []
  if (notes.trim()) parts.push(`Appunti dell'artigiano:\n${notes.trim()}`)
  else parts.push("L'artigiano non ha lasciato appunti: proponi le voci solo dalle foto, con quantità null.")
  if (catalogNames.length > 0) {
    parts.push(`\nVoci del suo catalogo (usa questi nomi quando combaciano):\n- ${catalogNames.slice(0, 60).join('\n- ')}`)
  }
  return parts.join('\n')
}

function parseValidate(raw: string | null, provider: 'openai' | 'mistral'): ScopeResult {
  if (!raw) throw new Error(`${provider} ha restituito una risposta vuota`)
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { throw new Error(`${provider} ha restituito JSON non valido`) }
  const v = ScopeResultSchema.safeParse(parsed)
  if (!v.success) throw new Error(`Output ${provider} non conforme: ${v.error.issues[0]?.message ?? 'schema'}`)
  return { ...v.data, provider }
}

type Img = { base64: string; mime: string }

export async function extractScopeFromPhotosMistral(images: Img[], notes: string, catalogNames: string[]): Promise<ScopeResult> {
  const content: Array<Record<string, unknown>> = images.map((im) => ({
    type: 'image_url', imageUrl: { url: `data:${im.mime};base64,${im.base64}` },
  }))
  content.push({ type: 'text', text: buildUserText(notes, catalogNames) })
  const response = await getMistral().chat.complete({
    model: 'pixtral-12b-2409',
    responseFormat: { type: 'json_object' },
    temperature: 0,
    maxTokens: 1500,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- content multimodale
    messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: content as any }],
  })
  const c = response.choices?.[0]?.message?.content
  return parseValidate(typeof c === 'string' ? c : null, 'mistral')
}

export async function extractScopeFromPhotosOpenAI(images: Img[], notes: string, catalogNames: string[]): Promise<ScopeResult> {
  const content: Array<Record<string, unknown>> = images.map((im) => ({
    type: 'image_url', image_url: { url: `data:${im.mime};base64,${im.base64}`, detail: 'high' },
  }))
  content.push({ type: 'text', text: buildUserText(notes, catalogNames) })
  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    temperature: 0,
    max_tokens: 1500,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- content multimodale
    messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: content as any }],
  })
  return parseValidate(response.choices?.[0]?.message?.content ?? null, 'openai')
}
