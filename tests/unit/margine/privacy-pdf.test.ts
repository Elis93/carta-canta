// ============================================================
// 🔒 REGOLA B.2 (Eli, 2 ago 2026): costo d'acquisto, ricarico e
// margine NON devono MAI comparire su superfici viste dal cliente.
// Questo test congela la regola sulla superficie più esposta: il
// PDF/documento pubblico (buildPdfHtml è la fonte unica di verità
// di PDF, /p/[token] e anteprime — B.8).
// Il valore del costo è scelto APPOSTA diverso da qualsiasi altro
// numero del documento: se compare nell'HTML, è una fuga.
// ============================================================

import { describe, it, expect } from 'vitest'
import { buildPdfHtml } from '@/lib/pdf/template'
import type { PdfDocumentData } from '@/lib/pdf/template'

const COSTO_SENTINELLA = 123.47 // "123,47" non appare in nessun altro campo

function makeData(): PdfDocumentData {
  return {
    document: {
      id: 'doc-1', workspace_id: 'ws-1', client_id: 'client-1',
      template_snapshot: null, doc_type: 'preventivo', status: 'draft',
      doc_number: '2026/001', title: 'Impianto', notes: null, internal_notes: null,
      document_language: 'it-IT', validity_days: 30, payment_terms: null,
      currency: 'EUR', exchange_rate: '1.000000' as unknown as number,
      subtotal: 850, discount_pct: null, discount_fixed: null,
      tax_amount: 0, bollo_amount: 2, total: 852, vat_rate_default: null,
      bonus_edilizio: null, ritenuta_pct: null, public_token: 'abc',
      accepted_at: null, accepted_ip: null, accepted_ua: null,
      rejection_reason: null, signature_image: null, signer_name: null, snooze_until: null, archived_at: null, reminders_off_at: null, doc_date: null, sdi_auto_at: null,
      doc_seq: null, doc_year: null, sent_at: null,
      expires_at: '2026-05-15T00:00:00Z', pdf_url: null, pdf_downloaded_at: null,
      last_reminder_at: null, updated_after_send_at: null, sent_snapshot: null,
      document_log: [], deleted_at: null, origin_document_id: null,
      ai_generated: false, ai_confidence: null, created_by: 'user-1',
      search_vector: null, created_at: '2026-04-15T10:00:00Z', updated_at: '2026-04-15T10:00:00Z',
      document_items: [
        {
          id: 'item-1', document_id: 'doc-1', sort_order: 0,
          description: 'Installazione impianto', unit: 'pz',
          quantity: 1, unit_price: 850, discount_pct: null, vat_rate: null,
          bonus_tipo: null, total: 850, ai_generated: false, ai_confidence: null,
          // La colonna 062 arriva insieme alle altre quando le pagine fanno
          // select * / document_items(*): il template NON deve renderizzarla.
          unit_cost: COSTO_SENTINELLA,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- unit_cost (062) non in types
        } as any,
      ],
    },
    workspace: {
      ragione_sociale: 'Elettrica Rossi s.r.l.', name: 'Elettrica Rossi',
      piva: '12345678901', indirizzo: 'Via Roma 1', cap: '20100',
      citta: 'Milano', provincia: 'MI', logo_url: null, fiscal_regime: 'forfettario',
    },
    client: {
      name: 'Mario Bianchi', email: 'mario@bianchi.it', phone: null, piva: null,
      indirizzo: null, cap: null, citta: null, provincia: null, paese: 'IT',
    },
    template: null,
  }
}

describe('🔒 il costo/margine non arriva MAI al cliente (B.2)', () => {
  const presets = ['classico', 'bold', 'tecnico', 'elegante'] as const

  for (const preset of presets) {
    it(`preset ${preset}: il costo d'acquisto non compare nell'HTML del documento`, () => {
      const data = makeData()
      data.template = {
        preset_key: preset, color_primary: '#1a1a2e', font_family: 'Inter',
        show_logo: false, show_watermark: true, legal_notice: null, logo_position: 'left',
      }
      const html = buildPdfHtml(data)
      expect(html.length).toBeGreaterThan(500)
      expect(html).not.toContain('123,47')
      expect(html).not.toContain('123.47')
      expect(html.toLowerCase()).not.toContain('unit_cost')
      expect(html.toLowerCase()).not.toContain('ricarico')
      expect(html.toLowerCase()).not.toContain('margine')
    })
  }
})
