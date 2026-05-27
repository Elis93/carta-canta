'use client'

import Image from 'next/image'

interface TemplatePreviewProps {
  presetKey:     string        // 'classico' | 'bold' | 'tecnico' | 'elegante'
  color:         string
  font?:         string        // override facoltativo Pro (Inter/GeistSans/Helvetica/Georgia)
  showLogo:      boolean
  showWatermark: boolean       // true = mostra branding footer; false (Pro only) = nasconde
  logoPosition?: 'left' | 'right'
  legalNotice:   string
  workspaceName: string
  logoUrl?:      string | null
  templateName?: string
}

// ── Dati campione ─────────────────────────────────────────────────────────────

const ITEMS = [
  { description: 'Installazione impianto elettrico civile', qty: 1, price: 850  },
  { description: 'Fornitura materiale e cavi FS17',         qty: 1, price: 320  },
  { description: 'Quadro elettrico 24 moduli DIN',          qty: 1, price: 180  },
  { description: 'Collaudo e certificazione IMQ',           qty: 1, price: 80   },
]
const VAT = 22
const subtotal  = ITEMS.reduce((s, i) => s + i.qty * i.price, 0)  // 1430
const vatAmount = subtotal * VAT / 100                              // 314.60
const total     = subtotal + vatAmount                              // 1744.60

function fmt(n: number) {
  return new Intl.NumberFormat('it-IT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

// ── Font stacks ───────────────────────────────────────────────────────────────

const PREVIEW_FONTS: Record<string, string> = {
  Inter:     "'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  GeistSans: "var(--font-geist-sans), system-ui, -apple-system, sans-serif",
  Helvetica: "Helvetica, 'Helvetica Neue', Arial, sans-serif",
  Georgia:   "Georgia, 'Times New Roman', 'Book Antiqua', serif",
}

const PRESET_FONTS: Record<string, string> = {
  classico: PREVIEW_FONTS.Inter,
  bold:     PREVIEW_FONTS.Helvetica,
  tecnico:  PREVIEW_FONTS.GeistSans,
  elegante: PREVIEW_FONTS.Georgia,
}

// ── Colore helper ─────────────────────────────────────────────────────────────

function luminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) || 0
  const g = parseInt(hex.slice(3, 5), 16) || 0
  const b = parseInt(hex.slice(5, 7), 16) || 0
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

function colorAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16) || 0
  const g = parseInt(hex.slice(3, 5), 16) || 0
  const b = parseInt(hex.slice(5, 7), 16) || 0
  return `rgba(${r},${g},${b},${alpha})`
}

// ── Componente ────────────────────────────────────────────────────────────────

