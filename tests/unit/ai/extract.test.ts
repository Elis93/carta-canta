import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  confidenceLabel,
  confidenceColor,
  ExtractedItemSchema,
  ExtractResultSchema,
  MAX_FILE_SIZE_BYTES,
  MAX_FILE_SIZE_MB,
  CONFIDENCE_HIGH,
  CONFIDENCE_MED,
} from '@/lib/ai/types'

// ── Mock OpenAI ────────────────────────────────────────────────────────────
// Usiamo globalThis per esporre il mock senza referenze esterne alla factory
// (le referenze esterne causano il strip del vi.fn() wrapper da parte di Vitest)

vi.mock('openai', () => {
  const create = vi.fn()
  ;(globalThis as Record<string, unknown>).__openAICreate = create

  function OpenAIMock(this: unknown) {
    return { chat: { completions: { create } } }
  }

  return { default: OpenAIMock }
})

// ── Mock Mistral ───────────────────────────────────────────────────────────

vi.mock('@mistralai/mistralai', () => {
  const complete = vi.fn()
  ;(globalThis as Record<string, unknown>).__mistralComplete = complete

  function MistralMock(this: unknown) {
    return { chat: { complete } }
  }

  return { Mistral: MistralMock }
})

// Import statici — dopo i vi.mock
import { extractWithOpenAI } from '@/lib/ai/extract'
import { extractWithMistral } from '@/lib/ai/fallback'

// ── Accessors per i mock fn ────────────────────────────────────────────────

function getOpenAICreate() {
  return (globalThis as Record<string, unknown>).__openAICreate as ReturnType<typeof vi.fn>
}

function getMistralComplete() {
  return (globalThis as Record<string, unknown>).__mistralComplete as ReturnType<typeof vi.fn>
}

// ── Helpers ────────────────────────────────────────────────────────────────

function makeValidJson(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    items: [
      {
        description: 'Installazione impianto',
        unit: 'pz',
        quantity: 1,
        unit_price: 500,
        discount_pct: null,
        vat_rate: 22,
        confidence: 0.95,
      },
    ],
    suggested_title: 'Preventivo impianto',
    suggested_notes: 'Materiali esclusi',
    ...overrides,
  })
}

function openAIResp(content: string) {
  return { choices: [{ message: { content } }] }
}

function mistralResp(content: string) {
  return { choices: [{ message: { content } }] }
}

// ── Tests: lib/ai/types ────────────────────────────────────────────────────

describe('confidenceLabel', () => {
  it('≥0.8 → high', () => {
    expect(confidenceLabel(1.0)).toBe('high')
    expect(confidenceLabel(0.8)).toBe('high')
  })
  it('0.5–0.79 → medium', () => {
    expect(confidenceLabel(0.79)).toBe('medium')
    expect(confidenceLabel(0.5)).toBe('medium')
  })
  it('<0.5 → low', () => {
    expect(confidenceLabel(0.49)).toBe('low')
    expect(confidenceLabel(0)).toBe('low')
  })
})

describe('confidenceColor', () => {
  it('≥0.8 → green', () => expect(confidenceColor(0.9)).toContain('green'))
  it('0.5–0.79 → amber', () => expect(confidenceColor(0.6)).toContain('amber'))
  it('<0.5 → destructive', () => expect(confidenceColor(0.3)).toContain('destructive'))
})

describe('ExtractedItemSchema', () => {
  it('valida voce completa', () => {
    expect(ExtractedItemSchema.safeParse({
      description: 'Muratura', unit: 'mq', quantity: 10,
      unit_price: 25.50, discount_pct: 5, vat_rate: 10, confidence: 0.9,
    }).success).toBe(true)
  })

  it('description vuota → fallisce', () => {
    expect(ExtractedItemSchema.safeParse({
      description: '', unit: 'pz', quantity: 1, unit_price: 100, confidence: 0.8,
    }).success).toBe(false)
  })

  it('quantity negativa → fallisce', () => {
    expect(ExtractedItemSchema.safeParse({
      description: 'Voce', unit: 'pz', quantity: -1, unit_price: 100, confidence: 0.8,
    }).success).toBe(false)
  })

  it('confidence > 1 → fallisce', () => {
    expect(ExtractedItemSchema.safeParse({
      description: 'Voce', unit: 'pz', quantity: 1, unit_price: 10, confidence: 1.5,
    }).success).toBe(false)
  })

  it('confidence negativa → fallisce', () => {
    expect(ExtractedItemSchema.safeParse({
      description: 'Voce', unit: 'pz', quantity: 1, unit_price: 10, confidence: -0.1,
    }).success).toBe(false)
  })

  it('unit e confidence hanno default', () => {
    const r = ExtractedItemSchema.safeParse({ description: 'Voce', quantity: 1, unit_price: 50 })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.unit).toBe('pz')
      expect(r.data.confidence).toBe(0.5)
    }
  })

  it('discount_pct > 100 → fallisce', () => {
    expect(ExtractedItemSchema.safeParse({
      description: 'Voce', unit: 'pz', quantity: 1, unit_price: 100,
      discount_pct: 110, confidence: 0.8,
    }).success).toBe(false)
  })

  it('accetta vat_rate null', () => {
    expect(ExtractedItemSchema.safeParse({
      description: 'Voce', unit: 'pz', quantity: 1, unit_price: 100,
      vat_rate: null, confidence: 0.9,
    }).success).toBe(true)
  })
})

