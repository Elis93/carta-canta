import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildPdfHtml } from '@/lib/pdf/template'
import type { PdfDocumentData } from '@/lib/pdf/template'

// ── Dati di test ───────────────────────────────────────────────────────────

function makeTestData(overrides: Partial<PdfDocumentData> = {}): PdfDocumentData {
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
    ...overrides,
  }
}

// ── Test buildPdfHtml ──────────────────────────────────────────────────────

describe('buildPdfHtml', () => {
  it('restituisce una stringa non vuota', () => {
    const html = buildPdfHtml(makeTestData())
    expect(typeof html).toBe('string')
    expect(html.length).toBeGreaterThan(500)
  })

  it('è HTML valido con doctype e html/body', () => {
    const html = buildPdfHtml(makeTestData())
    expect(html).toMatch(/<!DOCTYPE html>/i)
    expect(html).toMatch(/<html/i)
    expect(html).toMatch(/<body/i)
    expect(html).toMatch(/<\/html>/i)
  })

  it('contiene il nome del workspace', () => {
    const html = buildPdfHtml(makeTestData())
    expect(html).toContain('Elettrica Rossi s.r.l.')
  })

  it('contiene il numero documento', () => {
    const html = buildPdfHtml(makeTestData())
    expect(html).toContain('2026/001')
  })

  it('contiene il titolo del documento', () => {
    const html = buildPdfHtml(makeTestData())
    expect(html).toContain('Impianto elettrico')
  })

  it('contiene il nome del cliente', () => {
    const html = buildPdfHtml(makeTestData())
    expect(html).toContain('Mario Bianchi Costruzioni')
  })

  it('contiene la descrizione della voce', () => {
    const html = buildPdfHtml(makeTestData())
    expect(html).toContain('Installazione impianto elettrico')
  })

  it('mostra il totale corretto', () => {
    const html = buildPdfHtml(makeTestData())
    expect(html).toContain('852,00') // formato it-IT
  })

  it('include la nota legale forfettario se regime è forfettario', () => {
    const html = buildPdfHtml(makeTestData())
    expect(html).toContain('Forfettario')
  })

  it('NON mostra IVA in regime forfettario', () => {
    const html = buildPdfHtml(makeTestData())
    // La colonna IVA non deve apparire nel thead
    expect(html).not.toContain('>IVA<')
  })

  it('mostra IVA in regime ordinario', () => {
    const data = makeTestData()
    data.workspace.fiscal_regime = 'ordinario'
    data.document.document_items[0].vat_rate = 22
    const html = buildPdfHtml(data)
    // L'IVA appare nel riepilogo come "IVA 22%"
    expect(html).toContain('IVA 22%')
  })

  it('mostra bollo quando bollo_amount > 0', () => {
    const html = buildPdfHtml(makeTestData())
    expect(html).toContain('Marca da bollo')
    expect(html).toContain('2,00')
  })

  it('NON mostra bollo quando bollo_amount = 0', () => {
    const data = makeTestData()
    data.document.bollo_amount = 0
    const html = buildPdfHtml(data)
    expect(html).not.toContain('Marca da bollo')
  })

  it('usa il colore primario del template', () => {
    const html = buildPdfHtml(makeTestData())
    expect(html).toContain('#1a1a2e')
  })

  it('usa colore custom se specificato', () => {
    const data = makeTestData()
    data.template!.color_primary = '#e63946'
    const html = buildPdfHtml(data)
    expect(html).toContain('#e63946')
  })

  it('mostra il branding footer se show_watermark = true', () => {
    // Sessione 23: il watermark diagonale è stato RIMOSSO. Rimane solo il footer
    // "generato con Carta Canta" quando show_watermark = true (piano Free).
    const data = makeTestData()
    data.template!.show_watermark = true
    const html = buildPdfHtml(data)
    expect(html).toContain('generato con Carta Canta')
  })

  it('NON mostra il branding se show_watermark = false', () => {
    const data = makeTestData()
    data.template!.show_watermark = false
    const html = buildPdfHtml(data)
    // Con branding off, il footer "generato con Carta Canta" non deve comparire
    // (NB: "Carta Canta" resta nel <title> della pagina, è normale)
    expect(html).not.toContain('generato con Carta Canta')
  })

  it('usa logo base64 se fornito', () => {
    const data = makeTestData()
    data.logoBase64 = 'data:image/png;base64,iVBORw0KGgo='
    const html = buildPdfHtml(data)
    expect(html).toContain('data:image/png;base64,iVBORw0KGgo=')
  })

  it('mostra placeholder logo (icona SVG) se show_logo=true ma nessun logo', () => {
    const data = makeTestData()
    data.template!.show_logo = true
    data.logoBase64 = null
    const html = buildPdfHtml(data)
    // Il placeholder è un'icona SVG a forma di documento (no iniziale)
    expect(html).toContain('<svg')
    expect(html).not.toContain('data:image')
  })

  it('NON mostra logo block se show_logo = false', () => {
    const data = makeTestData()
    data.template!.show_logo = false
    const html = buildPdfHtml(data)
    expect(html).not.toContain('data:image')
    // Il div con l'iniziale non deve comparire
    expect(html).not.toContain("display:flex;align-items:center;justify-content:center;font-size:18px")
  })

  it('gestisce cliente null senza crash', () => {
    const data = makeTestData()
    data.client = null
    const html = buildPdfHtml(data)
    expect(html).toContain('Nessun cliente')
  })

  it('gestisce template null usando defaults', () => {
    const data = makeTestData()
    data.template = null
    const html = buildPdfHtml(data)
    expect(html).toContain('#374151') // colore default (gray-700, sessione 21)
    expect(html.length).toBeGreaterThan(500)
  })

  it('escapa correttamente caratteri HTML nelle descrizioni', () => {
    const data = makeTestData()
    data.document.title = 'Prezzo: <100€ & "sconto"'
    const html = buildPdfHtml(data)
    expect(html).toContain('Prezzo: &lt;100€ &amp; &quot;sconto&quot;')
    expect(html).not.toContain('<100€')
  })

  it('include foglio di stile con @page A4', () => {
    const html = buildPdfHtml(makeTestData())
    expect(html).toContain('@page')
    expect(html).toContain('A4')
  })

  it('imposta print-color-adjust per stampa fedele', () => {
    const html = buildPdfHtml(makeTestData())
    expect(html).toContain('print-color-adjust: exact')
  })

  it('mostra più voci correttamente', () => {
    const data = makeTestData()
    data.document.document_items = [
      { ...data.document.document_items[0], id: 'i1', sort_order: 0, description: 'Voce A', total: 100 },
      { ...data.document.document_items[0], id: 'i2', sort_order: 1, description: 'Voce B', total: 200 },
    ]
    const html = buildPdfHtml(data)
    expect(html).toContain('Voce A')
    expect(html).toContain('Voce B')
  })

  it('ordina le voci per sort_order', () => {
    const data = makeTestData()
    data.document.document_items = [
      { ...data.document.document_items[0], id: 'i2', sort_order: 1, description: 'Seconda' },
      { ...data.document.document_items[0], id: 'i1', sort_order: 0, description: 'Prima' },
    ]
    const html = buildPdfHtml(data)
    const idxPrima = html.indexOf('Prima')
    const idxSeconda = html.indexOf('Seconda')
    expect(idxPrima).toBeLessThan(idxSeconda)
  })

  it('genera testo chiaro su sfondo scuro', () => {
    const data = makeTestData()
    data.template!.color_primary = '#000000' // luminance = 0 → testo bianco
    const html = buildPdfHtml(data)
    expect(html).toContain('#ffffff')
  })

  it('genera testo scuro su sfondo chiaro', () => {
    const data = makeTestData()
    data.template!.color_primary = '#ffffff' // luminance = 1 → testo nero
    const html = buildPdfHtml(data)
    expect(html).toContain('#000000')
  })
})

