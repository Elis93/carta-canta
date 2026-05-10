'use client'

import Image from 'next/image'

interface TemplatePreviewProps {
  presetKey: string  // 'classico' | 'bold' | 'tecnico' | 'elegante'
  color: string
  font?: string      // override facoltativo (Pro); se assente usa il default del preset
  showLogo: boolean
  showWatermark: boolean
  legalNotice: string
  workspaceName: string
  logoUrl?: string | null
  templateName?: string
}

// Dati di esempio fissi per la preview
const SAMPLE_ITEMS = [
  { description: 'Installazione impianto elettrico', qty: 1, price: 850.0 },
  { description: 'Materiale e cavi',                 qty: 1, price: 320.0 },
  { description: 'Collaudo e certificazione',        qty: 1, price: 80.0  },
]
const SAMPLE_VAT_RATE = 22

function fmt(n: number) {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency', currency: 'EUR', minimumFractionDigits: 2,
  }).format(n)
}

// ── Font stacks (browser) ────────────────────────────────────────────────────
const PREVIEW_FONTS: Record<string, string> = {
  Inter:     "'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  GeistSans: "var(--font-geist-sans), system-ui, -apple-system, sans-serif",
  Helvetica: "Helvetica, 'Helvetica Neue', Arial, sans-serif",
  Georgia:   "Georgia, 'Times New Roman', 'Book Antiqua', serif",
}

// Font predefinito per ogni preset
const PRESET_DEFAULT_FONTS: Record<string, string> = {
  classico: PREVIEW_FONTS.Inter,
  bold:     PREVIEW_FONTS.Helvetica,
  tecnico:  PREVIEW_FONTS.GeistSans,
  elegante: PREVIEW_FONTS.Georgia,
}

// ── Preset per stile/layout ──────────────────────────────────────────────────
interface StylePreset {
  headerPadding:     string
  logoSize:          number
  /** elegante: header centrato a due fasce. */
  headerCentered:    boolean
  /** bold: striscia contatti sotto l'header */
  contactStrip:      boolean
  /** tecnico: nessun fill, solo bordo inferiore colorato. */
  tableHeaderNoFill: boolean
  tableHeaderAlpha:  number
  cellPadding:       string
  tableFontSize:     string
  labelStyle:        React.CSSProperties
  descItalic:        boolean
  rowBorderColor:    string
}

const PRESETS: Record<string, StylePreset> = {
  // ── Classico (Inter): layout pulito, spaziatura standard
  classico: {
    headerPadding:     '16px 20px',
    logoSize:          36,
    headerCentered:    false,
    contactStrip:      false,
    tableHeaderNoFill: false,
    tableHeaderAlpha:  0.10,
    cellPadding:       '6px 8px',
    tableFontSize:     '11px',
    labelStyle: {
      textTransform: 'uppercase',
      letterSpacing: '0.07em',
      fontSize:      '9px',
      fontWeight:    700,
      color:         '#9ca3af',
      marginBottom:  4,
    },
    descItalic:     false,
    rowBorderColor: '#f3f4f6',
  },

  // ── Bold (Helvetica): header imponente, striscia contatti, totali pesanti
  bold: {
    headerPadding:     '20px 20px',
    logoSize:          48,
    headerCentered:    false,
    contactStrip:      true,
    tableHeaderNoFill: false,
    tableHeaderAlpha:  0.12,
    cellPadding:       '7px 8px',
    tableFontSize:     '11px',
    labelStyle: {
      textTransform: 'uppercase',
      letterSpacing: '0.10em',
      fontSize:      '9px',
      fontWeight:    800,
      color:         '#9ca3af',
      marginBottom:  4,
    },
    descItalic:     false,
    rowBorderColor: '#e5e7eb',
  },

  // ── Tecnico (GeistSans): compatto, tabella con solo bordo inferiore colorato
  tecnico: {
    headerPadding:     '12px 20px',
    logoSize:          28,
    headerCentered:    false,
    contactStrip:      false,
    tableHeaderNoFill: true,
    tableHeaderAlpha:  0,
    cellPadding:       '4px 8px',
    tableFontSize:     '10px',
    labelStyle: {
      textTransform: 'uppercase',
      letterSpacing: '0.10em',
      fontSize:      '8px',
      fontWeight:    700,
      color:         '#6b7280',
      marginBottom:  4,
    },
    descItalic:     false,
    rowBorderColor: '#f9fafb',
  },

  // ── Elegante (Georgia): header centrato a due fasce, descrizioni in corsivo
  elegante: {
    headerPadding:     '14px 20px',
    logoSize:          36,
    headerCentered:    true,
    contactStrip:      false,
    tableHeaderNoFill: false,
    tableHeaderAlpha:  0.10,
    cellPadding:       '7px 8px',
    tableFontSize:     '11px',
    labelStyle: {
      letterSpacing: '0.06em',
      fontSize:      '9px',
      fontWeight:    600,
      color:         '#9ca3af',
      marginBottom:  4,
    },
    descItalic:     true,
    rowBorderColor: '#e5e7eb',
  },
}