describe('ExtractResultSchema', () => {
  it('valida risultato completo', () => {
    expect(ExtractResultSchema.safeParse({
      items: [{ description: 'V', unit: 'pz', quantity: 1, unit_price: 100, confidence: 0.9 }],
      suggested_title: 'Preventivo',
    }).success).toBe(true)
  })

  it('items vuoto → fallisce (min 1)', () => {
    expect(ExtractResultSchema.safeParse({ items: [] }).success).toBe(false)
  })

  it('campi opzionali assenti → ok', () => {
    expect(ExtractResultSchema.safeParse({
      items: [{ description: 'V', unit: 'pz', quantity: 1, unit_price: 10, confidence: 0.9 }],
    }).success).toBe(true)
  })
})

describe('Costanti', () => {
  it('MAX_FILE_SIZE_MB = 10', () => expect(MAX_FILE_SIZE_MB).toBe(10))
  it('MAX_FILE_SIZE_BYTES = 10MB', () => expect(MAX_FILE_SIZE_BYTES).toBe(10 * 1024 * 1024))
  it('CONFIDENCE_HIGH = 0.8', () => expect(CONFIDENCE_HIGH).toBe(0.8))
  it('CONFIDENCE_MED = 0.5', () => expect(CONFIDENCE_MED).toBe(0.5))
})

// ── Tests: extractWithOpenAI ───────────────────────────────────────────────

describe('extractWithOpenAI', () => {
  beforeEach(() => {
    getOpenAICreate().mockReset()
    process.env.OPENAI_API_KEY = 'test-key-openai'
  })

  it('estrae voci da risposta valida', async () => {
    getOpenAICreate().mockResolvedValueOnce(openAIResp(makeValidJson()))
    const result = await extractWithOpenAI('base64data', 'image/jpeg')

    expect(result.provider).toBe('openai')
    expect(result.items).toHaveLength(1)
    expect(result.items[0].description).toBe('Installazione impianto')
    expect(result.items[0].unit_price).toBe(500)
    expect(result.items[0].confidence).toBe(0.95)
    expect(result.suggested_title).toBe('Preventivo impianto')
  })

  it('lancia errore se content è null', async () => {
    getOpenAICreate().mockResolvedValueOnce({ choices: [{ message: { content: null } }] })
    await expect(extractWithOpenAI('data', 'image/png')).rejects.toThrow('risposta vuota')
  })

  it('lancia errore se JSON non valido', async () => {
    getOpenAICreate().mockResolvedValueOnce(openAIResp('questa non è JSON'))
    await expect(extractWithOpenAI('data', 'image/png')).rejects.toThrow('JSON non valido')
  })

  it('lancia errore se Zod fallisce — items vuoto', async () => {
    getOpenAICreate().mockResolvedValueOnce(openAIResp(JSON.stringify({ items: [] })))
    await expect(extractWithOpenAI('data', 'image/png')).rejects.toThrow('Output AI non conforme')
  })

  it('lancia errore se description vuota', async () => {
    const bad = JSON.stringify({
      items: [{ description: '', unit: 'pz', quantity: 1, unit_price: 10, confidence: 0.9 }],
    })
    getOpenAICreate().mockResolvedValueOnce(openAIResp(bad))
    await expect(extractWithOpenAI('data', 'image/png')).rejects.toThrow('Output AI non conforme')
  })

  it('usa modello gpt-4o-mini', async () => {
    getOpenAICreate().mockResolvedValueOnce(openAIResp(makeValidJson()))
    await extractWithOpenAI('data', 'image/jpeg')
    expect(getOpenAICreate()).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gpt-4o-mini' })
    )
  })

  it('usa response_format json_object', async () => {
    getOpenAICreate().mockResolvedValueOnce(openAIResp(makeValidJson()))
    await extractWithOpenAI('data', 'image/jpeg')
    expect(getOpenAICreate()).toHaveBeenCalledWith(
      expect.objectContaining({ response_format: { type: 'json_object' } })
    )
  })

  it('usa temperature 0', async () => {
    getOpenAICreate().mockResolvedValueOnce(openAIResp(makeValidJson()))
    await extractWithOpenAI('data', 'image/jpeg')
    expect(getOpenAICreate()).toHaveBeenCalledWith(
      expect.objectContaining({ temperature: 0 })
    )
  })
})

// ── Tests: extractWithMistral ──────────────────────────────────────────────

describe('extractWithMistral', () => {
  beforeEach(() => {
    getMistralComplete().mockReset()
    process.env.MISTRAL_API_KEY = 'test-key-mistral'
  })

  it('estrae voci da risposta valida', async () => {
    getMistralComplete().mockResolvedValueOnce(mistralResp(makeValidJson()))
    const result = await extractWithMistral('base64data', 'image/jpeg')

    expect(result.provider).toBe('mistral')
    expect(result.items).toHaveLength(1)
    expect(result.items[0].description).toBe('Installazione impianto')
  })

  it('lancia errore se content è null', async () => {
    getMistralComplete().mockResolvedValueOnce({ choices: [{ message: { content: null } }] })
    await expect(extractWithMistral('data', 'image/png')).rejects.toThrow('risposta vuota')
  })

  it('lancia errore se JSON non valido', async () => {
    getMistralComplete().mockResolvedValueOnce(mistralResp('non è json'))
    await expect(extractWithMistral('data', 'image/png')).rejects.toThrow('JSON non valido')
  })

  it('usa modello pixtral-12b-2409', async () => {
    getMistralComplete().mockResolvedValueOnce(mistralResp(makeValidJson()))
    await extractWithMistral('data', 'image/jpeg')
    expect(getMistralComplete()).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'pixtral-12b-2409' })
    )
  })

  it('usa responseFormat json_object', async () => {
    getMistralComplete().mockResolvedValueOnce(mistralResp(makeValidJson()))
    await extractWithMistral('data', 'image/jpeg')
    expect(getMistralComplete()).toHaveBeenCalledWith(
      expect.objectContaining({ responseFormat: { type: 'json_object' } })
    )
  })
})