export function TemplatePreview({
  presetKey,
  color,
  font,
  showLogo,
  showWatermark,
  logoPosition = 'left',
  legalNotice,
  workspaceName,
  logoUrl,
}: TemplatePreviewProps) {
  const onColor         = luminance(color) > 0.5 ? '#000000' : '#ffffff'
  const safeAccentColor = luminance(color) > 0.4 ? '#1a1a2e' : color
  const fontStack  = font ? (PREVIEW_FONTS[font] ?? PRESET_FONTS[presetKey] ?? PREVIEW_FONTS.Inter) : (PRESET_FONTS[presetKey] ?? PREVIEW_FONTS.Inter)
  const isLogoRight = logoPosition === 'right'

  const today    = new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long',  year: 'numeric' })
  const todayS   = new Date().toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const expiry   = new Date(Date.now() + 30 * 86400000).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })
  const expiryS  = new Date(Date.now() + 30 * 86400000).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })

  // Logo placeholder
  const LogoBox = ({ size, bordered = false }: { size: number; bordered?: boolean }) => {
    if (!showLogo) return null

    if (logoUrl) {
      return (
        <Image
          src={logoUrl} alt={workspaceName}
          width={size} height={size}
          style={{ borderRadius: 4, objectFit: 'contain', flexShrink: 0 }}
          unoptimized
        />
      )
    }

    const icon = (
      <svg xmlns="http://www.w3.org/2000/svg"
        width={size * 0.44} height={size * 0.44}
        viewBox="0 0 24 24" fill="none"
        stroke={bordered ? '#c0c0c0' : onColor}
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14,2 14,8 20,8"/>
      </svg>
    )

    if (bordered) {
      return (
        <div style={{
          width: size, height: size, borderRadius: 4,
          border: '1.5px solid #d0d0d0', background: '#fafafa',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          {icon}
        </div>
      )
    }

    return (
      <div style={{
        width: size, height: size, borderRadius: 6,
        background: colorAlpha(onColor === '#ffffff' ? '#000' : onColor, onColor === '#ffffff' ? 0.20 : 0.12),
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        {icon}
      </div>
    )
  }

  const LABEL_COMMON: React.CSSProperties = {
    fontSize: 8.5, fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.09em', color: '#999', marginBottom: 3,
  }

  // ── Branding footer text ("Generato con Carta Canta")
  // showWatermark = true → mostra (default Free)
  // showWatermark = false → nascosto (Pro opt-out)
  const BrandingText = ({ color: c = '#bbb' }: { color?: string }) =>
    showWatermark
      ? <span style={{ fontSize: 8, color: c }}>Generato con Carta Canta · cartacanta.app</span>
      : <span />

  // ── Watermark diagonale — visibile quando showWatermark = true
  const Watermark = () =>
    showWatermark ? (
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%) rotate(-30deg)',
        opacity: 0.07, fontSize: 54, fontWeight: 900,
        whiteSpace: 'nowrap', color: '#000',
        pointerEvents: 'none', userSelect: 'none', zIndex: 50,
        letterSpacing: '0.01em',
      }}>
        Carta Canta
      </div>
    ) : null

  // ── Badge esempio
  const Badge = () => (
    <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 20 }}>
      <span style={{
        borderRadius: 999, background: 'rgba(0,0,0,0.09)',
        padding: '2px 8px', fontSize: 9, fontWeight: 500, color: 'rgba(0,0,0,0.45)',
      }}>
        esempio
      </span>
    </div>
  )

  // ══════════════════════════════════════════════════════════════════════════
  // CLASSICO
  // ══════════════════════════════════════════════════════════════════════════
  if (presetKey === 'classico') {
    return (
      <div style={{ fontFamily: fontStack, fontSize: 12, color: '#111', background: '#fff', position: 'relative', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
        <Badge /><Watermark />

        {/* Header: bianco, split */}
        <div style={{ padding: '20px 22px 16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', borderBottom: '1px solid #e0e0e0' }}>
          {isLogoRight ? (
            <>
              <div style={{ textAlign: 'left', flexShrink: 0 }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#111', letterSpacing: '0.02em', lineHeight: 1 }}>PREVENTIVO</div>
                <div style={{ fontSize: 10, color: '#888', marginTop: 4 }}>#2026/047</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexDirection: 'row-reverse' }}>
                <LogoBox size={36} />
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#111', lineHeight: 1.2 }}>{workspaceName}</div>
                  <div style={{ fontSize: 9, color: '#888', marginTop: 2 }}>Via Garibaldi 42 · Milano · P.IVA 12345678901</div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <LogoBox size={36} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#111', lineHeight: 1.2 }}>{workspaceName}</div>
                  <div style={{ fontSize: 9, color: '#888', marginTop: 2 }}>Via Garibaldi 42 · Milano · P.IVA 12345678901</div>
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#111', letterSpacing: '0.02em', lineHeight: 1 }}>PREVENTIVO</div>
                <div style={{ fontSize: 10, color: '#888', marginTop: 4 }}>#2026/047</div>
              </div>
            </>
          )}
        </div>

        {/* Body */}
        <div style={{ padding: '16px 22px' }}>

          {/* Destinatario + data */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 16 }}>
            <div>
              <div style={LABEL_COMMON}>Destinatario</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#111' }}>Condominio Via Dante 12</div>
              <div style={{ fontSize: 9, color: '#666' }}>Via Dante 12, 20121 Milano (MI)</div>
              <div style={{ fontSize: 9, color: '#666' }}>C.F. CNDVDT12M20F205X</div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={LABEL_COMMON}>Data emissione</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#111' }}>{today}</div>
              <div style={{ fontSize: 9, color: '#888', marginTop: 2 }}>Valido 30 giorni</div>
            </div>
          </div>

          {/* Tabella */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 14 }}>
            <thead>
              <tr style={{ background: color }}>
                {['Descrizione', 'Q.tà', 'Prezzo unit.', 'Totale'].map((h, i) => (
                  <th key={h} style={{
                    padding: '6px 7px', textAlign: i === 0 ? 'left' : 'right',
                    fontSize: 8, fontWeight: 700, color: onColor,
                    textTransform: 'uppercase', letterSpacing: '0.07em',
                    width: i === 0 ? undefined : i === 1 ? 34 : 64,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ITEMS.map((item, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f2f2f2' }}>
                  <td style={{ padding: '6px 7px', fontSize: 10 }}>{item.description}</td>
                  <td style={{ padding: '6px 7px', fontSize: 10, textAlign: 'right', color: '#888' }}>{item.qty}</td>
                  <td style={{ padding: '6px 7px', fontSize: 10, textAlign: 'right', color: '#888' }}>{fmt(item.price)} €</td>
                  <td style={{ padding: '6px 7px', fontSize: 10, textAlign: 'right', fontWeight: 700 }}>{fmt(item.qty * item.price)} €</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totali */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ minWidth: 160 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, marginBottom: 2 }}>
                <span style={{ fontSize: 9, color: '#888' }}>Subtotale</span>
                <span style={{ fontSize: 9, color: '#888' }}>{fmt(subtotal)} €</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, marginBottom: 2 }}>
                <span style={{ fontSize: 9, color: '#888' }}>IVA {VAT}%</span>
                <span style={{ fontSize: 9, color: '#888' }}>{fmt(vatAmount)} €</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, borderTop: '1px solid #ccc', paddingTop: 6, marginTop: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#111' }}>TOTALE</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#111' }}>{fmt(total)} €</span>
              </div>
            </div>
          </div>

          {legalNotice && (
            <p style={{ fontSize: 8, color: '#ccc', borderTop: '1px solid #f0f0f0', paddingTop: 8, marginTop: 10, lineHeight: 1.5 }}>
              {legalNotice}
            </p>
          )}
        </div>

        {/* Footer */}
        <div style={{ borderTop: '1px solid #ebebeb', padding: '6px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <BrandingText />
          <span style={{ fontSize: 8, color: '#bbb' }}>Preventivo valido fino al {expiry}</span>
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // BOLD
  // ══════════════════════════════════════════════════════════════════════════
  if (presetKey === 'bold') {
    return (
      <div style={{ fontFamily: fontStack, fontSize: 12, color: '#111', background: '#fff', position: 'relative', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
        <Badge /><Watermark />

        {/* Header: dark full-width */}
        <div style={{ background: color, padding: '18px 22px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {isLogoRight ? (
            <>
              <div style={{ background: onColor, color: color, padding: '7px 14px', borderRadius: 5, fontSize: 10, fontWeight: 800, letterSpacing: '0.04em', whiteSpace: 'nowrap', flexShrink: 0 }}>
                PREVENTIVO #2026/047
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexDirection: 'row-reverse' }}>
                <LogoBox size={44} />
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: onColor, lineHeight: 1.1 }}>{workspaceName}</div>
                  <div style={{ fontSize: 9, color: onColor, opacity: 0.65, marginTop: 3 }}>Via Garibaldi 42 · Milano · P.IVA 12345678901</div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <LogoBox size={44} />
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: onColor, lineHeight: 1.1 }}>{workspaceName}</div>
                  <div style={{ fontSize: 9, color: onColor, opacity: 0.65, marginTop: 3 }}>Via Garibaldi 42 · Milano · P.IVA 12345678901</div>
                </div>
              </div>
              {/* Badge pillola */}
              <div style={{ background: onColor, color: color, padding: '7px 14px', borderRadius: 5, fontSize: 10, fontWeight: 800, letterSpacing: '0.04em', whiteSpace: 'nowrap', flexShrink: 0 }}>
                PREVENTIVO #2026/047
              </div>
            </>
          )}
        </div>

        {/* Contact strip */}
        <div style={{ background: colorAlpha(color, 0.92), borderTop: `1px solid ${colorAlpha(onColor, 0.10)}`, padding: '5px 22px' }}>
          <span style={{ fontSize: 8.5, color: onColor, opacity: 0.68 }}>
            P.IVA 12345678901 &nbsp;·&nbsp; Via Garibaldi 42, Milano &nbsp;·&nbsp; Emesso: {todayS} &nbsp;·&nbsp; Valido fino al: {expiryS}
          </span>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 22px' }}>

          {/* Info box */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 14, padding: '10px 14px', background: '#f7f8fa', borderRadius: 5 }}>
            <div>
              <div style={LABEL_COMMON}>Destinatario</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#111' }}>Condominio Via Dante 12</div>
              <div style={{ fontSize: 9, color: '#666' }}>Via Dante 12, 20121 Milano (MI)</div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={LABEL_COMMON}>Numero preventivo</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#111' }}>#2026/047</div>
              <div style={{ fontSize: 9, color: '#888', marginTop: 2 }}>C.F. CNDVDT12M20F205X</div>
            </div>
          </div>

          {/* Tabella */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10 }}>
            <thead>
              <tr style={{ background: colorAlpha(color, 0.09) }}>
                {['Descrizione lavori', 'Q.tà', 'Prezzo', 'Totale'].map((h, i) => (
                  <th key={h} style={{
                    padding: '6px 7px', textAlign: i === 0 ? 'left' : 'right',
                    fontSize: 8, fontWeight: 800, color: safeAccentColor,
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                    width: i === 0 ? undefined : i === 1 ? 30 : 58,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ITEMS.map((item, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '6px 7px', fontSize: 10, fontWeight: 500 }}>{item.description}</td>
                  <td style={{ padding: '6px 7px', fontSize: 10, textAlign: 'right', color: '#888' }}>{item.qty}</td>
                  <td style={{ padding: '6px 7px', fontSize: 10, textAlign: 'right', color: '#888' }}>{fmt(item.price)} €</td>
                  <td style={{ padding: '6px 7px', fontSize: 10, textAlign: 'right', fontWeight: 700 }}>{fmt(item.qty * item.price)} €</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Sub-totali */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
            <div style={{ minWidth: 150 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, marginBottom: 2 }}>
                <span style={{ fontSize: 9, color: '#999' }}>Subtotale</span>
                <span style={{ fontSize: 9, color: '#999' }}>{fmt(subtotal)} €</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24 }}>
                <span style={{ fontSize: 9, color: '#999' }}>IVA {VAT}%</span>
                <span style={{ fontSize: 9, color: '#999' }}>{fmt(vatAmount)} €</span>
              </div>
            </div>
          </div>

          {/* TOTALE box scuro */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ background: color, color: onColor, padding: '12px 20px', borderRadius: 7, textAlign: 'center', minWidth: 150 }}>
              <div style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.68, marginBottom: 4 }}>Totale da pagare</div>
              <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '0.01em', lineHeight: 1 }}>{fmt(total)} €</div>
            </div>
          </div>

          {legalNotice && (
            <p style={{ fontSize: 8, color: '#ccc', borderTop: '1px solid #f0f0f0', paddingTop: 8, marginTop: 10, lineHeight: 1.5 }}>
              {legalNotice}
            </p>
          )}
        </div>

        {/* Footer */}
        <div style={{ borderTop: '1px solid #ebebeb', padding: '6px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <BrandingText />
          <span style={{ fontSize: 8, color: '#bbb' }}>Valido fino al {expiry}</span>
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TECNICO
  // ══════════════════════════════════════════════════════════════════════════
  if (presetKey === 'tecnico') {
    const MONO: React.CSSProperties = { fontFamily: "'Courier New', monospace" }
    const LABEL_T: React.CSSProperties = { fontSize: 7.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: '#999', marginBottom: 2 }

    return (
      <div style={{ fontFamily: fontStack, fontSize: 12, color: '#111', background: '#fff', position: 'relative', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
        <Badge /><Watermark />

        {/* Header: bianco, uppercase, bordo spesso */}
        <div style={{ padding: '16px 22px 12px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', borderBottom: `3px solid ${color}` }}>
          {isLogoRight ? (
            <>
              <div style={{ textAlign: 'left', flexShrink: 0 }}>
                <div style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.09em', color: '#888', marginBottom: 3 }}>Preventivo</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: safeAccentColor, letterSpacing: '0.01em', lineHeight: 1 }}>#2026/047</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexDirection: 'row-reverse' as const }}>
                <LogoBox size={34} />
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#111', letterSpacing: '0.04em', textTransform: 'uppercase' as const, lineHeight: 1.2 }}>{workspaceName}</div>
                  <div style={{ fontSize: 8.5, color: '#888', marginTop: 2 }}>Via Garibaldi 42 · 20121 Milano · P.IVA 12345678901</div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <LogoBox size={34} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#111', letterSpacing: '0.04em', textTransform: 'uppercase' as const, lineHeight: 1.2 }}>{workspaceName}</div>
                  <div style={{ fontSize: 8.5, color: '#888', marginTop: 2 }}>Via Garibaldi 42 · 20121 Milano · P.IVA 12345678901</div>
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.09em', color: '#888', marginBottom: 3 }}>Preventivo</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: safeAccentColor, letterSpacing: '0.01em', lineHeight: 1 }}>#2026/047</div>
              </div>
            </>
          )}
        </div>

        {/* 4-cell strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', borderBottom: '1px solid #e0e0e0', background: '#f8f9fb' }}>
          {[
            { label: 'Data',            value: todayS },
            { label: 'Scadenza',        value: expiryS },
            { label: 'Destinatario',    value: 'Cond. Via Dante 12' },
            { label: 'Totale IVA incl.', value: `${fmt(total)} €`, accent: true },
          ].map((cell, i) => (
            <div key={i} style={{ padding: '7px 10px', borderRight: i < 3 ? '1px solid #e0e0e0' : undefined }}>
              <div style={LABEL_T}>{cell.label}</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: cell.accent ? safeAccentColor : '#111' }}>{cell.value}</div>
            </div>
          ))}
        </div>

        {/* Body */}
        <div style={{ padding: '14px 22px' }}>
          {/* Tabella */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 0 }}>
            <thead>
              <tr style={{ background: color }}>
                {['Cod', 'Descrizione', 'U.M.', 'Q.tà', 'Prezzo unit.', 'Tot.'].map((h, i) => (
                  <th key={h} style={{
                    padding: '5px 6px', textAlign: i === 0 || i === 1 ? 'left' : 'right',
                    fontSize: 7.5, fontWeight: 700, color: onColor,
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                    width: i === 0 ? 26 : i === 2 ? 30 : i >= 3 ? 44 : undefined,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ITEMS.map((item, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #ebebeb' }}>
                  <td style={{ padding: '6px 6px', fontSize: 9, color: '#aaa', verticalAlign: 'top', ...MONO }}>{String(i + 1).padStart(2, '0')}</td>
                  <td style={{ padding: '6px 6px', fontSize: 10, verticalAlign: 'top', lineHeight: 1.35 }}>
                    {item.description}<br />
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#111', ...MONO }}>{fmt(item.qty * item.price)} €</span>
                  </td>
                  <td style={{ padding: '6px 6px', fontSize: 9, textAlign: 'right', color: '#888', verticalAlign: 'top' }}>cad</td>
                  <td style={{ padding: '6px 6px', fontSize: 9, textAlign: 'right', color: '#888', verticalAlign: 'top', ...MONO }}>1,00</td>
                  <td style={{ padding: '6px 6px', fontSize: 9, textAlign: 'right', color: '#888', verticalAlign: 'top', ...MONO }}>{fmt(item.price)}</td>
                  <td style={{ padding: '6px 6px', fontSize: 9, textAlign: 'right', verticalAlign: 'top' }}></td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totali full-width */}
          <div style={{ borderTop: '2px solid #e0e0e0', paddingTop: 10, marginTop: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
              <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#666' }}>Imponibile</span>
              <span style={{ fontSize: 10, color: '#666' }}>{fmt(subtotal)} €</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#666' }}>IVA {VAT}%</span>
              <span style={{ fontSize: 10, color: '#666' }}>{fmt(vatAmount)} €</span>
            </div>
            <div style={{ borderTop: `2px solid ${color}`, paddingTop: 7, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#111' }}>Totale preventivo</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#111' }}>{fmt(total)} €</span>
            </div>
          </div>

          {legalNotice && (
            <p style={{ fontSize: 8, color: '#ccc', borderTop: '1px solid #f0f0f0', paddingTop: 8, marginTop: 10, lineHeight: 1.5 }}>
              {legalNotice}
            </p>
          )}
        </div>

        {/* Footer */}
        <div style={{ borderTop: '1px solid #e5e5e5', padding: '6px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <BrandingText />
          <span style={{ fontSize: 8, color: '#bbb', ...MONO }}>Doc. #2026/047 · {todayS}</span>
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ELEGANTE
  // ══════════════════════════════════════════════════════════════════════════
  // (default per preset sconosciuto)
  const LABEL_E: React.CSSProperties = {
    fontSize: 8, fontWeight: 600, textTransform: 'uppercase',
    letterSpacing: '0.13em', color: '#bbb', marginBottom: 4,
  }

  return (
    <div style={{ fontFamily: fontStack, fontSize: 12, color: '#111', background: '#fff', position: 'relative', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
      <Badge /><Watermark />

      {/* Header: bianco, serif, logo bordato */}
      <div style={{ padding: '24px 26px 20px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        {isLogoRight ? (
          <>
            <div style={{ textAlign: 'left', flexShrink: 0, paddingTop: 4 }}>
              <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase' as const, color: '#bbb', marginBottom: 5 }}>Preventivo</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#1a1a2e', fontStyle: 'italic' as const, lineHeight: 1 }}>#2026/047</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexDirection: 'row-reverse' as const }}>
              <LogoBox size={48} bordered />
              <div style={{ paddingTop: 4, textAlign: 'right' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#111', letterSpacing: '0.01em', lineHeight: 1.15 }}>{workspaceName}</div>
                <div style={{ fontSize: 8, letterSpacing: '0.20em', color: '#bbb', marginTop: 4, textTransform: 'uppercase' as const }}>STUDIO · MILANO</div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <LogoBox size={48} bordered />
              <div style={{ paddingTop: 4 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#111', letterSpacing: '0.01em', lineHeight: 1.15 }}>{workspaceName}</div>
                <div style={{ fontSize: 8, letterSpacing: '0.20em', color: '#bbb', marginTop: 4, textTransform: 'uppercase' as const }}>STUDIO · MILANO</div>
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0, paddingTop: 4 }}>
              <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase' as const, color: '#bbb', marginBottom: 5 }}>Preventivo</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#1a1a2e', fontStyle: 'italic' as const, lineHeight: 1 }}>#2026/047</div>
            </div>
          </>
        )}
      </div>

      {/* Separatore con accento brand */}
      <div style={{ borderBottom: `1px solid ${color}`, margin: '0 26px' }} />

      {/* Body */}
      <div style={{ padding: '18px 26px' }}>

        {/* Destinatario + data */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 18 }}>
          <div>
            <div style={LABEL_E}>Destinatario</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#111', marginBottom: 2 }}>Condominio Via Dante 12</div>
            <div style={{ fontSize: 9, color: '#888' }}>Via Dante 12, 20121 Milano (MI)</div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={LABEL_E}>Data</div>
            <div style={{ fontSize: 11, color: '#333', marginBottom: 2 }}>{today}</div>
            <div style={{ fontSize: 9, color: '#bbb' }}>Valido 30 giorni dalla data</div>
          </div>
        </div>

        {/* Tabella: no fill header */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #c8c8c8' }}>
              {['Descrizione', 'Q.tà', 'Prezzo', 'Totale'].map((h, i) => (
                <th key={h} style={{
                  padding: '5px 0', paddingLeft: i > 0 ? 8 : 0,
                  textAlign: i === 0 ? 'left' : 'right',
                  fontSize: 7.5, fontWeight: 600, color: '#bbb',
                  textTransform: 'uppercase', letterSpacing: '0.13em',
                  width: i === 0 ? undefined : i === 1 ? 30 : 60,
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ITEMS.map((item, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #e8e8e8' }}>
                <td style={{ padding: '7px 0', fontSize: 10, color: '#333' }}>{item.description}</td>
                <td style={{ padding: '7px 0', paddingLeft: 8, fontSize: 10, textAlign: 'right', color: '#bbb' }}>{item.qty}</td>
                <td style={{ padding: '7px 0', paddingLeft: 8, fontSize: 10, textAlign: 'right', color: '#bbb' }}>{fmt(item.price)} €</td>
                <td style={{ padding: '7px 0', paddingLeft: 8, fontSize: 10, textAlign: 'right', color: '#555' }}>{fmt(item.qty * item.price)} €</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totali */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ minWidth: 160 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, marginBottom: 3 }}>
              <span style={{ fontSize: 9, color: '#bbb' }}>Subtotale</span>
              <span style={{ fontSize: 9, color: '#bbb' }}>{fmt(subtotal)} €</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24 }}>
              <span style={{ fontSize: 9, color: '#bbb' }}>IVA {VAT}%</span>
              <span style={{ fontSize: 9, color: '#bbb' }}>{fmt(vatAmount)} €</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, borderTop: '1px solid #c8c8c8', paddingTop: 8, marginTop: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.10em', color: '#444' }}>Totale</span>
              <span style={{ fontSize: 16, fontWeight: 700, fontStyle: 'italic', color: '#111' }}>{fmt(total)} €</span>
            </div>
          </div>
        </div>

        {legalNotice && (
          <p style={{ fontSize: 8, color: '#ccc', borderTop: '1px solid #f0f0f0', paddingTop: 8, marginTop: 10, lineHeight: 1.5 }}>
            {legalNotice}
          </p>
        )}
      </div>

      {/* Footer */}
      <div style={{ borderTop: '1px solid #e5e5e5', padding: '7px 26px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <BrandingText color="#ccc" />
        <span style={{ fontSize: 8, color: '#ccc' }}>Valido fino al {expiry}</span>
      </div>
    </div>
  )
}