// ── Dicitura ritenuta d'acconto (fase 1 ritenuta, 27 lug) ──────────────────
// I forfettari sono ESENTI da ritenuta (art. 1, c. 67, L.190/2014) ma devono
// dichiararlo in fattura: senza la dicitura un condominio committente
// trattiene il 4% per errore. La riga vale SOLO sulle fatture dei forfettari.

describe('dicitura esenzione ritenuta (comma 67) sulle fatture forfettari', () => {
  it('fattura forfettario: la dicitura c\'è', () => {
    const data = makeTestData()
    data.document.doc_type = 'fattura'
    const html = buildPdfHtml(data)
    expect(html).toContain('comma 67')
    expect(html).toContain('ritenuta d&#39;acconto')
  })

  it('resta anche con una legal_notice PERSONALIZZATA (è fiscale, non cortesia)', () => {
    const data = makeTestData()
    data.document.doc_type = 'fattura'
    data.template!.legal_notice = 'Testo personalizzato del cliente Pro.'
    const html = buildPdfHtml(data)
    expect(html).toContain('Testo personalizzato del cliente Pro.')
    expect(html).toContain('comma 67')
  })

  it('PREVENTIVO forfettario: nessuna dicitura ritenuta', () => {
    const html = buildPdfHtml(makeTestData())
    expect(html).not.toContain('comma 67')
  })

  it('fattura in regime ORDINARIO: nessuna dicitura (il forfettario non c\'entra)', () => {
    const data = makeTestData()
    data.document.doc_type = 'fattura'
    data.workspace.fiscal_regime = 'ordinario'
    const html = buildPdfHtml(data)
    expect(html).not.toContain('comma 67')
  })
})
