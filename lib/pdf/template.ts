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
  /** Canali di incasso (Pagamenti F1, migration 038) — sezione "Come pagare"
   *  in fondo al documento. Mostrata per le fatture e per i preventivi accettati. */
  payment?: {
    iban: string | null
    ibanHolder: string | null
    paypalUrl: string | null
    satispayUrl: string | null
    notes: string | null
  } | null
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

// 17 lug (richiesta Eli: "i font sono troppo simili, modificali"): le chiavi
// restano quelle storiche del DB/snapshot; cambiano SOLO gli stack —
// 'Helvetica' → Verdana, 'GeistSans' → monospazio. Allineati a
// TemplatePreview e all'editor. Layout dei 4 preset INVARIATO.
const FONT_STACKS: Record<string, string> = {
  Inter:     "'Inter', 'Segoe UI', Arial, sans-serif",
  GeistSans: "'Courier New', Courier, monospace",
  Helvetica: 'Verdana, Geneva, Tahoma, sans-serif',
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

// ── Google Fonts loader ───────────────────────────────────────────────────────
// Carica il font corretto dal CDN — garantisce coerenza su tutti i dispositivi
// (mobile, desktop, iframe) indipendentemente dai font installati nel sistema.

const GOOGLE_FONTS_URL: Record<string, string> = {
  Inter:     'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap',
  GeistSans: 'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800&display=swap',
  // Helvetica e Georgia sono font di sistema universali — non richiedono import
}

function googleFontsTag(fontName: string): string {
  const url = GOOGLE_FONTS_URL[fontName]
  if (!url) return ''
  return `  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="">
  <link href="${url}" rel="stylesheet">`
}

// ── HTML wrapper ──────────────────────────────────────────────────────────────

function wrap(font: string, body: string, fontName?: string, pageTitle?: string): string {
  const titleTag = pageTitle ? `  <title>${pageTitle}</title>\n` : ''
  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=794" />
${titleTag}${googleFontsTag(fontName ?? '')}
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      font-family: ${font};
      font-size: 14px;
      line-height: 1.5;
      color: #111;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    @page { size: A4; margin: 0; }
    table { border-collapse: collapse; width: 100%; }
    /* background: #fff esplicito — senza, la pagina resta trasparente e
       prende il grigio (#e5e7eb) del body iniettato da preparePrintHtml
       per la cornice viewer → documento con sfondo grigio diffuso,
       diverso dalla preview in-app (bianca). Il foglio deve essere bianco. */
    .page { width: 210mm; min-height: 297mm; position: relative; overflow: hidden; background: #fff; }
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
  const { document: doc, workspace, client, template, logoBase64, payment } = data

  const color        = template?.color_primary ?? '#374151'
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

  const isFattura       = doc.doc_type === 'fattura'
  const docTypeLabel    = isFattura ? 'FATTURA' : 'PREVENTIVO'

  // FIX-8: alcuni documenti legacy hanno ancora il prefisso "Prev"/"Fatt" salvato nel DB
  // (es. "Prev009/2026"). Il documento mostrato al cliente (e il PDF) non deve mai
  // mostrare il prefisso grezzo — strippiamo qui una volta per tutte le occorrenze.
  const docNumberClean = doc.doc_number ? doc.doc_number.replace(/^[A-Za-z]+/, '') : null

  // Titolo pagina → nome file quando l'utente salva come PDF dal dialogo stampa
  const docTypeTitleCase = isFattura ? 'Fattura' : 'Preventivo'
  const pageTitle = docNumberClean
    ? `${docTypeTitleCase} ${docNumberClean} - Carta Canta`
    : `${docTypeTitleCase} - Carta Canta`

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

  // Date — SEMPRE in ora italiana: il PDF viene generato sul server (UTC),
  // senza timeZone un documento creato dopo le 22/23 porterebbe la data
  // del giorno prima (solo formattazione: nessun impatto sul layout).
  const TZ = { timeZone: 'Europe/Rome' } as const
  const docDate = doc.created_at
    ? new Date(doc.created_at).toLocaleDateString('it-IT', {
        day: '2-digit', month: 'long', year: 'numeric', ...TZ,
      })
    : '—'
  const docDateShort = doc.created_at
    ? new Date(doc.created_at).toLocaleDateString('it-IT', {
        day: '2-digit', month: '2-digit', year: 'numeric', ...TZ,
      })
    : '—'
  const expiresDate = doc.expires_at
    ? new Date(doc.expires_at).toLocaleDateString('it-IT', {
        day: '2-digit', month: 'long', year: 'numeric', ...TZ,
      })
    : null
  const expiresDateShort = doc.expires_at
    ? new Date(doc.expires_at).toLocaleDateString('it-IT', {
        day: '2-digit', month: '2-digit', year: 'numeric', ...TZ,
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
  function clientEl(nameSize = '15px', addrSize = '12px'): string {
    if (!client) return '<div style="font-size:19px;color:#999;font-style:italic;">Nessun cliente</div>'
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

  // ── Watermark branding ─────────────────────────────────────
  // L1: rimosso il watermark diagonale "Carta Canta" per tutti i piani.
  // Il branding è ora solo nel footer (brandingSpan), più discreto e professionale.
  const wmHtml = ''  // eslint-disable-line @typescript-eslint/no-unused-vars

  // ── Watermark stato documento ──────────────────────────────
  // Tutte le bozze mostrano "NON ANCORA INVIATO" in diagonale.
  // La filigrana è grande, diagonale, ben visibile anche in stampa.
  let statusWatermarkText: string | null = null
  let statusWatermarkColor = 'rgba(180,80,0,0.18)'
  if (doc.status === 'draft') {
    statusWatermarkText = 'NON ANCORA INVIATO'
  }
  // Per BOZZA: griglia 3×4 tiles ruotata per copertura totale della pagina.
  // Per NON ANCORA INVIATO: timbro singolo centrato (testo lungo, una sola riga).
  const statusWmHtml = statusWatermarkText === 'BOZZA' ? (() => {
    const tile = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;width:200px;height:160px;font-family:Helvetica,'Arial Black',sans-serif;font-weight:900;color:${statusWatermarkColor};text-transform:uppercase;">
      <span style="font-size:34px;letter-spacing:0.08em;line-height:1;">BOZZA</span>
      <span style="font-size:19px;letter-spacing:0.18em;line-height:1;">Carta Canta</span>
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
  // Allineato a TemplatePreview: bordo #f0f0f0 e testo #ccc, line-height 1.5
  const legalHtml = legalNotice ? `
    <div style="margin-top:20px;border-top:1px solid #f0f0f0;padding-top:10px;">
      <p style="font-size:17px;color:#ccc;line-height:1.5;">${escHtml(legalNotice)}</p>
    </div>` : ''

  // ── Acconto (migration 038) ────────────────────────────────
  // Preventivo con acconto richiesto: box ambra sotto il totale
  // ("Acconto alla conferma — Saldo a fine lavori").
  // Fattura con acconto già incassato (payment_status 'partial'):
  // "Acconto già ricevuto −€X — Saldo da pagare €Y".
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 038 non ancora in types/database.ts
  const docExtra = doc as any
  const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
  const depositInfo = (() => {
    if (isFattura) {
      if (docExtra.payment_status === 'partial' && Number(docExtra.paid_amount) > 0 && total > 0) {
        const acconto = round2(Number(docExtra.paid_amount))
        return { kind: 'received' as const, acconto, saldo: round2(total - acconto), label: 'Acconto già ricevuto' }
      }
      return null
    }
    const t = docExtra.deposit_type
    const v = Number(docExtra.deposit_value)
    if ((t !== 'percent' && t !== 'amount') || !Number.isFinite(v) || v <= 0 || total <= 0) return null
    const acconto = t === 'percent' ? round2((total * Math.min(v, 100)) / 100) : round2(Math.min(v, total))
    if (acconto <= 0) return null
    const label = t === 'percent'
      ? `Acconto alla conferma (${v.toLocaleString('it-IT', { maximumFractionDigits: 2 })}%)`
      : 'Acconto alla conferma'
    return { kind: 'requested' as const, acconto, saldo: round2(total - acconto), label }
  })()
  const depositHtml = depositInfo ? `
    <div style="display:flex;justify-content:flex-end;margin-top:12px;">
      <div style="min-width:300px;background:#f5e9d0;border-radius:10px;padding:10px 14px;">
        <div style="display:flex;justify-content:space-between;gap:18px;font-size:16px;font-weight:700;color:#2b2b2b;">
          <span>${esc(depositInfo.label)}</span>
          <span>${depositInfo.kind === 'received' ? '−' : ''}${fmt(depositInfo.acconto)} €</span>
        </div>
        <div style="display:flex;justify-content:space-between;gap:18px;font-size:15px;color:#8a6f35;margin-top:3px;">
          <span>${depositInfo.kind === 'requested' ? 'Saldo a fine lavori' : 'Saldo da pagare'}</span>
          <span>${fmt(depositInfo.saldo)} €</span>
        </div>
      </div>
    </div>` : ''

  // ── Come pagare (Pagamenti F1) ─────────────────────────────
  // Sezione neutra in fondo al documento, identica per i 4 preset.
  // Fatture: sempre (se c'è almeno un canale). Preventivi: solo se accettati
  // (per l'incasso dell'acconto) — decisione Eli 5 lug 2026.
  const showPaymentSection =
    !!payment &&
    !!(payment.iban || payment.paypalUrl || payment.satispayUrl || payment.notes) &&
    (isFattura || doc.status === 'accepted')
  const paymentCausale = `${isFattura ? 'Fattura' : 'Preventivo'}${docNumberClean ? ` ${docNumberClean}` : ''}`
  const paymentHtml = showPaymentSection ? `
    <div style="margin-top:20px;border-top:1px solid #f0f0f0;padding-top:10px;">
      <div style="font-size:15px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#999;margin-bottom:5px;">Come pagare</div>
      ${payment!.iban ? `<p style="font-size:16px;color:#555;line-height:1.6;margin:0;">Bonifico bancario — IBAN <strong style="color:#333;">${esc(payment!.iban.replace(/(.{4})/g, '$1 ').trim())}</strong>${payment!.ibanHolder ? ` · Intestato a ${esc(payment!.ibanHolder)}` : ''} · Causale: ${esc(paymentCausale)}</p>` : ''}
      ${payment!.paypalUrl ? `<p style="font-size:16px;color:#555;line-height:1.6;margin:0;">PayPal — ${esc(payment!.paypalUrl.replace(/^https?:\/\//, ''))}</p>` : ''}
      ${payment!.satispayUrl ? `<p style="font-size:16px;color:#555;line-height:1.6;margin:0;">Satispay — ${esc(payment!.satispayUrl.replace(/^https?:\/\//, ''))}</p>` : ''}
      ${payment!.notes ? `<p style="font-size:16px;color:#777;line-height:1.6;margin:2px 0 0;">${esc(payment!.notes)}</p>` : ''}
    </div>` : ''

  // ── Branding footer (nascosto per Pro con show_watermark = false) ──────────
  // showWm = true → mostra "Generato con Carta Canta" (default Free, obbligatorio)
  // showWm = false → Pro ha rimosso il branding
  const brandingSpan = (color: string) =>
    showWm ? `<span style="font-size:17px;color:${color};">${isFattura ? 'Fattura generata' : 'Preventivo generato'} con Carta Canta · cartacanta.app</span>` : '<span></span>'

  // ══════════════════════════════════════════════════════════════════════
  // DISPATCH PER PRESET
  // ══════════════════════════════════════════════════════════════════════

  switch (presetKey) {

    // ──────────────────────────────────────────────────────────────────
    // CLASSICO — Inter, header bianco, table header scuro, pulito
    // ──────────────────────────────────────────────────────────────────
    case 'classico':
    default: {
      const LABEL = 'font-size:17px;font-weight:700;text-transform:uppercase;letter-spacing:0.09em;color:#999;margin-bottom:4px;'

      const rows = items.map(item => `
        <tr style="border-bottom:1px solid #f2f2f2;">
          <td style="padding:7px 10px;font-size:19px;color:#111;">${esc(item.description)}</td>
          <td style="padding:7px 8px;font-size:19px;text-align:right;color:#888;">${Number(item.quantity).toLocaleString('it-IT', { maximumFractionDigits: 3 })}</td>
          <td style="padding:7px 8px;font-size:19px;text-align:right;color:#888;">${fmt(Number(item.unit_price))} €</td>
          <td style="padding:7px 10px;font-size:19px;text-align:right;font-weight:700;">${fmt(Number(item.total))} €</td>
        </tr>`).join('')

      return wrap(font, `
        ${wmHtml}
        ${statusWmHtml}

        <!-- HEADER: bianco, split orizzontale -->
        <div style="padding:28px 32px 22px;display:flex;align-items:flex-start;justify-content:space-between;border-bottom:1px solid #e0e0e0;position:relative;z-index:1;">
          ${isLogoRight
            ? `<div style="text-align:left;flex-shrink:0;">
                <div style="font-size:24px;font-weight:800;letter-spacing:0.02em;color:#111;line-height:1;">${docTypeLabel}</div>
                <div style="font-size:17px;color:#888;margin-top:5px;">${docNumberClean ? `#${esc(docNumberClean)}` : 'BOZZA'}</div>
               </div>
               <div style="display:flex;align-items:center;gap:14px;flex-direction:row-reverse;">
                ${logoEl(44, color, onColor)}
                <div style="text-align:right;">
                  <div style="font-size:19px;font-weight:700;color:#111;line-height:1.2;">${wsName}</div>
                  <div style="font-size:17px;color:#888;margin-top:3px;">${[wsAddr, wsPiva].filter(Boolean).join(' · ')}</div>
                </div>
               </div>`
            : `<div style="display:flex;align-items:center;gap:14px;">
                ${logoEl(44, color, onColor)}
                <div>
                  <div style="font-size:19px;font-weight:700;color:#111;line-height:1.2;">${wsName}</div>
                  <div style="font-size:17px;color:#888;margin-top:3px;">${[wsAddr, wsPiva].filter(Boolean).join(' · ')}</div>
                </div>
               </div>
               <div style="text-align:right;flex-shrink:0;">
                <div style="font-size:24px;font-weight:800;letter-spacing:0.02em;color:#111;line-height:1;">${docTypeLabel}</div>
                <div style="font-size:17px;color:#888;margin-top:5px;">${docNumberClean ? `#${esc(docNumberClean)}` : 'BOZZA'}</div>
               </div>`
          }
        </div>

        <!-- BODY -->
        <div style="padding:22px 32px;position:relative;z-index:1;">

          <!-- Destinatario + data -->
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:24px;margin-bottom:22px;">
            <div>
              <div style="${LABEL}">Destinatario</div>
              ${clientEl('15px', '12px')}
            </div>
            <div style="text-align:right;flex-shrink:0;">
              <div style="${LABEL}">Data emissione</div>
              <div style="font-size:19px;font-weight:700;color:#111;">${docDate}</div>
              ${!isFattura ? (expiresDate
                ? `<div style="font-size:17px;color:#888;margin-top:2px;">Valido ${expiresDate}</div>`
                : `<div style="font-size:17px;color:#888;margin-top:2px;">Valido 30 giorni</div>`) : ''}
            </div>
          </div>

          ${doc.title ? `<div style="font-size:17px;font-weight:600;color:#111;margin-bottom:12px;">${esc(doc.title)}</div>` : ''}
          ${doc.notes ? `<div style="font-size:17px;color:#666;margin-bottom:14px;line-height:1.5;">${nl2br(doc.notes)}</div>` : ''}

          <!-- Tabella voci: 4 colonne, header scuro -->
          <table style="margin-bottom:20px;">
            <thead>
              <tr style="background:${color};">
                <th style="padding:8px 10px;text-align:left;font-size:19px;font-weight:700;color:${onColor};text-transform:uppercase;letter-spacing:0.07em;">Descrizione</th>
                <th style="padding:8px 8px;text-align:right;font-size:19px;font-weight:700;color:${onColor};text-transform:uppercase;letter-spacing:0.07em;width:52px;">Q.tà</th>
                <th style="padding:8px 8px;text-align:right;font-size:19px;font-weight:700;color:${onColor};text-transform:uppercase;letter-spacing:0.07em;width:90px;">Prezzo unit.</th>
                <th style="padding:8px 10px;text-align:right;font-size:19px;font-weight:700;color:${onColor};text-transform:uppercase;letter-spacing:0.07em;width:80px;">Totale</th>
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
                    <td style="padding:3px 0;font-size:17px;color:#888;">Subtotale</td>
                    <td style="padding:3px 0;font-size:17px;color:#888;text-align:right;">${fmt(subtotal)} €</td>
                  </tr>
                  ${hasDiscount ? `
                  <tr>
                    <td style="padding:3px 0;font-size:17px;color:#888;">Sconto</td>
                    <td style="padding:3px 0;font-size:17px;color:#16a34a;text-align:right;">−${fmt(Math.abs(discount))} €</td>
                  </tr>` : ''}
                  ${vatRowsEl('3px 0', '10px')}
                  ${bolloAmount > 0 ? `
                  <tr>
                    <td style="padding:3px 0;font-size:17px;color:#888;">Marca da bollo</td>
                    <td style="padding:3px 0;font-size:17px;color:#888;text-align:right;">${fmt(bolloAmount)} €</td>
                  </tr>` : ''}
                </tbody>
              </table>
              <div style="border-top:1px solid #ccc;margin-top:8px;padding-top:9px;display:flex;justify-content:space-between;align-items:baseline;">
                <span style="font-size:17px;font-weight:800;color:#111;">TOTALE</span>
                <span style="font-size:17px;font-weight:800;color:#111;">${fmt(total)} €</span>
              </div>
            </div>
          </div>

          ${depositHtml}
          ${paymentHtml}
          ${legalHtml}
        </div>

        <!-- FOOTER -->
        <div style="position:absolute;bottom:0;left:0;right:0;border-top:1px solid #ebebeb;padding:8px 32px;display:flex;justify-content:space-between;align-items:center;z-index:1;">
          ${brandingSpan('#bbb')}
          <span style="font-size:17px;color:#bbb;">${!isFattura && expiresDate ? `Preventivo valido fino al ${expiresDate}` : ''}</span>
        </div>
      `, fontName, pageTitle)
    }

    // ──────────────────────────────────────────────────────────────────
    // BOLD — header dark full-width, contact strip, badge pillola, totale box
    // ──────────────────────────────────────────────────────────────────
    case 'bold': {
      const LABEL = 'font-size:17px;font-weight:700;text-transform:uppercase;letter-spacing:0.09em;color:#999;margin-bottom:4px;'

      const rows = items.map(item => `
        <tr style="border-bottom:1px solid #f0f0f0;">
          <td style="padding:8px 10px;font-size:19px;color:#111;font-weight:500;">${esc(item.description)}</td>
          <td style="padding:8px 8px;font-size:19px;text-align:right;color:#888;">${Number(item.quantity).toLocaleString('it-IT', { maximumFractionDigits: 3 })}</td>
          <td style="padding:8px 8px;font-size:19px;text-align:right;color:#888;">${fmt(Number(item.unit_price))} €</td>
          <td style="padding:8px 10px;font-size:19px;text-align:right;font-weight:700;">${fmt(Number(item.total))} €</td>
        </tr>`).join('')

      const contactParts = [
        wsPiva,
        wsAddrCompact,
        `Emesso: ${docDateShort}`,
        (!isFattura && expiresDateShort) ? `Valido fino al: ${expiresDateShort}` : '',
      ].filter(Boolean).join('  ·  ')

      return wrap(font, `
        ${wmHtml}
        ${statusWmHtml}

        <!-- HEADER: dark full-width band -->
        <div style="background:${color};padding:22px 28px 18px;display:flex;align-items:center;justify-content:space-between;position:relative;z-index:1;">
          ${isLogoRight
            ? `<!-- Badge pillola doc number (sx quando logo è dx) -->
               <div style="background:${onColor};color:${color};padding:9px 18px;border-radius:6px;font-size:17px;font-weight:800;letter-spacing:0.04em;white-space:nowrap;flex-shrink:0;">
                ${docTypeLabel} ${docNumberClean ? `#${esc(docNumberClean)}` : ''}
               </div>
               <div style="display:flex;align-items:center;gap:14px;flex-direction:row-reverse;">
                ${logoEl(52, rgba(onColor, 0.18), onColor)}
                <div style="text-align:right;">
                  <div style="font-size:31px;font-weight:800;color:${onColor};line-height:1.1;letter-spacing:0.01em;">${wsName}</div>
                  <div style="font-size:19px;color:${onColor};opacity:0.65;margin-top:3px;">${[wsAddr, wsPiva].filter(Boolean).join(' · ')}</div>
                </div>
               </div>`
            : `<div style="display:flex;align-items:center;gap:14px;">
                ${logoEl(52, rgba(onColor, 0.18), onColor)}
                <div>
                  <div style="font-size:31px;font-weight:800;color:${onColor};line-height:1.1;letter-spacing:0.01em;">${wsName}</div>
                  <div style="font-size:19px;color:${onColor};opacity:0.65;margin-top:3px;">${[wsAddr, wsPiva].filter(Boolean).join(' · ')}</div>
                </div>
               </div>
               <!-- Badge pillola doc number -->
               <div style="background:${onColor};color:${color};padding:9px 18px;border-radius:6px;font-size:17px;font-weight:800;letter-spacing:0.04em;white-space:nowrap;flex-shrink:0;">
                ${docTypeLabel} ${docNumberClean ? `#${esc(docNumberClean)}` : ''}
               </div>`
          }
        </div>

        <!-- CONTACT STRIP -->
        <div style="background:${rgba(color, 0.92)};border-top:1px solid ${rgba(onColor, 0.10)};padding:7px 28px;position:relative;z-index:1;">
          <span style="font-size:19px;color:${onColor};opacity:0.68;">${contactParts}</span>
        </div>

        <!-- BODY -->
        <div style="padding:22px 28px;position:relative;z-index:1;">

          <!-- Info row in box grigio -->
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:24px;margin-bottom:20px;padding:14px 18px;background:#f7f8fa;border-radius:6px;">
            <div>
              <div style="${LABEL}">Destinatario</div>
              ${clientEl('15px', '12px')}
            </div>
            <div style="text-align:right;flex-shrink:0;">
              <div style="${LABEL}">Numero ${docTypeTitleCase}</div>
              <div style="font-size:24px;font-weight:800;color:#111;line-height:1.1;">${docNumberClean ? `#${esc(docNumberClean)}` : 'BOZZA'}</div>
              ${client ? `<div style="font-size:19px;color:#888;margin-top:3px;">${client.piva ? `P.IVA ${esc(client.piva)}` : ''}</div>` : ''}
            </div>
          </div>

          ${doc.title ? `<div style="font-size:17px;font-weight:700;color:#111;margin-bottom:12px;">${esc(doc.title)}</div>` : ''}
          ${doc.notes ? `<div style="font-size:17px;color:#666;margin-bottom:14px;line-height:1.5;">${nl2br(doc.notes)}</div>` : ''}

          <!-- Tabella voci: header riempito leggero -->
          <table style="margin-bottom:16px;">
            <thead>
              <tr style="background:${rgba(color, 0.09)};">
                <th style="padding:9px 10px;text-align:left;font-size:19px;font-weight:800;color:${safeAccentColor};text-transform:uppercase;letter-spacing:0.08em;">Descrizione lavori</th>
                <th style="padding:9px 8px;text-align:right;font-size:19px;font-weight:800;color:${safeAccentColor};text-transform:uppercase;letter-spacing:0.08em;width:52px;">Q.tà</th>
                <th style="padding:9px 8px;text-align:right;font-size:19px;font-weight:800;color:${safeAccentColor};text-transform:uppercase;letter-spacing:0.08em;width:80px;">Prezzo</th>
                <th style="padding:9px 10px;text-align:right;font-size:19px;font-weight:800;color:${safeAccentColor};text-transform:uppercase;letter-spacing:0.08em;width:80px;">Totale</th>
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
                    <td style="padding:3px 0;font-size:17px;color:#999;">Subtotale</td>
                    <td style="padding:3px 0;font-size:17px;color:#999;text-align:right;">${fmt(subtotal)} €</td>
                  </tr>
                  ${hasDiscount ? `
                  <tr>
                    <td style="padding:3px 0;font-size:17px;color:#999;">Sconto</td>
                    <td style="padding:3px 0;font-size:17px;color:#16a34a;text-align:right;">−${fmt(Math.abs(discount))} €</td>
                  </tr>` : ''}
                  ${vatRowsEl('3px 0', '10px', '#999')}
                  ${bolloAmount > 0 ? `
                  <tr>
                    <td style="padding:3px 0;font-size:17px;color:#999;">Marca da bollo</td>
                    <td style="padding:3px 0;font-size:17px;color:#999;text-align:right;">${fmt(bolloAmount)} €</td>
                  </tr>` : ''}
                </tbody>
              </table>
            </div>
          </div>

          <!-- TOTALE DA PAGARE: box scuro a destra -->
          <div style="display:flex;justify-content:flex-end;">
            <div style="background:${color};color:${onColor};padding:10px 18px;border-radius:7px;text-align:center;min-width:150px;">
              <div style="font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;opacity:0.68;margin-bottom:3px;">${isFattura ? 'Totale da pagare' : 'Totale'}</div>
              <div style="font-size:20px;font-weight:800;letter-spacing:0.01em;line-height:1;">${fmt(total)} €</div>
            </div>
          </div>

          ${depositHtml}
          ${paymentHtml}
          ${legalHtml}
        </div>

        <!-- FOOTER -->
        <div style="position:absolute;bottom:0;left:0;right:0;border-top:1px solid #ebebeb;padding:8px 28px;display:flex;justify-content:space-between;align-items:center;z-index:1;">
          ${brandingSpan('#bbb')}
          <span style="font-size:17px;color:#bbb;">${!isFattura && expiresDate ? `Valido fino al ${expiresDate}` : ''}</span>
        </div>
      `, fontName, pageTitle)
    }

    // ──────────────────────────────────────────────────────────────────
    // TECNICO — uppercase company, bordo spesso, strip 4 celle, col COD
    // ──────────────────────────────────────────────────────────────────
    case 'tecnico': {
      const MONO  = "'Courier New', 'Lucida Console', monospace"
      const LABEL = 'font-size:17px;font-weight:700;text-transform:uppercase;letter-spacing:0.09em;color:#999;margin-bottom:3px;'

      const rows = items.map((item, idx) => {
        const code = String(idx + 1).padStart(2, '0')
        return `
          <tr style="border-bottom:1px solid #ebebeb;">
            <td style="padding:7px 8px;font-size:19px;color:#aaa;font-family:${MONO};vertical-align:top;white-space:nowrap;">${code}</td>
            <td style="padding:7px 8px;font-size:19px;vertical-align:top;line-height:1.4;">
              ${esc(item.description)}<br>
              <span style="font-size:19px;font-weight:700;color:#111;font-family:${MONO};">${fmt(Number(item.total))} €</span>
            </td>
            <td style="padding:7px 8px;font-size:17px;text-align:center;color:#888;vertical-align:top;">${esc(item.unit ?? 'cad')}</td>
            <td style="padding:7px 8px;font-size:17px;text-align:right;color:#888;font-family:${MONO};vertical-align:top;">${Number(item.quantity).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            <td style="padding:7px 8px;font-size:17px;text-align:right;color:#888;font-family:${MONO};vertical-align:top;">${fmt(Number(item.unit_price))}</td>
            <td style="padding:7px 8px;font-size:17px;text-align:right;vertical-align:top;width:50px;"></td>
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
                <div style="font-size:19px;font-weight:700;text-transform:uppercase;letter-spacing:0.09em;color:#888;margin-bottom:4px;">${docTypeTitleCase}</div>
                <div style="font-size:22px;font-weight:800;color:${safeAccentColor};letter-spacing:0.01em;line-height:1;">#${docNumberClean ? esc(docNumberClean) : 'BOZZA'}</div>
               </div>
               <div style="display:flex;align-items:center;gap:12px;flex-direction:row-reverse;">
                ${logoEl(40, rgba(color, 0.11), color)}
                <div style="text-align:right;">
                  <div style="font-size:17px;font-weight:800;letter-spacing:0.04em;color:#111;text-transform:uppercase;line-height:1.2;">${wsName}</div>
                  <div style="font-size:19px;color:#888;letter-spacing:0.02em;margin-top:3px;">${[wsAddr, wsPiva].filter(Boolean).join(' · ')}</div>
                </div>
               </div>`
            : `<div style="display:flex;align-items:center;gap:12px;">
                ${logoEl(40, rgba(color, 0.11), color)}
                <div>
                  <div style="font-size:17px;font-weight:800;letter-spacing:0.04em;color:#111;text-transform:uppercase;line-height:1.2;">${wsName}</div>
                  <div style="font-size:19px;color:#888;letter-spacing:0.02em;margin-top:3px;">${[wsAddr, wsPiva].filter(Boolean).join(' · ')}</div>
                </div>
               </div>
               <div style="text-align:right;flex-shrink:0;">
                <div style="font-size:19px;font-weight:700;text-transform:uppercase;letter-spacing:0.09em;color:#888;margin-bottom:4px;">${docTypeTitleCase}</div>
                <div style="font-size:22px;font-weight:800;color:${safeAccentColor};letter-spacing:0.01em;line-height:1;">#${docNumberClean ? esc(docNumberClean) : 'BOZZA'}</div>
               </div>`
          }
        </div>

        <!-- 4-CELL INFO STRIP -->
        <div style="display:grid;grid-template-columns:repeat(4,1fr);border-bottom:1px solid #e0e0e0;background:#f8f9fb;position:relative;z-index:1;">
          <div style="padding:8px 14px;border-right:1px solid #e0e0e0;">
            <div style="${LABEL}">Data</div>
            <div style="font-size:19px;font-weight:600;color:#111;">${docDateShort}</div>
          </div>
          <div style="padding:8px 14px;border-right:1px solid #e0e0e0;">
            <div style="${LABEL}">Scadenza</div>
            <div style="font-size:19px;font-weight:600;color:#111;">${expiresDateShort ?? '—'}</div>
          </div>
          <div style="padding:8px 14px;border-right:1px solid #e0e0e0;">
            <div style="${LABEL}">Destinatario</div>
            <div style="font-size:19px;font-weight:600;color:#111;">${clientShort}</div>
          </div>
          <div style="padding:8px 14px;">
            <div style="${LABEL}">Totale IVA incl.</div>
            <div style="font-size:19px;font-weight:700;color:${safeAccentColor};">${fmt(total)} €</div>
          </div>
        </div>

        <!-- BODY -->
        <div style="padding:18px 28px;position:relative;z-index:1;">

          ${doc.title ? `<div style="font-size:19px;font-weight:700;color:#111;margin-bottom:12px;">${esc(doc.title)}</div>` : ''}
          ${doc.notes ? `<div style="font-size:17px;color:#666;margin-bottom:14px;line-height:1.5;">${nl2br(doc.notes)}</div>` : ''}

          <!-- Tabella: colonna COD, totale nella desc -->
          <table style="margin-bottom:0;">
            <thead>
              <tr style="background:${color};">
                <th style="padding:7px 8px;text-align:left;font-size:19px;font-weight:700;color:${onColor};text-transform:uppercase;letter-spacing:0.07em;width:36px;">Cod</th>
                <th style="padding:7px 8px;text-align:left;font-size:19px;font-weight:700;color:${onColor};text-transform:uppercase;letter-spacing:0.07em;">Descrizione</th>
                <th style="padding:7px 8px;text-align:center;font-size:19px;font-weight:700;color:${onColor};text-transform:uppercase;letter-spacing:0.07em;width:40px;">U.M.</th>
                <th style="padding:7px 8px;text-align:right;font-size:19px;font-weight:700;color:${onColor};text-transform:uppercase;letter-spacing:0.07em;width:56px;">Q.tà</th>
                <th style="padding:7px 8px;text-align:right;font-size:19px;font-weight:700;color:${onColor};text-transform:uppercase;letter-spacing:0.07em;width:76px;">Prezzo unit.</th>
                <th style="padding:7px 8px;text-align:right;font-size:19px;font-weight:700;color:${onColor};text-transform:uppercase;letter-spacing:0.07em;width:50px;">Totale</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>

          <!-- Totali: etichette a sinistra, valori a destra -->
          <div style="border-top:2px solid #e0e0e0;padding-top:14px;margin-top:14px;">
            <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px;">
              <span style="font-size:17px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#666;">Imponibile</span>
              <span style="font-size:19px;color:#666;">${fmt(imponibile)} €</span>
            </div>
            ${!isForf ? Object.entries(vatGroups).map(([rate, amt]) => `
            <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px;">
              <span style="font-size:17px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#666;">IVA ${rate}%</span>
              <span style="font-size:19px;color:#666;">${fmt(amt)} €</span>
            </div>`).join('') : ''}
            ${bolloAmount > 0 ? `
            <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px;">
              <span style="font-size:17px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#666;">Marca da bollo</span>
              <span style="font-size:19px;color:#666;">${fmt(bolloAmount)} €</span>
            </div>` : ''}
            <div style="border-top:2px solid ${color};margin-top:8px;padding-top:10px;display:flex;justify-content:space-between;align-items:baseline;">
              <span style="font-size:17px;font-weight:800;text-transform:uppercase;letter-spacing:0.05em;color:#111;">Totale ${docTypeTitleCase}</span>
              <span style="font-size:17px;font-weight:800;color:#111;">${fmt(total)} €</span>
            </div>
          </div>

          ${depositHtml}
          ${paymentHtml}
          ${legalHtml}
        </div>

        <!-- FOOTER: stile tecnico -->
        <div style="position:absolute;bottom:0;left:0;right:0;border-top:1px solid #e5e5e5;padding:7px 28px;display:flex;justify-content:space-between;align-items:center;z-index:1;">
          ${showWm ? `<span style="font-size:17px;color:#bbb;font-family:${MONO};">Generato con Carta Canta · cartacanta.app</span>` : '<span></span>'}
          <span style="font-size:17px;color:#bbb;font-family:${MONO};">Doc. ${docNumberClean ? `#${esc(docNumberClean)}` : ''} · ${docDateShort}</span>
        </div>
      `, fontName, pageTitle)
    }

    // ──────────────────────────────────────────────────────────────────
    // ELEGANTE — serif, header bianco, logo bordato, no fill tabella
    // ──────────────────────────────────────────────────────────────────
    case 'elegante': {
      const LABEL = 'font-size:17px;font-weight:600;text-transform:uppercase;letter-spacing:0.13em;color:#aaa;margin-bottom:5px;'

      const rows = items.map(item => `
        <tr style="border-bottom:1px solid #e8e8e8;">
          <td style="padding:8px 0;font-size:19px;color:#333;">${esc(item.description)}</td>
          <td style="padding:8px 10px;font-size:19px;text-align:right;color:#aaa;">${Number(item.quantity).toLocaleString('it-IT', { maximumFractionDigits: 3 })}</td>
          <td style="padding:8px 10px;font-size:19px;text-align:right;color:#aaa;">${fmt(Number(item.unit_price))} €</td>
          <td style="padding:8px 0;font-size:19px;text-align:right;color:#555;">${fmt(Number(item.total))} €</td>
        </tr>`).join('')

      const cityUpper = wsCitta ? wsCitta.toUpperCase() : ''

      return wrap(font, `
        ${wmHtml}
        ${statusWmHtml}

        <!-- HEADER: bianco, serif, logo bordato -->
        <div style="padding:32px 36px 26px;display:flex;align-items:flex-start;justify-content:space-between;position:relative;z-index:1;">
          ${isLogoRight
            ? `<div style="text-align:left;flex-shrink:0;padding-top:4px;">
                <div style="font-size:17px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:#bbb;margin-bottom:7px;">${docTypeTitleCase}</div>
                <div style="font-size:23px;font-weight:700;color:#1a1a2e;font-style:italic;line-height:1;">${docNumberClean ? `#${esc(docNumberClean)}` : 'Bozza'}</div>
               </div>
               <div style="display:flex;align-items:flex-start;gap:16px;flex-direction:row-reverse;">
                ${logoEl(56, '#f5f5f5', '#c0c0c0', true)}
                <div style="padding-top:4px;text-align:right;">
                  <div style="font-size:31px;font-weight:700;color:#111;letter-spacing:0.01em;line-height:1.15;">${wsName}</div>
                  ${cityUpper ? `<div style="font-size:17px;letter-spacing:0.20em;color:#bbb;margin-top:5px;text-transform:uppercase;">${cityUpper}</div>` : ''}
                </div>
               </div>`
            : `<div style="display:flex;align-items:flex-start;gap:16px;">
                ${logoEl(56, '#f5f5f5', '#c0c0c0', true)}
                <div style="padding-top:4px;">
                  <div style="font-size:31px;font-weight:700;color:#111;letter-spacing:0.01em;line-height:1.15;">${wsName}</div>
                  ${cityUpper ? `<div style="font-size:17px;letter-spacing:0.20em;color:#bbb;margin-top:5px;text-transform:uppercase;">${cityUpper}</div>` : ''}
                </div>
               </div>
               <div style="text-align:right;flex-shrink:0;padding-top:4px;">
                <div style="font-size:17px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:#bbb;margin-bottom:7px;">${docTypeTitleCase}</div>
                <div style="font-size:23px;font-weight:700;color:#1a1a2e;font-style:italic;line-height:1;">${docNumberClean ? `#${esc(docNumberClean)}` : 'Bozza'}</div>
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
              ${clientEl('15px', '12px')}
            </div>
            <div style="text-align:right;flex-shrink:0;">
              <div style="${LABEL}">Data</div>
              <div style="font-size:19px;color:#333;margin-bottom:3px;">${docDate}</div>
              ${!isFattura ? (expiresDate
                ? `<div style="font-size:17px;color:#bbb;">Valido 30 giorni dalla data</div>`
                : `<div style="font-size:17px;color:#bbb;">Valido 30 giorni</div>`) : ''}
            </div>
          </div>

          ${doc.title ? `<div style="font-size:17px;font-weight:600;color:#111;font-style:italic;margin-bottom:14px;">${esc(doc.title)}</div>` : ''}
          ${doc.notes ? `<div style="font-size:17px;color:#888;margin-bottom:16px;line-height:1.6;">${nl2br(doc.notes)}</div>` : ''}

          <!-- Tabella: no fill header, solo linee -->
          <table style="margin-bottom:20px;">
            <thead>
              <tr style="border-bottom:1px solid #c8c8c8;">
                <th style="padding:6px 0;text-align:left;font-size:17px;font-weight:600;color:#bbb;text-transform:uppercase;letter-spacing:0.13em;">Descrizione</th>
                <th style="padding:6px 10px;text-align:right;font-size:17px;font-weight:600;color:#bbb;text-transform:uppercase;letter-spacing:0.13em;width:40px;">Q.tà</th>
                <th style="padding:6px 10px;text-align:right;font-size:17px;font-weight:600;color:#bbb;text-transform:uppercase;letter-spacing:0.13em;width:80px;">Prezzo</th>
                <th style="padding:6px 0;text-align:right;font-size:17px;font-weight:600;color:#bbb;text-transform:uppercase;letter-spacing:0.13em;width:80px;">Totale</th>
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
                    <td style="padding:4px 0;font-size:17px;color:#bbb;">Subtotale</td>
                    <td style="padding:4px 0;font-size:17px;color:#bbb;text-align:right;">${fmt(subtotal)} €</td>
                  </tr>
                  ${hasDiscount ? `
                  <tr>
                    <td style="padding:4px 0;font-size:17px;color:#bbb;">Sconto</td>
                    <td style="padding:4px 0;font-size:17px;color:#16a34a;text-align:right;">−${fmt(Math.abs(discount))} €</td>
                  </tr>` : ''}
                  ${vatRowsEl('4px 0', '10px', '#bbb')}
                  ${bolloAmount > 0 ? `
                  <tr>
                    <td style="padding:4px 0;font-size:17px;color:#bbb;">Marca da bollo</td>
                    <td style="padding:4px 0;font-size:17px;color:#bbb;text-align:right;">${fmt(bolloAmount)} €</td>
                  </tr>` : ''}
                </tbody>
              </table>
              <div style="border-top:1px solid #c8c8c8;margin-top:10px;padding-top:10px;display:flex;justify-content:space-between;align-items:baseline;">
                <span style="font-size:19px;font-weight:600;text-transform:uppercase;letter-spacing:0.10em;color:#444;">Totale</span>
                <span style="font-size:20px;font-weight:700;font-style:italic;color:#111;">${fmt(total)} €</span>
              </div>
            </div>
          </div>

          ${depositHtml}
          ${paymentHtml}
          ${legalHtml}
        </div>

        <!-- FOOTER -->
        <div style="position:absolute;bottom:0;left:0;right:0;border-top:1px solid #e5e5e5;padding:9px 36px;display:flex;justify-content:space-between;align-items:center;z-index:1;">
          ${brandingSpan('#ccc')}
          <span style="font-size:17px;color:#ccc;">${!isFattura && expiresDate ? `Valido fino al ${expiresDate}` : ''}</span>
        </div>
      `, fontName, pageTitle)
    }
  }
}
