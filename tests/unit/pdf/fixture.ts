import type { PdfDocumentData } from '@/lib/pdf/template'

// Fixture condivisa dei test PDF (estratta da generate.test.ts).
export function makeTestData(
  opts: { preset?: 'classico' | 'bold' | 'tecnico' | 'elegante'; work_days?: number | null; accepted_at?: string | null; status?: string; doc_type?: string } & Partial<PdfDocumentData> = {},
): PdfDocumentData {
  const { preset, work_days, accepted_at, status, doc_type, ...overrides } = opts
  const base = baseData()
  if (preset) base.template = { ...base.template!, preset_key: preset }
  if (work_days !== undefined) (base.document as { work_days: number | null }).work_days = work_days
  if (accepted_at !== undefined) base.document.accepted_at = accepted_at
  if (status) base.document.status = status as PdfDocumentData['document']['status']
  if (doc_type) base.document.doc_type = doc_type
  return { ...base, ...overrides }
}

function baseData(): PdfDocumentData {
  return {
    document: {
      id: 'doc-1',
      workspace_id: 'ws-1',
      client_id: 'client-1',
      template_snapshot: null,
      doc_type: 'preventivo',
      status: 'draft',
      doc_number: '2026/001',
      title: 'Impianto elettrico',
      notes: 'Lavori da eseguire entro maggio.',
      internal_notes: null,
      document_language: 'it-IT',
      validity_days: 30,
      work_days: null,
      payment_terms: '30 giorni',
      currency: 'EUR',
      exchange_rate: '1.000000' as unknown as number,
      subtotal: 850,
      discount_pct: null,
      discount_fixed: null,
      tax_amount: 0,
      bollo_amount: 2,
      total: 852,
      vat_rate_default: null,
      bonus_edilizio: null,
      ritenuta_pct: null,
      public_token: 'abc123',
      accepted_at: null,
      accepted_ip: null,
      accepted_ua: null,
      rejection_reason: null,
      signature_image: null,
      snooze_until: null,
      doc_date: null,
      sdi_auto_at: null,
      ritenuta_causale: null,
      reverse_charge: false,
  archived_at: null,
  reminders_off_at: null,
      signer_name: null,
      doc_seq: null,
      doc_year: null,
      sent_at: null,
      expires_at: '2026-05-15T00:00:00Z',
      pdf_url: null,
      pdf_downloaded_at: null,
      last_reminder_at: null,
      updated_after_send_at: null,
      sent_snapshot: null,
      document_log: [],
      deleted_at: null,
      origin_document_id: null,
      ai_generated: false,
      ai_confidence: null,
      created_by: 'user-1',
      search_vector: null,
      created_at: '2026-04-15T10:00:00Z',
      updated_at: '2026-04-15T10:00:00Z',
      document_items: [
        {
          id: 'item-1',
          document_id: 'doc-1',
          sort_order: 0,
          description: 'Installazione impianto elettrico',
          unit: 'pz',
          quantity: 1,
          unit_price: 850,
          discount_pct: null,
          vat_rate: null,
          bonus_tipo: null,
        bene_significativo: null,
          total: 850,
          ai_generated: false,
          ai_confidence: null,
        },
      ],
    },
    workspace: {
      ragione_sociale: 'Elettrica Rossi s.r.l.',
      name: 'Elettrica Rossi',
      piva: '12345678901',
      indirizzo: 'Via Roma 1',
      cap: '20100',
      citta: 'Milano',
      provincia: 'MI',
      logo_url: null,
      fiscal_regime: 'forfettario',
    },
    client: {
      name: 'Mario Bianchi Costruzioni',
      email: 'mario@bianchi.it',
      phone: '+39 02 1234567',
      piva: '98765432100',
      indirizzo: 'Via Garibaldi 42',
      cap: '00100',
      citta: 'Roma',
      provincia: 'RM',
      paese: 'IT',
    },
    template: {
      preset_key: 'classico',
      color_primary: '#1a1a2e',
      font_family: 'Inter',
      show_logo: true,
      show_watermark: true,
      legal_notice: null,
      logo_position: 'left',
    },
  }
}

