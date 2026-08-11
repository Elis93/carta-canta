// ============================================================
// BENI SIGNIFICATIVI nel PDF (081)
//
// Due cose devono arrivare al cliente, e sono ENTRAMBE obbligatorie:
//  ① le due righe separate (quota al 10% ed eccedenza al 22%);
//  ② la dicitura col valore del bene e il corrispettivo al netto —
//    art. 1, comma 19, L. 205/2017, dovuta **anche quando tutto resta
//    al 10%**, cioè proprio quando le righe restano una sola.
//
// Il PDF è la fonte unica (B.8): quello che si verifica qui vale anche
// per /p/[token] e per le anteprime in app.
// ============================================================

import { describe, it, expect } from 'vitest'
import { buildPdfHtml } from '@/lib/pdf/template'
import type { PdfDocumentData } from '@/lib/pdf/template'

function item(id: string, description: string, unit_price: number, bene = false) {
  return {
    id, document_id: 'doc-1', sort_order: Number(id.slice(-1)),
    description, unit: 'pz', quantity: 1, unit_price,
    discount_pct: null, vat_rate: 10, bonus_tipo: null,
    bene_significativo: bene,
    total: unit_price, ai_generated: false, ai_confidence: null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- shape minima del template
  } as any
}

function makeData(items: unknown[], totale: number, imposta: number): PdfDocumentData {
  return {
    document: {
      id: 'doc-1', workspace_id: 'ws-1', client_id: 'client-1',
      template_snapshot: null, doc_type: 'fattura', status: 'sent',
      doc_number: '001/2026', title: 'Sostituzione caldaia', notes: null, internal_notes: null,
      document_language: 'it-IT', validity_days: 30, payment_terms: null,
      currency: 'EUR', exchange_rate: '1.000000' as unknown as number,
      subtotal: totale, discount_pct: null, discount_fixed: null,
      tax_amount: imposta, bollo_amount: 0, total: totale + imposta, vat_rate_default: 10,
      bonus_edilizio: null, ritenuta_pct: null, public_token: 'abc',
      accepted_at: null, accepted_ip: null, accepted_ua: null,
      rejection_reason: null, signature_image: null, signer_name: null, snooze_until: null,
      archived_at: null, reminders_off_at: null, doc_date: null, sdi_auto_at: null,
      ritenuta_causale: null, reverse_charge: false,
      doc_seq: null, doc_year: null, sent_at: null,
      expires_at: null, pdf_url: null, pdf_downloaded_at: null,
      last_reminder_at: null, updated_after_send_at: null, sent_snapshot: null,
      document_log: [], deleted_at: null, origin_document_id: null,
      ai_generated: false, ai_confidence: null, created_by: 'user-1',
      search_vector: null, created_at: '2026-08-11T10:00:00Z', updated_at: '2026-08-11T10:00:00Z',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- shape minima del template
      document_items: items as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- shape minima del template
    } as any,
    workspace: {
      ragione_sociale: 'Termoidraulica Rossi', name: 'Rossi', piva: '12345678901',
      indirizzo: 'Via Roma 1', cap: '20100', citta: 'Milano', provincia: 'MI',
      logo_url: null, fiscal_regime: 'ordinario',
    },
    client: {
      name: 'Mario Bianchi', email: 'mario@bianchi.it', phone: null, piva: null,
      indirizzo: null, cap: null, citta: null, provincia: null, paese: 'IT',
    },
    template: null,
  }
}

describe('PDF — beni significativi', () => {
  it('caldaia 2.000 + posa 800: due righe distinte, 1.600 al 10% e 1.200 al 22%', () => {
    const html = buildPdfHtml(makeData(
      [item('item-0', 'Caldaia a condensazione', 2000, true), item('item-1', 'Posa in opera', 800)],
      2800, 424,
    ))
    expect(html).toContain('quota agevolata')
    expect(html).toContain('quota eccedente il valore della prestazione')
    // Le righe IVA del riepilogo vengono dal motore: 1.600×10% e 1.200×22%
    expect(html).toContain('IVA 10%')
    expect(html).toContain('IVA 22%')
    expect(html).toContain('160,00')
    expect(html).toContain('264,00')
  })

  it('la dicitura di legge c’è, col valore del bene e il netto', () => {
    const html = buildPdfHtml(makeData(
      [item('item-0', 'Caldaia a condensazione', 2000, true), item('item-1', 'Posa in opera', 800)],
      2800, 424,
    ))
    expect(html).toContain('art. 1, comma 19, L. 205/2017')
    // ⚠️ Il separatore delle migliaia NON si asserisce: dipende dall'ICU del
    // runtime (in CI Node gira in small-icu e `toLocaleString('it-IT')` non
    // lo mette). Conta che ci siano le CIFRE giuste, che è il dato fiscale;
    // la formattazione è la stessa `fmt` di tutto il resto del documento.
    expect(html).toMatch(/valore dei beni significativi 2\.?000,00/)
    expect(html).toContain('al netto dei beni significativi 800,00')
  })

  it('⚠️ la dicitura c’è ANCHE quando tutto resta al 10% (nessuna riga in più)', () => {
    const html = buildPdfHtml(makeData(
      [item('item-0', 'Caldaia', 1000, true), item('item-1', 'Posa e materiali', 1200)],
      2200, 220,
    ))
    // Nessuno split: la riga resta una sola…
    expect(html).not.toContain('quota eccedente')
    // …ma l'obbligo di indicare il valore del bene resta.
    expect(html).toContain('art. 1, comma 19, L. 205/2017')
    expect(html).toContain('soggetto a IVA 10%')
  })

  it('nessuna voce marcata: nessuna dicitura e nessuna riga in più', () => {
    const html = buildPdfHtml(makeData(
      [item('item-0', 'Manutenzione impianto', 900, false)], 900, 90,
    ))
    expect(html).not.toContain('beni significativi')
    expect(html).not.toContain('quota agevolata')
  })

  it('FORFETTARIO: la marcatura non produce nulla (non addebita IVA)', () => {
    const data = makeData(
      [item('item-0', 'Caldaia', 2000, true), item('item-1', 'Posa', 800)], 2800, 0,
    )
    data.workspace.fiscal_regime = 'forfettario'
    const html = buildPdfHtml(data)
    expect(html).not.toContain('quota agevolata')
    expect(html).not.toContain('art. 1, comma 19')
  })
})
