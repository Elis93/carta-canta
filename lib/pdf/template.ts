// ============================================================
// CARTA CANTA — PDF HTML Template
// Genera HTML con inline styles per la stampa via Playwright.
// NO dipendenze esterne, NO Tailwind — solo stili inline puri.
// ============================================================

import type { Database } from '@/types/database'

type DocumentRow = Database['public']['Tables']['documents']['Row']
type DocumentItemRow = Database['public']['Tables']['document_items']['Row']
type WorkspaceRow = Database['public']['Tables']['workspaces']['Row']
type ClientRow = Database['public']['Tables']['clients']['Row']
type TemplateRow = Database['public']['Tables']['templates']['Row']

// Estende TemplateRow con preset_key finché types/database.ts non viene rigenerato
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TemplateRowWithPreset = TemplateRow & { preset_key?: string | null }

export interface PdfDocumentData {
  document: DocumentRow & { document_items: DocumentItemRow[] }
  workspace: Pick<WorkspaceRow,
    'ragione_sociale' | 'name' | 'piva' | 'indirizzo' | 'cap' |
    'citta' | 'provincia' | 'logo_url' | 'fiscal_regime'
  >
  client: Pick<ClientRow,
    'name' | 'email' | 'phone' | 'piva' | 'indirizzo' |
    'cap' | 'citta' | 'provincia' | 'paese'
  > | null
  template: Pick<TemplateRowWithPreset,
    'color_primary' | 'font_family' | 'show_logo' | 'show_watermark' |
    'legal_notice' | 'preset_key'
  > | null
  logoBase64?: string | null   // data:image/... precaricato per evitare fetch da Playwright
}