// ── Componente ───────────────────────────────────────────────────────────────

export function TemplatePreview({
  presetKey,
  color,
  font,
  showLogo,
  showWatermark,
  legalNotice,
  workspaceName,
  logoUrl,
}: TemplatePreviewProps) {
  const subtotal  = SAMPLE_ITEMS.reduce((s, i) => s + i.qty * i.price, 0)
  const vatAmount = (subtotal * SAMPLE_VAT_RATE) / 100
  const total     = subtotal + vatAmount

  // Contrasto testo header
  const r = parseInt(color.slice(1, 3), 16) || 0
  const g = parseInt(color.slice(3, 5), 16) || 0
  const b = parseInt(color.slice(5, 7), 16) || 0
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  const headerTextColor = luminance > 0.5 ? '#000000' : '#ffffff'

  const todayLabel = new Date().toLocaleDateString('it-IT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })

  const preset = PRESETS[presetKey] ?? PRESETS.classico
  const defaultFontStack = PRESET_DEFAULT_FONTS[presetKey] ?? PREVIEW_FONTS.Inter
  const fontStack = font ? (PREVIEW_FONTS[font] ?? defaultFontStack) : defaultFontStack

  // rgba helper
  function colorAlpha(alpha: number) {
    return `rgba(${r},${g},${b},${alpha})`
  }

  // Elemento logo riutilizzabile
  const LogoEl = ({ size }: { size: number }) => {
    if (!showLogo) return null
    if (logoUrl) {
      return (
        <Image
          src={logoUrl}
          alt={workspaceName}
          width={size}
          height={size}
          style={{ borderRadius: 5, objectFit: 'contain' }}
          unoptimized
        />
      )
    }
    return (
      <div style={{
        width: size, height: size,
        borderRadius: 5,
        background: 'rgba(255,255,255,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <span style={{ fontWeight: 700, fontSize: size * 0.4, color: headerTextColor }}>
          {workspaceName[0]?.toUpperCase()}
        </span>
      </div>
    )
  }

  return (
    <div
      className="border rounded-xl overflow-hidden shadow-sm bg-white relative text-xs"
      style={{ fontFamily: fontStack }}
    >
      {/* Badge "esempio" */}
      <div className="absolute top-2 right-2 z-20">
        <span className="rounded-full bg-black/10 backdrop-blur-sm px-2 py-0.5 text-[10px] font-medium text-black/50 select-none">
          esempio
        </span>
      </div>

      {/* Watermark */}
      {showWatermark && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 opacity-[0.06] -rotate-[30deg]">
          <span className="text-5xl font-black text-gray-800 whitespace-nowrap select-none">
            Carta Canta
          </span>
        </div>
      )}

      {/* ── Header elegante: due fasce centrate ── */}
      {preset.headerCentered ? (
        <>
          <div style={{
            backgroundColor: color,
            color: headerTextColor,
            padding: preset.headerPadding,
            textAlign: 'center',
          }}>
            {showLogo && (
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
                <LogoEl size={preset.logoSize} />
              </div>
            )}
            <p style={{ fontWeight: 700, fontSize: 13, letterSpacing: '0.02em' }}>
              {workspaceName}
            </p>
            <p style={{ opacity: 0.7, fontSize: 10, marginTop: 2 }}>
              Via Roma 1 — Milano (MI)
            </p>
          </div>
          {/* Fascia 2: info documento */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '7px 20px',
            borderBottom: `2px solid ${color}`,
          }}>
            <p style={{ fontSize: 10, color: '#6b7280', fontStyle: 'italic' }}>
              {todayLabel} · Valido 30 giorni
            </p>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontWeight: 700, fontSize: 11, letterSpacing: '0.05em', color }}>
                PREVENTIVO
              </p>
              <p style={{ fontSize: 10, color, fontStyle: 'italic' }}>n. 2026/001</p>
            </div>
          </div>
        </>
      ) : (
        /* ── Header classico / bold / tecnico: split orizzontale ── */
        <>
          <div style={{
            backgroundColor: color,
            color: headerTextColor,
            padding: preset.headerPadding,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <LogoEl size={preset.logoSize} />
              <div>
                <p style={{
                  fontWeight: preset.contactStrip ? 800 : 600,
                  fontSize: preset.contactStrip ? 14 : 13,
                }}>
                  {workspaceName}
                </p>
                <p style={{ opacity: 0.72, fontSize: 10 }}>Via Roma 1 — Milano (MI)</p>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{
                fontWeight: 900,
                fontSize: preset.contactStrip ? 14 : 12,
                letterSpacing: '0.05em',
              }}>
                PREVENTIVO
              </p>
              <p style={{ opacity: 0.75, fontSize: 10 }}>#2026/001</p>
            </div>
          </div>

          {/* Striscia contatti (solo Bold) */}
          {preset.contactStrip && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '4px 20px',
              background: '#f8fafc',
              borderBottom: `2px solid ${color}`,
              fontSize: 9,
              color: '#6b7280',
            }}>
              <span>P.IVA 12345678901 &nbsp;·&nbsp; Via Roma 1, Milano</span>
              <span>{todayLabel}</span>
            </div>
          )}
        </>
      )}

      {/* ── Body ── */}
      <div style={{ padding: '16px 20px' }} className="space-y-3">

        {/* Cliente + data */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <p style={preset.labelStyle}>Destinatario</p>
            <p style={{ fontWeight: 600 }}>Mario Rossi Costruzioni</p>
            <p style={{ color: '#9ca3af', fontSize: 10 }}>Via Garibaldi 42, Roma</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={preset.labelStyle}>
              {preset.headerCentered || preset.contactStrip ? 'Scadenza' : 'Data'}
            </p>
            {!preset.headerCentered && !preset.contactStrip && (
              <p style={{ fontWeight: 500 }}>{todayLabel}</p>
            )}
            <p style={{ color: '#9ca3af', fontSize: 10 }}>Valido 30 giorni</p>
          </div>
        </div>

        {/* Tabella voci */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
          <thead>
            <tr style={{
              backgroundColor: preset.tableHeaderNoFill
                ? 'transparent'
                : colorAlpha(preset.tableHeaderAlpha),
              borderBottom: preset.tableHeaderNoFill
                ? `2px solid ${color}`
                : 'none',
            }}>
              {(['Descrizione', 'Qtà', 'Prezzo', 'Totale'] as const).map((col, ci) => (
                <th key={col} style={{
                  padding: preset.cellPadding,
                  textAlign: ci === 0 ? 'left' : 'right',
                  fontSize: preset.tableFontSize,
                  fontWeight: 700,
                  color,
                  width: ci === 0 ? undefined : ci === 1 ? 28 : 64,
                }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SAMPLE_ITEMS.map((item, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${preset.rowBorderColor}` }}>
                <td style={{
                  padding: preset.cellPadding,
                  fontStyle: preset.descItalic ? 'italic' : 'normal',
                }}>
                  {item.description}
                </td>
                <td style={{ padding: preset.cellPadding, textAlign: 'right', color: '#9ca3af' }}>
                  {item.qty}
                </td>
                <td style={{ padding: preset.cellPadding, textAlign: 'right', color: '#9ca3af' }}>
                  {fmt(item.price)}
                </td>
                <td style={{ padding: preset.cellPadding, textAlign: 'right', fontWeight: 600 }}>
                  {fmt(item.qty * item.price)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Riepilogo importi */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ minWidth: 160 }} className="space-y-0.5">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 32 }}>
              <span style={{ color: '#9ca3af' }}>Subtotale</span>
              <span style={{ color: '#9ca3af' }}>{fmt(subtotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 32 }}>
              <span style={{ color: '#9ca3af' }}>IVA {SAMPLE_VAT_RATE}%</span>
              <span style={{ color: '#9ca3af' }}>{fmt(vatAmount)}</span>
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 32,
              fontWeight: preset.contactStrip ? 900 : 700,
              fontSize: preset.contactStrip ? 14 : 13,
              paddingTop: 4,
              borderTop: `${preset.contactStrip ? '2' : '1'}px solid ${preset.rowBorderColor}`,
              color,
            }}>
              <span>TOTALE</span>
              <span>{fmt(total)}</span>
            </div>
          </div>
        </div>

        {/* Nota legale */}
        {legalNotice && (
          <p style={{
            fontSize: 9,
            color: '#d1d5db',
            borderTop: '1px solid #f3f4f6',
            paddingTop: 8,
            lineHeight: 1.6,
          }}>
            {legalNotice}
          </p>
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '6px 20px',
        textAlign: 'center',
        backgroundColor: colorAlpha(0.07),
        color,
        opacity: 0.6,
      }}>
        <p style={{ fontSize: 9 }}>Generato con Carta Canta · cartacanta.app</p>
      </div>
    </div>
  )
}
