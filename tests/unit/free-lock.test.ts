import { describe, it, expect } from 'vitest'
import { docLockedDecision } from '@/lib/plan/free-lock'

// Downgrade Pro→Free: i documenti INVIATI oltre i primi 8 (per tipo) sono in
// sola lettura. Bozze e note di credito/debito mai bloccate; piani a pagamento
// mai bloccati.
const open = new Set(['a', 'b', 'c']) // i "primi 8" (qui 3, per il test)

describe('docLockedDecision', () => {
  it('Pro non è mai bloccato', () => {
    expect(docLockedDecision({ isFree: false, docType: 'preventivo', status: 'sent', docId: 'z', openSentIds: open })).toBe(false)
  })
  it('documento inviato NEL set aperto → non bloccato', () => {
    expect(docLockedDecision({ isFree: true, docType: 'preventivo', status: 'sent', docId: 'a', openSentIds: open })).toBe(false)
  })
  it('documento inviato FUORI dal set → bloccato', () => {
    expect(docLockedDecision({ isFree: true, docType: 'fattura', status: 'accepted', docId: 'z', openSentIds: open })).toBe(true)
  })
  it('BOZZA mai bloccata, anche fuori dal set', () => {
    expect(docLockedDecision({ isFree: true, docType: 'preventivo', status: 'draft', docId: 'z', openSentIds: open })).toBe(false)
  })
  it('nota di credito/debito mai bloccata', () => {
    expect(docLockedDecision({ isFree: true, docType: 'nota_credito', status: 'sent', docId: 'z', openSentIds: open })).toBe(false)
    expect(docLockedDecision({ isFree: true, docType: 'nota_debito', status: 'sent', docId: 'z', openSentIds: open })).toBe(false)
  })
})