// ── Utility ────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined): string {
  return (n ?? 0).toLocaleString('it-IT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function luminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) || 0
  const g = parseInt(hex.slice(3, 5), 16) || 0
  const b = parseInt(hex.slice(5, 7), 16) || 0
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

function hexAlpha(hex: string, alpha: number): string {
  // Converte hex color → rgba per supporto universale in Chromium
  const r = parseInt(hex.slice(1, 3), 16) || 0
  const g = parseInt(hex.slice(3, 5), 16) || 0
  const b = parseInt(hex.slice(5, 7), 16) || 0
  return `rgba(${r},${g},${b},${alpha})`
}

function escHtml(s: string | null | undefined): string {
  if (!s) return ''
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Converte le newline in <br> dopo l'escaping HTML
function nl2br(s: string | null | undefined): string {
  if (!s) return ''
  return escHtml(s).replace(/\n/g, '<br>')
}

const FONT_STACKS: Record<string, string> = {
  Inter:     "'Inter', 'Segoe UI', Arial, sans-serif",
  GeistSans: "'Geist', 'GeistSans', 'Segoe UI', Arial, sans-serif",
  Helvetica: "Helvetica, 'Helvetica Neue', Arial, sans-serif",
  Georgia:   "Georgia, 'Times New Roman', 'Book Antiqua', serif",
}

// Font predefinito per ogni preset
const PRESET_DEFAULT_FONT: Record<string, string> = {
  classico: 'Inter',
  bold:     'Helvetica',
  tecnico:  'GeistSans',
  elegante: 'Georgia',
}

// Mappa font_family legacy → preset_key (per template prima della migration 021)
function fontFamilyToPreset(font: string | null | undefined): string {
  if (!font) return 'classico'
  const map: Record<string, string> = {
    Inter:     'classico',
    GeistSans: 'tecnico',
    Helvetica: 'classico',
    Georgia:   'elegante',
  }
  return map[font] ?? 'classico'
}

// ── Preset layout per preset_key ────────────────────────────────────────────
interface PdfPreset {
  headerPadding: string
  logoSize: string          // es. '40px'
  headerCentered: boolean   // elegante: layout a due fasce centrato
  contactStrip: boolean     // bold: striscia contatti sotto header
  thFill: boolean           // false = solo bordo inferiore (tecnico)
  thAlpha: number           // opacità fill intestazione tabella
  tdPadding: string
  thFontSize: string
  descItalic: boolean
  labelStyle: string        // CSS inline per le etichette sezione
}

const PDF_PRESETS: Record<string, PdfPreset> = {
  // ── Classico (Inter): layout pulito, spaziatura standard
  classico: {
    headerPadding: '20px 28px',
    logoSize:      '40px',
    headerCentered: false,
    contactStrip:   false,
    thFill:        true,
    thAlpha:       0.08,
    tdPadding:     '7px 8px',
    thFontSize:    '10px',
    descItalic:    false,
    labelStyle:    'font-size:9px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:5px;',
  },

  // ── Bold (Helvetica): header imponente, striscia contatti, totali pesanti
  bold: {
    headerPadding: '24px 28px',
    logoSize:      '56px',
    headerCentered: false,
    contactStrip:   true,
    thFill:        true,
    thAlpha:       0.12,
    tdPadding:     '8px 8px',
    thFontSize:    '10px',
    descItalic:    false,
    labelStyle:    'font-size:9px;font-weight:800;color:#999;text-transform:uppercase;letter-spacing:0.10em;margin-bottom:5px;',
  },

  // ── Tecnico (GeistSans): compatto, tabella con solo bordo inferiore colorato
  tecnico: {
    headerPadding: '14px 28px',
    logoSize:      '32px',
    headerCentered: false,
    contactStrip:   false,
    thFill:        false,
    thAlpha:       0,
    tdPadding:     '5px 8px',
    thFontSize:    '9px',
    descItalic:    false,
    labelStyle:    'font-size:9px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.10em;margin-bottom:5px;',
  },

  // ── Elegante (Georgia): header centrato a due fasce, descrizioni in corsivo
  elegante: {
    headerPadding: '16px 28px',
    logoSize:      '40px',
    headerCentered: true,
    contactStrip:   false,
    thFill:        true,
    thAlpha:       0.08,
    tdPadding:     '8px 8px',
    thFontSize:    '10px',
    descItalic:    true,
    labelStyle:    'font-size:9px;font-weight:600;color:#999;letter-spacing:0.06em;margin-bottom:5px;',
  },
}

// ── Template HTML principale ────────────────────────────────────────────────

export function buildPdfHtml(data: PdfDocumentData): string {
  const { document: doc, workspace, client, template, logoBase64 } = data

  const color = template?.color_primary ?? '#1a1a2e'

  // Risolvi preset: usa preset_key se disponibile, altrimenti mappa da font_family (compat pre-021)
  const presetKey = template?.preset_key ?? fontFamilyToPreset(template?.font_family)
  const preset = PDF_PRESETS[presetKey] ?? PDF_PRESETS.classico

  // Risolvi font: usa font_family salvato, altrimenti il default del preset
  const fontName = template?.font_family ?? PRESET_DEFAULT_FONT[presetKey] ?? 'Inter'
  const font = FONT_STACKS[fontName] ?? FONT_STACKS.Inter

  const textOnColor = luminance(color) > 0.5 ? '#000000' : '#ffffff'
  const showLogo = template?.show_logo ?? true
  const showWatermark = template?.show_watermark ?? false
  const legalNotice = template?.legal_notice ?? (
    workspace.fiscal_regime === 'forfettario'
      ? "Operazione effettuata ai sensi dell'art. 1, commi 54-89, L. 190/2014 (Regime Forfettario) – Operazione fuori campo IVA ai sensi del comma 58, lettera a), del medesimo articolo"
      : null
  )
  const isForfettario = workspace.fiscal_regime === 'forfettario'

  const wsName = escHtml(workspace.ragione_sociale ?? workspace.name)
  const wsAddress = [
    workspace.indirizzo,
    workspace.cap && workspace.citta ? `${workspace.cap} ${workspace.citta}` : workspace.citta,
    workspace.provincia,
  ].filter(Boolean).map(escHtml).join(' — ')

  const docDate = doc.created_at
    ? new Date(doc.created_at).toLocaleDateString('it-IT', {
        day: '2-digit', month: 'long', year: 'numeric',
      })
    : '—'

  const expiresDate = doc.expires_at
    ? new Date(doc.expires_at).toLocaleDateString('it-IT', {
        day: '2-digit', month: 'long', year: 'numeric',
      })
    : null

  // ── Righe voci ────────────────────────────────────────────
  const items = doc.document_items
    .sort((a, b) => a.sort_order - b.sort_order)

  const vatGroups: Record<number, number> = {}

  const itemRows = items.map((item) => {
    const lineTotal = item.total
    const vatRate = item.vat_rate ?? (doc.vat_rate_default ?? 22)
    if (!isForfettario && vatRate > 0) {
      vatGroups[vatRate] = (vatGroups[vatRate] ?? 0) + lineTotal * (vatRate / 100)
    }
    const tdStyle = `padding:${preset.tdPadding};font-size:11px;`
    const descItalicStyle = preset.descItalic ? 'font-style:italic;' : ''
    return `
    <tr style="border-bottom:1px solid #f0f0f0;">
      <td style="${tdStyle}${descItalicStyle}">${escHtml(item.description)}</td>
      <td style="${tdStyle}text-align:center;color:#666;">${escHtml(item.unit ?? 'pz')}</td>
      <td style="${tdStyle}text-align:right;color:#666;">${Number(item.quantity).toLocaleString('it-IT', { maximumFractionDigits: 3 })}</td>
      <td style="${tdStyle}text-align:right;color:#666;">€${fmt(Number(item.unit_price))}</td>
      ${item.discount_pct ? `<td style="${tdStyle}text-align:right;color:#666;">${Number(item.discount_pct)}%</td>` : `<td style="${tdStyle}text-align:right;color:#666;">—</td>`}
      ${isForfettario ? '' : `<td style="${tdStyle}text-align:right;color:#666;">${vatRate}%</td>`}
      <td style="${tdStyle}text-align:right;font-weight:600;">€${fmt(lineTotal)}</td>
    </tr>`
  }).join('')

  // ── Riepilogo fiscale ──────────────────────────────────────
  const subtotal = Number(doc.subtotal)
  const afterDiscount = subtotal * (1 - (Number(doc.discount_pct ?? 0)) / 100) - Number(doc.discount_fixed ?? 0)
  const discount = subtotal - afterDiscount
  const taxAmount = Number(doc.tax_amount)
  const bolloAmount = Number(doc.bollo_amount)
  const total = Number(doc.total)
  const hasDiscount = Math.abs(discount) > 0.001

  const vatGroupRows = Object.entries(vatGroups).map(([rate, amount]) => `
    <tr>
      <td style="padding:3px 0;font-size:10px;color:#666;">IVA ${rate}%</td>
      <td style="padding:3px 0;font-size:10px;text-align:right;color:#666;">€${fmt(amount)}</td>
    </tr>`
  ).join('')

  // ── Logo ───────────────────────────────────────────────────
  const ls = preset.logoSize  // es. '40px'
  let logoHtml = ''
  if (showLogo) {
    if (logoBase64) {
      logoHtml = `<img src="${logoBase64}" alt="${wsName}" style="height:${ls};width:${ls};object-fit:contain;border-radius:4px;" />`
    } else {
      const initial = (workspace.ragione_sociale ?? workspace.name)?.[0]?.toUpperCase() ?? '?'
      const initFs = parseInt(ls) * 0.4
      logoHtml = `<div style="height:${ls};width:${ls};border-radius:4px;background:${hexAlpha(textOnColor === '#ffffff' ? '#000000' : '#ffffff', 0.2)};display:flex;align-items:center;justify-content:center;font-size:${initFs}px;font-weight:700;color:${textOnColor};">${initial}</div>`
    }
  }

  // ── Client block ───────────────────────────────────────────
  const clientBlock = client ? `
    <div>
      <div style="${preset.labelStyle}">Destinatario</div>
      <div style="font-size:12px;font-weight:600;color:#111;">${escHtml(client.name)}</div>
      ${client.piva ? `<div style="font-size:10px;color:#666;">P.IVA: ${escHtml(client.piva)}</div>` : ''}
      ${client.indirizzo ? `<div style="font-size:10px;color:#666;">${escHtml(client.indirizzo)}</div>` : ''}
      ${(client.cap || client.citta) ? `<div style="font-size:10px;color:#666;">${escHtml(client.cap ?? '')} ${escHtml(client.citta ?? '')}${client.provincia ? ` (${escHtml(client.provincia)})` : ''}</div>` : ''}
      ${client.email ? `<div style="font-size:10px;color:#666;">${escHtml(client.email)}</div>` : ''}
      ${client.phone ? `<div style="font-size:10px;color:#666;">${escHtml(client.phone)}</div>` : ''}
    </div>
  ` : '<div style="font-size:11px;color:#999;font-style:italic;">Nessun cliente specificato</div>'

  // ── Header HTML ────────────────────────────────────────────
  const boldNameStyle = preset.contactStrip
    ? 'font-size:17px;font-weight:800;letter-spacing:0.01em;'
    : 'font-size:14px;font-weight:700;'

  const boldPreviewStyle = preset.contactStrip
    ? 'font-size:18px;font-weight:900;letter-spacing:0.04em;'
    : 'font-size:16px;font-weight:800;letter-spacing:0.05em;'

  const headerHtml = preset.headerCentered ? `
  <!-- Elegante: due fasce centrate -->
  <div style="background:${color};color:${textOnColor};padding:${preset.headerPadding};text-align:center;position:relative;z-index:1;">
    ${showLogo ? `<div style="display:flex;justify-content:center;margin-bottom:8px;">${logoHtml}</div>` : ''}
    <div style="${boldNameStyle}">${wsName}</div>
    ${wsAddress ? `<div style="font-size:10px;opacity:0.72;margin-top:2px;">${wsAddress}</div>` : ''}
    ${workspace.piva ? `<div style="font-size:10px;opacity:0.72;">P.IVA ${escHtml(workspace.piva)}</div>` : ''}
  </div>
  <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 28px;border-bottom:2px solid ${color};position:relative;z-index:1;">
    <div style="font-size:10px;color:#666;font-style:italic;">${docDate}</div>
    <div style="text-align:right;">
      <div style="font-size:13px;font-weight:800;letter-spacing:0.05em;color:${color};">PREVENTIVO</div>
      ${doc.doc_number ? `<div style="font-size:10px;color:${color};font-style:italic;">n. ${escHtml(doc.doc_number)}</div>` : ''}
    </div>
  </div>` : `
  <!-- Classico / Bold / Tecnico: split orizzontale -->
  <div style="background:${color};color:${textOnColor};padding:${preset.headerPadding};display:flex;align-items:center;justify-content:space-between;position:relative;z-index:1;">
    <div style="display:flex;align-items:center;gap:14px;">
      ${logoHtml}
      <div>
        <div style="${boldNameStyle}">${wsName}</div>
        ${wsAddress ? `<div style="font-size:10px;opacity:0.75;">${wsAddress}</div>` : ''}
        ${workspace.piva ? `<div style="font-size:10px;opacity:0.75;">P.IVA ${escHtml(workspace.piva)}</div>` : ''}
      </div>
    </div>
    <div style="text-align:right;">
      <div style="${boldPreviewStyle}">PREVENTIVO</div>
      ${doc.doc_number ? `<div style="font-size:11px;opacity:0.8;">#${escHtml(doc.doc_number)}</div>` : ''}
    </div>
  </div>
  ${preset.contactStrip ? `
  <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 28px;background:#f8fafc;border-bottom:2px solid ${color};position:relative;z-index:1;">
    <div style="font-size:9px;color:#555;">
      ${workspace.piva ? `P.IVA ${escHtml(workspace.piva)}` : ''}${wsAddress ? ` &nbsp;·&nbsp; ${wsAddress}` : ''}
    </div>
    <div style="font-size:9px;color:#555;">${docDate}</div>
  </div>` : ''}`

  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Preventivo ${escHtml(doc.doc_number ?? '')} — ${wsName}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      font-family: ${font};
      font-size: 12px;
      line-height: 1.5;
      color: #111;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    @page {
      size: A4;
      margin: 0;
    }
    table { border-collapse: collapse; width: 100%; }
    .page { width: 210mm; min-height: 297mm; position: relative; }
  </style>
</head>
<body>
<div class="page">

  ${showWatermark ? `
  <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:0;transform:rotate(-30deg);opacity:0.04;">
    <span style="font-size:72px;font-weight:900;color:#555;white-space:nowrap;user-select:none;">Carta Canta</span>
  </div>` : ''}

  <!-- ═══ HEADER ═══ -->
  ${headerHtml}

  <!-- ═══ BODY ═══ -->
  <div style="padding:24px 28px;position:relative;z-index:1;">

    <!-- Info riga: client + date -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:20px;">
      ${clientBlock}
      <div style="text-align:right;flex-shrink:0;">
        <div style="${preset.labelStyle}">Data</div>
        ${preset.headerCentered || preset.contactStrip ? '' : `<div style="font-size:12px;font-weight:600;color:#111;">${docDate}</div>`}
        ${expiresDate ? `<div style="font-size:10px;color:#666;margin-top:2px;">Valido fino al ${expiresDate}</div>` : ''}
        ${doc.payment_terms ? `<div style="font-size:10px;color:#666;margin-top:2px;">Pagamento: ${escHtml(doc.payment_terms)}</div>` : ''}
      </div>
    </div>

    <!-- Titolo documento -->
    <div style="margin-bottom:16px;">
      <div style="font-size:15px;font-weight:700;color:#111;">${escHtml(doc.title)}</div>
      ${doc.notes ? `<div style="font-size:10px;color:#666;margin-top:4px;">${nl2br(doc.notes)}</div>` : ''}
    </div>

    <!-- Tabella voci -->
    <table style="margin-bottom:16px;">
      <thead>
        <tr style="${preset.thFill ? `background:${hexAlpha(color, preset.thAlpha)};` : `background:transparent;border-bottom:3px solid ${color};`}">
          <th style="padding:${preset.tdPadding};text-align:left;font-size:${preset.thFontSize};font-weight:700;color:${color};text-transform:uppercase;letter-spacing:0.05em;">Descrizione</th>
          <th style="padding:${preset.tdPadding};text-align:center;font-size:${preset.thFontSize};font-weight:700;color:${color};width:35px;">UM</th>
          <th style="padding:${preset.tdPadding};text-align:right;font-size:${preset.thFontSize};font-weight:700;color:${color};width:50px;">Qtà</th>
          <th style="padding:${preset.tdPadding};text-align:right;font-size:${preset.thFontSize};font-weight:700;color:${color};width:70px;">Prezzo</th>
          <th style="padding:${preset.tdPadding};text-align:right;font-size:${preset.thFontSize};font-weight:700;color:${color};width:50px;">Sc.%</th>
          ${isForfettario ? '' : `<th style="padding:${preset.tdPadding};text-align:right;font-size:${preset.thFontSize};font-weight:700;color:${color};width:45px;">IVA</th>`}
          <th style="padding:${preset.tdPadding};text-align:right;font-size:${preset.thFontSize};font-weight:700;color:${color};width:70px;">Totale</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
      </tbody>
    </table>

    <!-- Riepilogo fiscale -->
    <div style="display:flex;justify-content:flex-end;">
      <div style="min-width:220px;border-top:1px solid #e5e5e5;padding-top:12px;">
        <table style="width:100%;">
          <tbody>
            <tr>
              <td style="padding:3px 0;font-size:10px;color:#666;">Subtotale</td>
              <td style="padding:3px 0;font-size:10px;text-align:right;">€${fmt(subtotal)}</td>
            </tr>
            ${hasDiscount ? `
            <tr>
              <td style="padding:3px 0;font-size:10px;color:#666;">Sconto</td>
              <td style="padding:3px 0;font-size:10px;text-align:right;color:#16a34a;">−€${fmt(Math.abs(discount))}</td>
            </tr>
            <tr>
              <td style="padding:3px 0;font-size:10px;color:#666;">Imponibile</td>
              <td style="padding:3px 0;font-size:10px;text-align:right;">€${fmt(afterDiscount)}</td>
            </tr>` : ''}
            ${vatGroupRows}
            ${bolloAmount > 0 ? `
            <tr>
              <td style="padding:3px 0;font-size:10px;color:#666;">Marca da bollo</td>
              <td style="padding:3px 0;font-size:10px;text-align:right;">€${fmt(bolloAmount)}</td>
            </tr>` : ''}
            <tr style="border-top:${preset.contactStrip ? '3px' : '2px'} solid ${color};margin-top:6px;">
              <td style="padding:8px 0 3px;font-size:${preset.contactStrip ? '14px' : '13px'};font-weight:${preset.contactStrip ? '900' : '800'};color:${color};">TOTALE</td>
              <td style="padding:8px 0 3px;font-size:${preset.contactStrip ? '14px' : '13px'};font-weight:${preset.contactStrip ? '900' : '800'};color:${color};text-align:right;">€${fmt(total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Nota legale -->
    ${legalNotice ? `
    <div style="margin-top:20px;border-top:1px solid #e5e5e5;padding-top:10px;">
      <p style="font-size:8.5px;color:#999;line-height:1.6;">${escHtml(legalNotice)}</p>
    </div>` : ''}

  </div>

  <!-- ═══ FOOTER ═══ -->
  <div style="position:absolute;bottom:0;left:0;right:0;padding:8px 28px;background:${hexAlpha(color, 0.07)};display:flex;justify-content:space-between;align-items:center;">
    <span style="font-size:8px;color:${color};opacity:0.6;">Generato con Carta Canta · cartacanta.app</span>
    <span style="font-size:8px;color:${color};opacity:0.6;">${wsName}</span>
  </div>

</div>
</body>
</html>`
}
