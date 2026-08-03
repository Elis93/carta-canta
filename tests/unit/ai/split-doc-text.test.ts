import { describe, it, expect } from 'vitest'
import { splitDocText, CHUNK_CHARS, MAX_CHUNKS } from '@/lib/ai/extract-doc-text'

describe('splitDocText — analisi PDF a pezzi (3 ago sera)', () => {
  it('testo corto → un solo pezzo, non troncato', () => {
    const { chunks, truncated } = splitDocText('voce 1\nvoce 2')
    expect(chunks).toEqual(['voce 1\nvoce 2'])
    expect(truncated).toBe(false)
  })

  it('taglia sui fine-riga e non perde nulla', () => {
    const line = 'x'.repeat(120)
    const text = Array.from({ length: 200 }, () => line).join('\n') // ~24k chars
    const { chunks, truncated } = splitDocText(text)
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.every((c) => c.length <= CHUNK_CHARS)).toBe(true)
    expect(chunks.join('')).toBe(text) // ricomposto = originale, zero perdite
    expect(truncated).toBe(false)
  })

  it('senza a-capo utili → taglio secco, nessun loop', () => {
    const text = 'y'.repeat(CHUNK_CHARS * 2 + 100)
    const { chunks, truncated } = splitDocText(text)
    expect(chunks.length).toBe(3)
    expect(chunks.join('')).toBe(text)
    expect(truncated).toBe(false)
  })

  it('oltre il tetto → truncated true e MAX_CHUNKS pezzi', () => {
    const line = 'z'.repeat(100)
    const text = Array.from({ length: 2000 }, () => line).join('\n') // ~200k chars
    const { chunks, truncated } = splitDocText(text)
    expect(chunks.length).toBe(MAX_CHUNKS)
    expect(truncated).toBe(true)
  })
})
