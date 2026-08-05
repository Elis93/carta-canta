import { describe, it, expect } from 'vitest'
import { conversationFromLog, unansweredClientMessages } from '@/lib/documents/messaggi'

describe('conversationFromLog', () => {
  it('estrae solo i messaggi, ignorando gli altri eventi del log', () => {
    const log = [
      { type: 'modified', at: '2026-08-01T09:00:00.000Z' },
      { type: 'client_message', at: '2026-08-01T10:00:00.000Z', text: 'Buongiorno, quando può venire?' },
      // ⚠️ gli incassi NON devono finire nella conversazione mostrata al cliente
      { type: 'payment', at: '2026-08-01T11:00:00.000Z', amount: 500, kind: 'acconto' },
      { type: 'owner_message', at: '2026-08-01T12:00:00.000Z', text: 'Martedì mattina.' },
    ]
    expect(conversationFromLog(log)).toEqual([
      { from: 'client', at: '2026-08-01T10:00:00.000Z', text: 'Buongiorno, quando può venire?' },
      { from: 'owner', at: '2026-08-01T12:00:00.000Z', text: 'Martedì mattina.' },
    ])
  })

  it('ordina per data anche se il log è fuori sequenza', () => {
    const log = [
      { type: 'owner_message', at: '2026-08-02T08:00:00.000Z', text: 'seconda' },
      { type: 'client_message', at: '2026-08-01T08:00:00.000Z', text: 'prima' },
    ]
    expect(conversationFromLog(log).map((m) => m.text)).toEqual(['prima', 'seconda'])
  })

  it('scarta le voci malformate (testo vuoto, data assente o non valida)', () => {
    const log = [
      { type: 'client_message', at: '2026-08-01T10:00:00.000Z', text: '   ' },
      { type: 'client_message', at: '2026-08-01T10:00:00.000Z' },
      { type: 'client_message', text: 'senza data' },
      { type: 'client_message', at: 'non-una-data', text: 'data rotta' },
      null,
      'stringa',
      { type: 'owner_message', at: '2026-08-01T11:00:00.000Z', text: '  ok  ' },
    ]
    expect(conversationFromLog(log)).toEqual([
      { from: 'owner', at: '2026-08-01T11:00:00.000Z', text: 'ok' },
    ])
  })

  it('log assente o non array → nessun messaggio (documenti pre-034)', () => {
    expect(conversationFromLog(null)).toEqual([])
    expect(conversationFromLog(undefined)).toEqual([])
    expect(conversationFromLog({})).toEqual([])
  })

  it('tiene i 100 messaggi più recenti', () => {
    const log = Array.from({ length: 130 }, (_, i) => ({
      type: 'client_message',
      at: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(),
      text: `m${i}`,
    }))
    const conv = conversationFromLog(log)
    expect(conv).toHaveLength(100)
    expect(conv[0].text).toBe('m30')
    expect(conv[99].text).toBe('m129')
  })
})

describe('unansweredClientMessages', () => {
  const c = (text: string, at: string) => ({ from: 'client' as const, at, text })
  const o = (text: string, at: string) => ({ from: 'owner' as const, at, text })

  it('conta i messaggi del cliente dopo l\'ultima risposta', () => {
    expect(unansweredClientMessages([
      c('uno', '2026-08-01T10:00:00.000Z'),
      o('risposto', '2026-08-01T11:00:00.000Z'),
      c('due', '2026-08-01T12:00:00.000Z'),
      c('tre', '2026-08-01T13:00:00.000Z'),
    ])).toBe(2)
  })

  it('nessuna attesa se l\'ultimo messaggio è dell\'artigiano', () => {
    expect(unansweredClientMessages([
      c('uno', '2026-08-01T10:00:00.000Z'),
      o('risposto', '2026-08-01T11:00:00.000Z'),
    ])).toBe(0)
  })

  it('conversazione vuota → zero', () => {
    expect(unansweredClientMessages([])).toBe(0)
  })
})
