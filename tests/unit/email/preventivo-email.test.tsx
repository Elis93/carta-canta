// ── PreventivoEmail: le parole giuste per OGNI tipo di documento ─────────────
// Nato dal ricontrollo del 22 set 2026: la copia di cortesia automatica (e la
// route send-email) passavano 'fattura' — o peggio 'preventivo' — anche per le
// note di credito/debito. Il tipo si allarga e queste prove fissano le parole:
// mai «Fattura» su una nota, mai l'invito ad «accettarla» fuori dal preventivo.

import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PreventivoEmail } from '@/components/email/PreventivoEmail'

function render(docType: 'preventivo' | 'fattura' | 'nota_credito' | 'nota_debito') {
  return renderToStaticMarkup(
    React.createElement(PreventivoEmail, {
      senderName: 'Impresa Rossi',
      recipientName: 'Mario Bianchi',
      docNumber: '003/2026',
      totalFormatted: '€ 100,00',
      message: 'Le facciamo avere il documento.',
      publicUrl: 'https://cartacanta.app/p/tok',
      docType,
      ownerEmail: 'impresa@esempio.it',
    }),
  )
}

describe('PreventivoEmail — etichette per tipo documento', () => {
  it('nota di credito: le SUE parole, mai «Fattura» né l’invito ad accettare', () => {
    const html = render('nota_credito')
    expect(html).toContain('Nota di credito n. 003/2026')
    expect(html).toContain('Visualizza la nota di credito')
    expect(html).toContain('Può consultare la nota di credito')
    expect(html).not.toContain('Fattura n.')
    expect(html).not.toContain('accettarlo o rifiutarlo')
  })

  it('nota di debito: idem, con il suo nome', () => {
    const html = render('nota_debito')
    expect(html).toContain('Nota di debito n. 003/2026')
    expect(html).toContain('Visualizza la nota di debito')
    expect(html).not.toContain('accettarlo o rifiutarlo')
  })

  it('fattura: invariata (nessuna regressione dal tipo allargato)', () => {
    const html = render('fattura')
    expect(html).toContain('Fattura n. 003/2026')
    expect(html).toContain('Visualizza la fattura')
    expect(html).not.toContain('accettarlo o rifiutarlo')
  })

  it('preventivo: resta l’unico con «accettarlo o rifiutarlo»', () => {
    const html = render('preventivo')
    expect(html).toContain('Preventivo n. 003/2026')
    expect(html).toContain('Visualizza il preventivo')
    expect(html).toContain('accettarlo o rifiutarlo')
  })
})
