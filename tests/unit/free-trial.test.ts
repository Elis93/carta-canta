import { describe, it, expect } from 'vitest'
import { checkFreeBlock, FREE_DOC_LIMIT, FREE_INVOICE_LIMIT, type WorkspaceForFreeCheck } from '@/lib/free-trial'

// Limite piano Free: 8 preventivi + 8 fatture inviati, con contatori SEPARATI
// (083, decisione Eli 12 ago). checkFreeBlock(workspace, docType) sceglie il
// contatore giusto. FREE_TRIAL_ENFORCED è false in beta → solo il tetto conta.

function ws(over: Partial<WorkspaceForFreeCheck> = {}): WorkspaceForFreeCheck {
  return {
    id: 'w1',
    plan: 'free',
    free_trial_expires_at: null,
    sent_quota_used: 0,
    sent_invoice_quota_used: 0,
    ...over,
  }
}

describe('checkFreeBlock — preventivi', () => {
  it('non blocca sotto la soglia', () => {
    expect(checkFreeBlock(ws({ sent_quota_used: 7 })).blocked).toBe(false)
  })
  it('blocca a soglia raggiunta (8)', () => {
    const r = checkFreeBlock(ws({ sent_quota_used: FREE_DOC_LIMIT }))
    expect(r.blocked).toBe(true)
    expect(r.reason).toBe('doc_limit')
  })
  it('default = preventivo: usa sent_quota_used, non le fatture', () => {
    // 8 fatture ma 0 preventivi → un preventivo NON è bloccato
    expect(checkFreeBlock(ws({ sent_quota_used: 0, sent_invoice_quota_used: 8 })).blocked).toBe(false)
  })
})

describe('checkFreeBlock — fatture', () => {
  it('non blocca sotto la soglia', () => {
    expect(checkFreeBlock(ws({ sent_invoice_quota_used: 7 }), 'fattura').blocked).toBe(false)
  })
  it('blocca a soglia raggiunta (8)', () => {
    const r = checkFreeBlock(ws({ sent_invoice_quota_used: FREE_INVOICE_LIMIT }), 'fattura')
    expect(r.blocked).toBe(true)
    expect(r.reason).toBe('doc_limit')
    expect(r.docsUsed).toBe(FREE_INVOICE_LIMIT)
  })
  it('contatori INDIPENDENTI: 8 preventivi non bloccano una fattura', () => {
    expect(checkFreeBlock(ws({ sent_quota_used: 8, sent_invoice_quota_used: 3 }), 'fattura').blocked).toBe(false)
  })
  it('campo fatture assente → conta come 0 (non blocca)', () => {
    const w: WorkspaceForFreeCheck = { id: 'w', plan: 'free', free_trial_expires_at: null, sent_quota_used: 0 }
    expect(checkFreeBlock(w, 'fattura').blocked).toBe(false)
  })
})

describe('checkFreeBlock — piani a pagamento', () => {
  it('Pro non è mai bloccato, nemmeno con contatori pieni', () => {
    expect(checkFreeBlock(ws({ plan: 'pro', sent_quota_used: 99, sent_invoice_quota_used: 99 }), 'fattura').blocked).toBe(false)
    expect(checkFreeBlock(ws({ plan: 'pro', sent_quota_used: 99 })).blocked).toBe(false)
  })
})
