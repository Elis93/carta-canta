// ============================================================
// CARTA CANTA — PDF HTML Template
// 4 preset distinti: classico | bold | tecnico | elegante
// Inline styles puri — NO Tailwind, NO dipendenze esterne.
// ============================================================

import type { Database } from '@/types/database'

type DocumentRow     = Database['public']['Tables']['documents']['Row']
type DocumentItemRow = Database['public']['Tables']['document_items']['Row']
type WorkspaceRow    = Database['public']['Tables']['workspaces']['Row']
type ClientRow       = Database['public']['Tables']['clients']['Row']
type TemplateRow     = Database['public']['Tables']['templates']['Row']

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
  template: (Pick<TemplateRowWithPreset,
    'color_primary' | 'font_family' | 'show_logo' | 'show_watermark' |
    'legal_notice' | 'preset_key'
  > & { logo_position?: string | null }) | null
  logoBase64?: string | null
}

// ── Utilities ─────────────────────────────────────────────────────────────────

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

function rgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16) || 0
  const g = parseInt(hex.slice(3, 5), 16) || 0
  const b = parseInt(hex.slice(5, 7), 16) || 0
  return `rgba(${r},${g},${b},${alpha})`
}

function esc(s: string | null | undefined): string {
  if (!s) return ''
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function nl2br(s: string | null | undefined): string {
  if (!s) return ''
  return esc(s).replace(/\n/g, '<br>')
}

// Alias mantenuto per compatibilità con chiamate interne legacy
const escHtml = esc
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function hexAlpha(hex: string, alpha: number): string { return rgba(hex, alpha) }

const FONT_STACKS: Record<string, string> = {
  Inter:     "'Inter', 'Segoe UI', Arial, sans-serif",
  GeistSans: "'Geist', 'GeistSans', 'Segoe UI', Arial, sans-serif",
  Helvetica: "Helvetica, 'Helvetica Neue', Arial, sans-serif",
  Georgia:   "Georgia, 'Times New Roman', 'Book Antiqua', serif",
}

const PRESET_DEFAULT_FONT: Record<string, string> = {
  classico: 'Inter',
  bold:     'Helvetica',
  tecnico:  'GeistSans',
  elegante: 'Georgia',
}

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

// ── HTML wrapper ──────────────────────────────────────────────────────────────

function wrap(font: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
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
    @page { size: A4; margin: 0; }
    table { border-collapse: collapse; width: 100%; }
    .page { width: 210mm; min-height: 297mm; position: relative; overflow: hidden; }
  </style>
</head>
<body>
<div class="page">
${body}
</div>
</body>
</html>`
}

// ── Main export ────────────────────────────────────────────────────────────────

export function buildPdfHtml(data: PdfDocumentData): string {
  const { document: doc, workspace, client, template, logoBase64 } = data

  const color        = template?.color_primary ?? '#1a1a2e'
  const presetKey    = template?.preset_key ?? fontFamilyToPreset(template?.font_family)
  const fontName     = template?.font_family ?? PRESET_DEFAULT_FONT[presetKey] ?? 'Inter'
  const font         = FONT_STACKS[fontName] ?? FONT_STACKS.Inter
  const onColor         = luminance(color) > 0.5 ? '#000000' : '#ffffff'
  // Colore accento sicuro su sfondo bianco: se il brand è troppo chiaro (luminance > 0.4)
  // il testo non sarebbe leggibile su sfondo chiaro, quindi ricade sul navy di default.
  const safeAccentColor = luminance(color) > 0.4 ? '#1a1a2e' : color
  const showLogo     = template?.show_logo ?? true
  const showWm       = template?.show_watermark ?? true  // default true = mostra branding
  const logoPosition = template?.logo_position ?? 'left'
  const isLogoRight  = logoPosition === 'right'
  const isForf       = workspace.fiscal_regime === 'forfettario'

  const legalNotice = template?.legal_notice ?? (
    isForf
      ? "Operazione effettuata ai sensi dell'art. 1, commi 54-89, L. 190/2014 (Regime Forfettario) – Operazione fuori campo IVA ai sensi del comma 58, lettera a), del medesimo articolo"
      : null
  )

  const docTypeLabel = doc.doc_type === 'fattura' ? 'FATTURA' : 'PREVENTIVO'

  // Dati workspace
  const wsName    = esc(workspace.ragione_sociale ?? workspace.name)
  const wsPiva    = workspace.piva ? `P.IVA ${esc(workspace.piva)}` : ''
  const wsCitta   = workspace.citta ? esc(workspace.citta) : ''
  const wsAddrParts = [
    workspace.indirizzo,
    workspace.cap && workspace.citta
      ? `${workspace.cap} ${workspace.citta}`
      : workspace.citta,
    workspace.provincia,
  ].filter(Boolean)
  const wsAddr = wsAddrParts.map(esc).join(' · ')
  const wsAddrCompact = [workspace.indirizzo, workspace.citta, workspace.provincia]
    .filter(Boolean).map(esc).join(', ')

  // Date
  const docDate = doc.created_at
    ? new Date(doc.created_at).toLocaleDateString('it-IT', {
        day: '2-digit', month: 'long', year: 'numeric',
      })
    : '—'
  const docDateShort = doc.created_at
    ? new Date(doc.created_at).toLocaleDateString('it-IT', {
        day: '2-digit', month: '2-digit', year: 'numeric',
      })
    : '—'
  const expiresDate = doc.expires_at
    ? new Date(doc.expires_at).toLocaleDateString('it-IT', {
        day: '2-digit', month: 'long', year: 'numeric',
      })
    : null
  const expiresDateShort = doc.expires_at
    ? new Date(doc.expires_at).toLocaleDateString('it-IT', {
        day: '2-digit', month: '2-digit', year: 'numeric',
      })
    : null

  // Items ordinati
  const items = doc.document_items.sort((a, b) => a.sort_order - b.sort_order)

  // Calcoli fiscali
  const subtotal    = Number(doc.subtotal)
  const afterDisc   = subtotal * (1 - Number(doc.discount_pct ?? 0) / 100) - Number(doc.discount_fixed ?? 0)
  const discount    = subtotal - afterDisc
  const taxAmount   = Number(doc.tax_amount)
  const bolloAmount = Number(doc.bollo_amount)
  const total       = Number(doc.total)
  const hasDiscount = Math.abs(discount) > 0.001

  const vatGroups: Record<number, number> = {}
  items.forEach(item => {
    const rate = item.vat_rate ?? (doc.vat_rate_default ?? 22)
    if (!isForf && rate > 0) {
      vatGroups[rate] = (vatGroups[rate] ?? 0) + Number(item.total) * (rate / 100)
    }
  })

  // ── Logo helper ────────────────────────────────────────────
  function logoEl(size: number, bgColor: string, iconColor: string, bordered = false): string {
    if (!showLogo) return ''
    const sz = `${size}px`
    const iconSize = Math.round(size * 0.44)
    const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>`
    if (logoBase64) {
      return `<img src="${logoBase64}" alt="${wsName}" style="height:${sz};width:${sz};object-fit:contain;border-radius:4px;flex-shrink:0;" />`
    }
    if (bordered) {
      return `<div style="height:${sz};width:${sz};border-radius:4px;border:1.5px solid #d0d0d0;background:#fafafa;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${svgIcon}</div>`
    }
    return `<div style="height:${sz};width:${sz};border-radius:6px;background:${bgColor};display:flex;align-items:center;justify-content:center;flex-shrink:0;">${svgIcon}</div>`
  }

  // ── Client block helper ────────────────────────────────────
  function clientEl(nameSize = '13px', addrSize = '10px'): string {
    if (!client) return '<div style="font-size:11px;color:#999;font-style:italic;">Nessun cliente</div>'
    const cf = (client as Record<string, unknown>).codice_fiscale as string | undefined
    return [
      `<div style="font-size:${nameSize};font-weight:700;color:#111;margin-bottom:2px;">${esc(client.name)}</div>`,
      client.indirizzo ? `<div style="font-size:${addrSize};color:#666;">${esc(client.indirizzo)}</div>` : '',
      (client.cap || client.citta)
        ? `<div style="font-size:${addrSize};color:#666;">${[esc(client.cap ?? ''), esc(client.citta ?? ''), client.provincia ? `(${esc(client.provincia)})` : ''].filter(Boolean).join(' ')}</div>`
        : '',
      client.piva ? `<div style="font-size:${addrSize};color:#666;">P.IVA ${esc(client.piva)}</div>` : '',
      cf ? `<div style="font-size:${addrSize};color:#666;">C.F. ${esc(cf)}</div>` : '',
    ].join('')
  }

  // ── VAT rows helper ────────────────────────────────────────
  function vatRowsEl(tdPad: string, fs: string, colorA = '#888'): string {
    return Object.entries(vatGroups).map(([rate, amt]) => `
      <tr>
        <td style="padding:${tdPad};font-size:${fs};color:${colorA};">IVA ${rate}%</td>
        <td style="padding:${tdPad};font-size:${fs};color:${colorA};text-align:right;">${fmt(amt)} €</td>
      </tr>`).join('')
  }

  // ── Watermark branding (Carta Canta — solo Free) ──────────
  const wmHtml = showWm ? `
    <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:0;transform:rotate(-30deg);opacity:0.04;">
      <span style="font-size:72px;font-weight:900;color:#555;white-space:nowrap;">Carta Canta</span>
    </div>` : ''

  // ── Watermark stato documento ──────────────────────────────
  // BOZZA: documento mai scaricato/mai inviato.
  // NON ANCORA INVIATO: PDF scaricato ma non ancora inviato ufficialmente.
  // La filigrana è grande, diagonale, ben visibile anche in stampa.
  let statusWatermarkText: string | null = null
  let statusWatermarkColor = 'rgba(180,0,0,0.18)'
  if (doc.status === 'draft') {
    if (!doc.pdf_downloaded_at) {
      statusWatermarkText = 'BOZZA'
      statusWatermarkColor = 'rgba(100,100,100,0.20)'
    } else {
      statusWatermarkText = 'NON ANCORA INVIATO'
      statusWatermarkColor = 'rgba(180,80,0,0.18)'
    }
  }
  // Per BOZZA: griglia 3×4 tiles ruotata per copertura totale della pagina.
  // Per NON ANCORA INVIATO: timbro singolo centrato (testo lungo, una sola riga).
  const statusWmHtml = statusWatermarkText === 'BOZZA' ? (() => {
    const tile = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;width:200px;height:160px;font-family:Helvetica,'Arial Black',sans-serif;font-weight:900;color:${statusWatermarkColor};text-transform:uppercase;">
      <span style="font-size:34px;letter-spacing:0.08em;line-height:1;">BOZZA</span>
      <span style="font-size:11px;letter-spacing:0.18em;line-height:1;">Carta Canta</span>
      <span style="font-size:34px;letter-spacing:0.08em;line-height:1;">BOZZA</span>
    </div>`
    const row = Array(3).fill(tile).join('')
    const grid = Array(4).fill(`<div style="display:flex;">${row}</div>`).join('')
    return `<div style="position:fixed;top:-20%;left:-20%;width:140%;height:140%;pointer-events:none;z-index:9999;transform:rotate(-25deg);display:flex;flex-direction:column;justify-content:space-around;">${grid}</div>`
  })() : statusWatermarkText ? `
    <div style="
      position:fixed;
      top:0;left:0;right:0;bottom:0;
      display:flex;
      align-items:center;
      justify-content:center;
      pointer-events:none;
      z-index:9999;
    ">
      <div style="
        transform:rotate(-35deg);
        font-size:52px;
        font-weight:900;
        color:${statusWatermarkColor};
        letter-spacing:0.05em;
        white-space:nowrap;
        font-family:Helvetica,'Arial Black',sans-serif;
        text-transform:uppercase;
        border:6px solid ${statusWatermarkColor};
        padding:12px 28px;
        border-radius:8px;
        line-height:1;
      ">${statusWatermarkText}</div>
    </div>` : ''

  // ── Legal notice ───────────────────────────────────────────
  const legalHtml = legalNotice ? `
    <div style="margin-top:20px;border-top:1px solid #ebebeb;padding-top:10px;">
      <p style="font-size:8px;color:#aaa;line-height:1.6;">${escHtml(legalNotice)}</p>
    </div>` : ''

  // ── Branding footer (nascosto per Pro con show_watermark = false) ──────────
  // showWm = true → mostra "Generato con Carta Canta" (default Free, obbligatorio)
  // showWm = false → Pro ha rimosso il branding
  const brandingSpan = (color: string) =>
    showWm ? `<span style="font-size:8px;color:${color};">Generato con Carta Canta · cartacanta.app</span>` : '<span></span>'

  // ══════════════════════════════════════════════════════════════════════
  // DISPATCH PER PRESET
  // ══════════════════════════════════════════════════════════════════════

  switch (presetKey) {

    // ──────────────────────────────────────────────────────────────────
    // CLASSICO — Inter, header bianco, table header scuro, pulito
    // ──────────────────────────────────────────────────────────────────
    case 'classico':
    default: {
      const LABEL = 'font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.09em;color:#999;margin-bottom:4px;'

      const rows = items.map(item => `
        <tr style="border-bottom:1px solid #f2f2f2;">
          <td style="padding:7px 10px;font-size:11px;color:#111;">${esc(item.description)}</td>
          <td style="padding:7px 8px;font-size:11px;text-align:right;color:#888;">${Number(item.quantity).toLocaleString('it-IT', { maximumFractionDigits: 3 })}</td>
          <td style="padding:7px 8px;font-size:11px;text-align:right;color:#888;">${fmt(Number(item.unit_price))} €</td>
          <td style="padding:7px 10px;font-size:11px;text-align:right;font-weight:700;">${fmt(Number(item.total))} €</td>
        </tr>`).join('')

      return wrap(font, `
        ${wmHtml}
        ${statusWmHtml}

        <!-- HEADER: bianco, split orizzontale -->
        <div style="padding:28px 32px 22px;display:flex;align-items:flex-start;justify-content:space-between;border-bottom:1px solid #e0e0e0;position:relative;z-index:1;">
          ${isLogoRight
            ? `<div style="text-align:left;flex-shrink:0;">
                <div style="font-size:26px;font-weight:800;letter-spacing:0.02em;color:#111;line-height:1;">${docTypeLabel}</div>
                <div style="font-size:12px;color:#888;margin-top:5px;">${doc.doc_number ? `#${esc(doc.doc_number)}` : 'BOZZA'}</div>
               </div>
               <div style="display:flex;align-items:center;gap:14px;flex-direction:row-reverse;">
                ${logoEl(44, color, onColor)}
                <div style="text-align:right;">
                  <div style="font-size:16px;font-weight:700;color:#111;line-height:1.2;">${wsName}</div>
                  <div style="font-size:10px;color:#888;margin-top:3px;">${[wsAddr, wsPiva].filter(Boolean).join(' · ')}</div>
                </div>
               </div>`
            : `<div style="display:flex;align-items:center;gap:14px;">
                ${logoEl(44, color, onColor)}
                <div>
                  <div style="font-size:16px;font-weight:700;color:#111;line-height:1.2;">${wsName}</div>
                  <div style="font-size:10px;color:#888;margin-top:3px;">${[wsAddr, wsPiva].filter(Boolean).join(' · ')}</div>
                </div>
               </div>
               <div style="text-align:right;flex-shrink:0;">
                <div style="font-size:26px;font-weight:800;letter-spacing:0.02em;color:#111;line-height:1;">${docTypeLabel}</div>
                <div style="font-size:12px;color:#888;margin-top:5px;">${doc.doc_number ? `#${esc(doc.doc_number)}` : 'BOZZA'}</div>
               </div>`
          }
        </div>

        <!-- BODY -->
        <div style="padding:22px 32px;position:relative;z-index:1;">

          <!-- Destinatario + data -->
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:24px;margin-bottom:22px;">
            <div>
              <div style="${LABEL}">Destinatario</div>
              ${clientEl('13px', '10px')}
            </div>
            <div style="text-align:right;flex-shrink:0;">
              <div style="${LABEL}">Data emissione</div>
              <div style="font-size:13px;font-weight:700;color:#111;">${docDate}</div>
              ${expiresDate
                ? `<div style="font-size:10px;color:#888;margin-top:2px;">Valido ${expiresDate}</div>`
                : `<div style="font-size:10px;color:#888;margin-top:2px;">Valido 30 giorni</div>`}
            </div>
          </div>

          ${doc.title ? `<div style="font-size:14px;font-weight:600;color:#111;margin-bottom:12px;">${esc(doc.title)}</div>` : ''}
          ${doc.notes ? `<div style="font-size:10px;color:#666;margin-bottom:14px;line-height:1.5;">${nl2br(doc.notes)}</div>` : ''}

          <!-- Tabella voci: 4 colonne, header scuro -->
          <table style="margin-bottom:20px;">
            <thead>
              <tr style="background:${color};">
                <th style="padding:8px 10px;text-align:left;font-size:9.5px;font-weight:700;color:${onColor};text-transform:uppercase;letter-spacing:0.07em;">Descrizione</th>
                <th style="padding:8px 8px;text-align:right;font-size:9.5px;font-weight:700;color:${onColor};text-transform:uppercase;letter-spacing:0.07em;width:52px;">Q.tà</th>
                <th style="padding:8px 8px;text-align:right;font-size:9.5px;font-weight:700;color:${onColor};text-transform:uppercase;letter-spacing:0.07em;width:90px;">Prezzo unit.</th>
                <th style="padding:8px 10px;text-align:right;font-size:9.5px;font-weight:700;color:${onColor};text-transform:uppercase;letter-spacing:0.07em;width:80px;">Totale</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>

          <!-- Riepilogo: allineato a destra -->
          <div style="display:flex;justify-content:flex-end;">
            <div style="min-width:230px;">
              <table style="width:100%;">
                <tbody>
                  <tr>
                    <td style="padding:3px 0;font-size:10px;color:#888;">Subtotale</td>
                    <td style="padding:3px 0;font-size:10px;color:#888;text-align:right;">${fmt(subtotal)} €</td>
                  </tr>
                  ${hasDiscount ? `
                  <tr>
                    <td style="padding:3px 0;font-size:10px;color:#888;">Sconto</td>
                    <td style="padding:3px 0;font-size:10px;color:#16a34a;text-align:right;">−${fmt(Math.abs(discount))} €</td>
                  </tr>` : ''}
                  ${vatRowsEl('3px 0', '10px')}
                  ${bolloAmount > 0 ? `
                  <tr>
                    <td style="padding:3px 0;font-size:10px;color:#888;">Marca da bollo</td>
                    <td style="padding:3px 0;font-size:10px;color:#888;text-align:right;">${fmt(bolloAmount)} €</td>
                  </tr>` : ''}
                </tbody>
              </table>
              <div style="border-top:1px solid #ccc;margin-top:8px;padding-top:9px;display:flex;justify-content:space-between;align-items:baseline;">
                <span style="font-size:14px;font-weight:800;color:#111;">TOTALE</span>
                <span style="font-size:14px;font-weight:800;color:#111;">${fmt(total)} €</span>
              </div>
            </div>
          </div>

          ${legalHtml}
        </div>

        <!-- FOOTER -->
        <div style="position:absolute;bottom:0;left:0;right:0;border-top:1px solid #e8e8e8;padding:8px 32px;display:flex;justify-content:space-between;align-items:center;z-index:1;">
          ${brandingSpan('#bbb')}
          <span style="font-size:8px;color:#bbb;">${expiresDate ? `Preventivo valido fino al ${expiresDate}` : ''}</span>
        </div>
      `)
    }

    // ──────────────────────────────────────────────────────────────────
    // BOLD — header dark full-width, contact strip, badge pillola, totale box
    // ──────────────────────────────────────────────────────────────────
    case 'bold': {
      const LABEL = 'font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.09em;color:#999;margin-bottom:4px;'

      const rows = items.map(item => `
        <tr style="border-bottom:1px solid #f0f0f0;">
          <td style="padding:8px 10px;font-size:11px;color:#111;font-weight:500;">${esc(item.description)}</td>
          <td style="padding:8px 8px;font-size:11px;text-align:right;color:#888;">${Number(item.quantity).toLocaleString('it-IT', { maximumFractionDigits: 3 })}</td>
          <td style="padding:8px 8px;font-size:11px;text-align:right;color:#888;">${fmt(Number(item.unit_price))} €</td>
          <td style="padding:8px 10px;font-size:11px;text-align:right;font-weight:700;">${fmt(Number(item.total))} €</td>
        </tr>`).join('')

      const contactParts = [
        wsPiva,
        wsAddrCompact,
        `Emesso: ${docDateShort}`,
        expiresDateShort ? `Valido fino al: ${expiresDateShort}` : '',
      ].filter(Boolean).join('  ·  ')

      return wrap(font, `
        ${wmHtml}
        ${statusWmHtml}

        <!-- HEADER: dark full-width band -->
        <div style="background:${color};padding:22px 28px 18px;display:flex;align-items:center;justify-content:space-between;position:relative;z-index:1;">
          ${isLogoRight
            ? `<!-- Badge pillola doc number (sx quando logo è dx) -->
               <div style="background:${onColor};color:${color};padding:9px 18px;border-radius:6px;font-size:12px;font-weight:800;letter-spacing:0.04em;white-space:nowrap;flex-shrink:0;">
                ${docTypeLabel} ${doc.doc_number ? `#${esc(doc.doc_number)}` : ''}
               </div>
               <div style="display:flex;align-items:center;gap:14px;flex-direction:row-reverse;">
                ${logoEl(52, rgba(onColor, 0.18), onColor)}
                <div style="text-align:right;">
                  <div style="font-size:18px;font-weight:800;color:${onColor};line-height:1.1;letter-spacing:0.01em;">${wsName}</div>
                  <div style="font-size:9.5px;color:${onColor};opacity:0.65;margin-top:3px;">${[wsAddr, wsPiva].filter(Boolean).join(' · ')}</div>
                </div>
               </div>`
            : `<div style="display:flex;align-items:center;gap:14px;">
                ${logoEl(52, rgba(onColor, 0.18), onColor)}
                <div>
                  <div style="font-size:18px;font-weight:800;color:${onColor};line-height:1.1;letter-spacing:0.01em;">${wsName}</div>
                  <div style="font-size:9.5px;color:${onColor};opacity:0.65;margin-top:3px;">${[wsAddr, wsPiva].filter(Boolean).join(' · ')}</div>
                </div>
               </div>
               <!-- Badge pillola doc number -->
               <div style="background:${onColor};color:${color};padding:9px 18px;border-radius:6px;font-size:12px;font-weight:800;letter-spacing:0.04em;white-space:nowrap;flex-shrink:0;">
                ${docTypeLabel} ${doc.doc_number ? `#${esc(doc.doc_number)}` : ''}
               </div>`
          }
        </div>

        <!-- CONTACT STRIP -->
        <div style="background:${rgba(color, 0.92)};border-top:1px solid ${rgba(onColor, 0.10)};padding:7px 28px;position:relative;z-index:1;">
          <span style="font-size:9px;color:${onColor};opacity:0.68;">${contactParts}</span>
        </div>

        <!-- BODY -->
        <div style="padding:22px 28px;position:relative;z-index:1;">

          <!-- Info row in box grigio -->
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:24px;margin-bottom:20px;padding:14px 18px;background:#f7f8fa;border-radius:6px;">
            <div>
              <div style="${LABEL}">Destinatario</div>
              ${clientEl('13px', '10px')}
            </div>
            <div style="text-align:right;flex-shrink:0;">
              <div style="${LABEL}">Numero preventivo</div>
              <div style="font-size:18px;font-weight:800;color:#111;line-height:1.1;">${doc.doc_number ? `#${esc(doc.doc_number)}` : 'BOZZA'}</div>
              ${client ? `<div style="font-size:9.5px;color:#888;margin-top:3px;">${client.piva ? `P.IVA ${esc(client.piva)}` : ''}</div>` : ''}
            </div>
          </div>

          ${doc.title ? `<div style="font-size:14px;font-weight:700;color:#111;margin-bottom:12px;">${esc(doc.title)}</div>` : ''}
          ${doc.notes ? `<div style="font-size:10px;color:#666;margin-bottom:14px;line-height:1.5;">${nl2br(doc.notes)}</div>` : ''}

          <!-- Tabella voci: header riempito leggero -->
          <table style="margin-bottom:16px;">
            <thead>
              <tr style="background:${rgba(color, 0.09)};">
                <th style="padding:9px 10px;text-align:left;font-size:9.5px;font-weight:800;color:${safeAccentColor};text-transform:uppercase;letter-spacing:0.08em;">Descrizione lavori</th>
                <th style="padding:9px 8px;text-align:right;font-size:9.5px;font-weight:800;color:${safeAccentColor};text-transform:uppercase;letter-spacing:0.08em;width:52px;">Q.tà</th>
                <th style="padding:9px 8px;text-align:right;font-size:9.5px;font-weight:800;color:${safeAccentColor};text-transform:uppercase;letter-spacing:0.08em;width:80px;">Prezzo</th>
                <th style="padding:9px 10px;text-align:right;font-size:9.5px;font-weight:800;color:${safeAccentColor};text-transform:uppercase;letter-spacing:0.08em;width:80px;">Totale</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>

          <!-- Sub-totali -->
          <div style="display:flex;justify-content:flex-end;margin-bottom:14px;">
            <div style="min-width:210px;">
              <table style="width:100%;">
                <tbody>
                  <tr>
                    <td style="padding:3px 0;font-size:10px;color:#999;">Subtotale</td>
                    <td style="padding:3px 0;font-size:10px;color:#999;text-align:right;">${fmt(subtotal)} €</td>
                  </tr>
                  ${hasDiscount ? `
                  <tr>
                    <td style="padding:3px 0;font-size:10px;color:#999;">Sconto</td>
                    <td style="padding:3px 0;font-size:10px;color:#16a34a;text-align:right;">−${fmt(Math.abs(discount))} €</td>
                  </tr>` : ''}
                  ${vatRowsEl('3px 0', '10px', '#999')}
                  ${bolloAmount > 0 ? `
                  <tr>
                    <td style="padding:3px 0;font-size:10px;color:#999;">Marca da bollo</td>
                    <td style="padding:3px 0;font-size:10px;color:#999;text-align:right;">${fmt(bolloAmount)} €</td>
                  </tr>` : ''}
                </tbody>
              </table>
            </div>
          </div>

          <!-- TOTALE DA PAGARE: box scuro a destra -->
          <div style="display:flex;justify-content:flex-end;">
            <div style="background:${color};color:${onColor};padding:16px 28px;border-radius:8px;text-align:center;min-width:190px;">
              <div style="font-size:8.5px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;opacity:0.68;margin-bottom:5px;">Totale da pagare</div>
              <div style="font-size:24px;font-weight:800;letter-spacing:0.01em;line-height:1;">${fmt(total)} €</div>
            </div>
          </div>

          ${legalHtml}
        </div>

        <!-- FOOTER -->
        <div style="position:absolute;bottom:0;left:0;right:0;border-top:1px solid #e8e8e8;padding:8px 28px;display:flex;justify-content:space-between;align-items:center;z-index:1;">
          ${brandingSpan('#bbb')}
          <span style="font-size:8px;color:#bbb;">${expiresDate ? `Valido fino al ${expiresDate}` : ''}</span>
        </div>
      `)
    }

    // ──────────────────────────────────────────────────────────────────
    // TECNICO — uppercase company, bordo spesso, strip 4 celle, col COD
    // ──────────────────────────────────────────────────────────────────
    case 'tecnico': {
      const MONO  = "'Courier New', 'Lucida Console', monospace"
      const LABEL = 'font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.09em;color:#999;margin-bottom:3px;'

      const rows = items.map((item, idx) => {
        const code = String(idx + 1).padStart(2, '0')
        return `
          <tr style="border-bottom:1px solid #ebebeb;">
            <td style="padding:7px 8px;font-size:9.5px;color:#aaa;font-family:${MONO};vertical-align:top;white-space:nowrap;">${code}</td>
            <td style="padding:7px 8px;font-size:11px;vertical-align:top;line-height:1.4;">
              ${esc(item.description)}<br>
              <span style="font-size:11px;font-weight:700;color:#111;font-family:${MONO};">${fmt(Number(item.total))} €</span>
            </td>
            <td style="padding:7px 8px;font-size:10px;text-align:center;color:#888;vertical-align:top;">${esc(item.unit ?? 'cad')}</td>
            <td style="padding:7px 8px;font-size:10px;text-align:right;color:#888;font-family:${MONO};vertical-align:top;">${Number(item.quantity).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            <td style="padding:7px 8px;font-size:10px;text-align:right;color:#888;font-family:${MONO};vertical-align:top;">${fmt(Number(item.unit_price))}</td>
            <td style="padding:7px 8px;font-size:10px;text-align:right;vertical-align:top;width:50px;"></td>
          </tr>`
      }).join('')

      const clientShort = client
        ? esc((client.name ?? '').split(' ').slice(0, 3).join(' '))
        : '—'

      const imponibile = isForf ? total : afterDisc

      return wrap(font, `
        ${wmHtml}
        ${statusWmHtml}

        <!-- HEADER: bianco, uppercase company, bordo spesso -->
        <div style="padding:18px 28px 14px;display:flex;align-items:flex-start;justify-content:space-between;border-bottom:3px solid ${color};position:relative;z-index:1;">
          ${isLogoRight
            ? `<div style="text-align:left;flex-shrink:0;">
                <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.09em;color:#888;margin-bottom:4px;">Preventivo</div>
                <div style="font-size:28px;font-weight:800;color:${safeAccentColor};letter-spacing:0.01em;line-height:1;">#${doc.doc_number ? esc(doc.doc_number) : 'BOZZA'}</div>
               </div>
               <div style="display:flex;align-items:center;gap:12px;flex-direction:row-reverse;">
                ${logoEl(40, rgba(color, 0.11), color)}
                <div style="text-align:right;">
                  <div style="font-size:14px;font-weight:800;letter-spacing:0.04em;color:#111;text-transform:uppercase;line-height:1.2;">${wsName}</div>
                  <div style="font-size:9px;color:#888;letter-spacing:0.02em;margin-top:3px;">${[wsAddr, wsPiva].filter(Boolean).join(' · ')}</div>
                </div>
               </div>`
            : `<div style="display:flex;align-items:center;gap:12px;">
                ${logoEl(40, rgba(color, 0.11), color)}
                <div>
                  <div style="font-size:14px;font-weight:800;letter-spacing:0.04em;color:#111;text-transform:uppercase;line-height:1.2;">${wsName}</div>
                  <div style="font-size:9px;color:#888;letter-spacing:0.02em;margin-top:3px;">${[wsAddr, wsPiva].filter(Boolean).join(' · ')}</div>
                </div>
               </div>
               <div style="text-align:right;flex-shrink:0;">
                <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.09em;color:#888;margin-bottom:4px;">Preventivo</div>
                <div style="font-size:28px;font-weight:800;color:${safeAccentColor};letter-spacing:0.01em;line-height:1;">#${doc.doc_number ? esc(doc.doc_number) : 'BOZZA'}</div>
               </div>`
          }
        </div>

        <!-- 4-CELL INFO STRIP -->
        <div style="display:grid;grid-template-columns:repeat(4,1fr);border-bottom:1px solid #e0e0e0;background:#f8f9fb;position:relative;z-index:1;">
          <div style="padding:8px 14px;border-right:1px solid #e0e0e0;">
            <div style="${LABEL}">Data</div>
            <div style="font-size:11px;font-weight:600;color:#111;">${docDateShort}</div>
          </div>
          <div style="padding:8px 14px;border-right:1px solid #e0e0e0;">
            <div style="${LABEL}">Scadenza</div>
            <div style="font-size:11px;font-weight:600;color:#111;">${expiresDateShort ?? '—'}</div>
          </div>
          <div style="padding:8px 14px;border-right:1px solid #e0e0e0;">
            <div style="${LABEL}">Destinatario</div>
            <div style="font-size:11px;font-weight:600;color:#111;">${clientShort}</div>
          </div>
          <div style="padding:8px 14px;">
            <div style="${LABEL}">Totale IVA incl.</div>
            <div style="font-size:11px;font-weight:700;color:${safeAccentColor};">${fmt(total)} €</div>
          </div>
        </div>

        <!-- BODY -->
        <div style="padding:18px 28px;position:relative;z-index:1;">

          ${doc.title ? `<div style="font-size:13px;font-weight:700;color:#111;margin-bottom:12px;">${esc(doc.title)}</div>` : ''}
          ${doc.notes ? `<div style="font-size:10px;color:#666;margin-bottom:14px;line-height:1.5;">${nl2br(doc.notes)}</div>` : ''}

          <!-- Tabella: colonna COD, totale nella desc -->
          <table style="margin-bottom:0;">
            <thead>
              <tr style="background:${color};">
                <th style="padding:7px 8px;text-align:left;font-size:9px;font-weight:700;color:${onColor};text-transform:uppercase;letter-spacing:0.07em;width:36px;">Cod</th>
                <th style="padding:7px 8px;text-align:left;font-size:9px;font-weight:700;color:${onColor};text-transform:uppercase;letter-spacing:0.07em;">Descrizione</th>
                <th style="padding:7px 8px;text-align:center;font-size:9px;font-weight:700;color:${onColor};text-transform:uppercase;letter-spacing:0.07em;width:40px;">U.M.</th>
                <th style="padding:7px 8px;text-align:right;font-size:9px;font-weight:700;color:${onColor};text-transform:uppercase;letter-spacing:0.07em;width:56px;">Q.tà</th>
                <th style="padding:7px 8px;text-align:right;font-size:9px;font-weight:700;color:${onColor};text-transform:uppercase;letter-spacing:0.07em;width:76px;">Prezzo unit.</th>
                <th style="padding:7px 8px;text-align:right;font-size:9px;font-weight:700;color:${onColor};text-transform:uppercase;letter-spacing:0.07em;width:50px;">Totale</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>

          <!-- Totali: etichette a sinistra, valori a destra -->
          <div style="border-top:2px solid #e0e0e0;padding-top:14px;margin-top:14px;">
            <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px;">
              <span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#666;">Imponibile</span>
              <span style="font-size:11px;color:#666;">${fmt(imponibile)} €</span>
            </div>
            ${!isForf ? Object.entries(vatGroups).map(([rate, amt]) => `
            <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px;">
              <span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#666;">IVA ${rate}%</span>
              <span style="font-size:11px;color:#666;">${fmt(amt)} €</span>
            </div>`).join('') : ''}
            ${bolloAmount > 0 ? `
            <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px;">
              <span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#666;">Marca da bollo</span>
              <span style="font-size:11px;color:#666;">${fmt(bolloAmount)} €</span>
            </div>` : ''}
            <div style="border-top:2px solid ${color};margin-top:8px;padding-top:10px;display:flex;justify-content:space-between;align-items:baseline;">
              <span style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:0.05em;color:#111;">Totale preventivo</span>
              <span style="font-size:14px;font-weight:800;color:#111;">${fmt(total)} €</span>
            </div>
          </div>

          ${legalHtml}
        </div>

        <!-- FOOTER: stile tecnico -->
        <div style="position:absolute;bottom:0;left:0;right:0;border-top:1px solid #e5e5e5;padding:7px 28px;display:flex;justify-content:space-between;align-items:center;z-index:1;">
          ${showWm ? `<span style="font-size:8px;color:#bbb;font-family:${MONO};">Generato con Carta Canta · cartacanta.app</span>` : '<span></span>'}
          <span style="font-size:8px;color:#bbb;font-family:${MONO};">Doc. ${doc.doc_number ? `#${esc(doc.doc_number)}` : ''} · ${docDateShort}</span>
        </div>
      `)
    }

    // ──────────────────────────────────────────────────────────────────
    // ELEGANTE — serif, header bianco, logo bordato, no fill tabella
    // ──────────────────────────────────────────────────────────────────
    case 'elegante': {
      const LABEL = 'font-size:8px;font-weight:600;text-transform:uppercase;letter-spacing:0.13em;color:#aaa;margin-bottom:5px;'

      const rows = items.map(item => `
        <tr style="border-bottom:1px solid #e8e8e8;">
          <td style="padding:8px 0;font-size:11px;color:#333;">${esc(item.description)}</td>
          <td style="padding:8px 10px;font-size:11px;text-align:right;color:#aaa;">${Number(item.quantity).toLocaleString('it-IT', { maximumFractionDigits: 3 })}</td>
          <td style="padding:8px 10px;font-size:11px;text-align:right;color:#aaa;">${fmt(Number(item.unit_price))} €</td>
          <td style="padding:8px 0;font-size:11px;text-align:right;color:#555;">${fmt(Number(item.total))} €</td>
        </tr>`).join('')

      const cityUpper = wsCitta ? wsCitta.toUpperCase() : ''

      return wrap(font, `
        ${wmHtml}
        ${statusWmHtml}

        <!-- HEADER: bianco, serif, logo bordato -->
        <div style="padding:32px 36px 26px;display:flex;align-items:flex-start;justify-content:space-between;position:relative;z-index:1;">
          ${isLogoRight
            ? `<div style="text-align:left;flex-shrink:0;padding-top:4px;">
                <div style="font-size:10px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:#bbb;margin-bottom:7px;">Preventivo</div>
                <div style="font-size:30px;font-weight:700;color:#1a1a2e;font-style:italic;line-height:1;">${doc.doc_number ? `#${esc(doc.doc_number)}` : 'Bozza'}</div>
               </div>
               <div style="display:flex;align-items:flex-start;gap:16px;flex-direction:row-reverse;">
                ${logoEl(56, '#f5f5f5', '#c0c0c0', true)}
                <div style="padding-top:4px;text-align:right;">
                  <div style="font-size:18px;font-weight:700;color:#111;letter-spacing:0.01em;line-height:1.15;">${wsName}</div>
                  ${cityUpper ? `<div style="font-size:8.5px;letter-spacing:0.20em;color:#bbb;margin-top:5px;text-transform:uppercase;">${cityUpper}</div>` : ''}
                </div>
               </div>`
            : `<div style="display:flex;align-items:flex-start;gap:16px;">
                ${logoEl(56, '#f5f5f5', '#c0c0c0', true)}
                <div style="padding-top:4px;">
                  <div style="font-size:18px;font-weight:700;color:#111;letter-spacing:0.01em;line-height:1.15;">${wsName}</div>
                  ${cityUpper ? `<div style="font-size:8.5px;letter-spacing:0.20em;color:#bbb;margin-top:5px;text-transform:uppercase;">${cityUpper}</div>` : ''}
                </div>
               </div>
               <div style="text-align:right;flex-shrink:0;padding-top:4px;">
                <div style="font-size:10px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:#bbb;margin-bottom:7px;">Preventivo</div>
                <div style="font-size:30px;font-weight:700;color:#1a1a2e;font-style:italic;line-height:1;">${doc.doc_number ? `#${esc(doc.doc_number)}` : 'Bozza'}</div>
               </div>`
          }
        </div>

        <!-- SEPARATORE con accento brand -->
        <div style="border-bottom:1px solid ${color};margin:0 36px;"></div>

        <!-- BODY -->
        <div style="padding:26px 36px;position:relative;z-index:1;">

          <!-- Destinatario + data -->
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:24px;margin-bottom:26px;">
            <div>
              <div style="${LABEL}">Destinatario</div>
              ${clientEl('13px', '10px')}
            </div>
            <div style="text-align:right;flex-shrink:0;">
              <div style="${LABEL}">Data</div>
              <div style="font-size:13px;color:#333;margin-bottom:3px;">${docDate}</div>
              ${expiresDate
                ? `<div style="font-size:10px;color:#bbb;">Valido 30 giorni dalla data</div>`
                : `<div style="font-size:10px;color:#bbb;">Valido 30 giorni</div>`}
            </div>
          </div>

          ${doc.title ? `<div style="font-size:14px;font-weight:600;color:#111;font-style:italic;margin-bottom:14px;">${esc(doc.title)}</div>` : ''}
          ${doc.notes ? `<div style="font-size:10px;color:#888;margin-bottom:16px;line-height:1.6;">${nl2br(doc.notes)}</div>` : ''}

          <!-- Tabella: no fill header, solo linee -->
          <table style="margin-bottom:20px;">
            <thead>
              <tr style="border-bottom:1px solid #c8c8c8;">
                <th style="padding:6px 0;text-align:left;font-size:8.5px;font-weight:600;color:#bbb;text-transform:uppercase;letter-spacing:0.13em;">Descrizione</th>
                <th style="padding:6px 10px;text-align:right;font-size:8.5px;font-weight:600;color:#bbb;text-transform:uppercase;letter-spacing:0.13em;width:40px;">Q.tà</th>
                <th style="padding:6px 10px;text-align:right;font-size:8.5px;font-weight:600;color:#bbb;text-transform:uppercase;letter-spacing:0.13em;width:80px;">Prezzo</th>
                <th style="padding:6px 0;text-align:right;font-size:8.5px;font-weight:600;color:#bbb;text-transform:uppercase;letter-spacing:0.13em;width:80px;">Totale</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>

          <!-- Riepilogo: allineato a destra, serif -->
          <div style="display:flex;justify-content:flex-end;">
            <div style="min-width:220px;">
              <table style="width:100%;">
                <tbody>
                  <tr>
                    <td style="padding:4px 0;font-size:10px;color:#bbb;">Subtotale</td>
                    <td style="padding:4px 0;font-size:10px;color:#bbb;text-align:right;">${fmt(subtotal)} €</td>
                  </tr>
                  ${hasDiscount ? `
                  <tr>
                    <td style="padding:4px 0;font-size:10px;color:#bbb;">Sconto</td>
                    <td style="padding:4px 0;font-size:10px;color:#16a34a;text-align:right;">−${fmt(Math.abs(discount))} €</td>
                  </tr>` : ''}
                  ${vatRowsEl('4px 0', '10px', '#bbb')}
                  ${bolloAmount > 0 ? `
                  <tr>
                    <td style="padding:4px 0;font-size:10px;color:#bbb;">Marca da bollo</td>
                    <td style="padding:4px 0;font-size:10px;color:#bbb;text-align:right;">${fmt(bolloAmount)} €</td>
                  </tr>` : ''}
                </tbody>
              </table>
              <div style="border-top:1px solid #c8c8c8;margin-top:10px;padding-top:10px;display:flex;justify-content:space-between;align-items:baseline;">
                <span style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.10em;color:#444;">Totale</span>
                <span style="font-size:20px;font-weight:700;font-style:italic;color:#111;">${fmt(total)} €</span>
              </div>
            </div>
          </div>

          ${legalHtml}
        </div>

        <!-- FOOTER -->
        <div style="position:absolute;bottom:0;left:0;right:0;border-top:1px solid #e5e5e5;padding:9px 36px;display:flex;justify-content:space-between;align-items:center;z-index:1;">
          ${brandingSpan('#ccc')}
          <span style="font-size:8px;color:#ccc;">${expiresDate ? `Valido fino al ${expiresDate}` : ''}</span>
        </div>
      `)
    }
  }
}
