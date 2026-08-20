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
  /** false = nasconde la pillola "esempio" (lista/editor mobile — il mockup mostra il documento pulito) */
  showExampleBadge?: boolean
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

// 17-18 lug (Eli: "font troppo simili"): le chiavi restano quelle storiche
// del DB. 'Helvetica' rende Atkinson Hyperlegible (SELF-HOSTED in
// /public/fonts: sul telefono Trebuchet/Verdana non esistono e cadevano su
// Roboto = identico a Inter); 'Georgia' ha Lora self-hosted come fallback
// (Android non ha Georgia); 'GeistSans' il monospazio. Stessi stack in
// lib/pdf/template.ts; @font-face in globals.css.
const PREVIEW_FONTS: Record<string, string> = {
  Inter:     "'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  GeistSans: "'Courier New', Courier, monospace",
  Helvetica: "'Atkinson Hyperlegible', 'Trebuchet MS', Tahoma, sans-serif",
  Georgia:   "Georgia, 'Lora', 'Times New Roman', serif",
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

// Accento leggibile su bianco — 18 lug (Eli: "col colore cambia solo la
// riga"): il vecchio fallback navy scattava già a luminance 0.4, cioè anche
// per oro/verde/terracotta della palette. Ora i colori medi vengono SCURITI
// mantenendo la tinta; solo i quasi-bianchi → navy. Stessa funzione in
// lib/pdf/template.ts.
function darkenToReadable(hex: string): string {
  let r = parseInt(hex.slice(1, 3), 16) || 0
  let g = parseInt(hex.slice(3, 5), 16) || 0
  let b = parseInt(hex.slice(5, 7), 16) || 0
  const lum = () => (0.299 * r + 0.587 * g + 0.114 * b) / 255
  if (lum() > 0.85) return '#1a1a2e'
  let guard = 0
  while (lum() > 0.55 && guard < 10) {
    r *= 0.82; g *= 0.82; b *= 0.82; guard++
  }
  const h = (n: number) => Math.round(n).toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`
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
  showExampleBadge = true,
}: TemplatePreviewProps) {
  const onColor         = luminance(color) > 0.5 ? '#000000' : '#ffffff'
  const safeAccentColor = darkenToReadable(color)
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

  const LABEL_ACCENT: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.12em', color: safeAccentColor, marginBottom: 3, whiteSpace: 'nowrap',
  }
  const LABEL_COMMON: React.CSSProperties = {
    fontSize: 12,fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.09em', color: '#999', marginBottom: 3,
  }

  // ── Branding footer text ("Generato con Carta Canta")
  // showWatermark = true → mostra (default Free)
  // showWatermark = false → nascosto (Pro opt-out)
  const BrandingText = ({ color: c = '#bbb' }: { color?: string }) =>
    showWatermark
      ? <span style={{ fontSize: 10,color: c }}>Generato con Carta Canta · cartacanta.app</span>
      : <span />

  // ── Watermark diagonale — RIMOSSO (sessione 23: niente watermark diagonale
  //    per nessun piano; resta solo il branding footer). Il mockup template
  //    mostra il documento pulito con la sola riga in calce.
  const Watermark = () => null

  // ── Badge esempio — posizionato in alto al CENTRO per non sovrapporsi
  //    all'intestazione "PREVENTIVO" (in alto a destra) né al logo (in alto a sinistra).
  const Badge = () => showExampleBadge ? (
    <div style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', zIndex: 20 }}>
      <span style={{
        borderRadius: 999, background: 'rgba(0,0,0,0.09)',
        padding: '2px 8px', fontSize: 11, fontWeight: 500, color: 'rgba(0,0,0,0.45)',
      }}>
        esempio
      </span>
    </div>
  ) : null

  // ══════════════════════════════════════════════════════════════════════════
  // CLASSICO
  // ══════════════════════════════════════════════════════════════════════════
  if (presetKey === 'classico') {
    // «Contemporanea» (Eli 20 ago): sans, fascia dati, cliente in card e
    // TOTALE a riquadro pieno nel colore scelto. Anteprima allineata al PDF.
    const tint = colorAlpha(color, 0.08)
    const tintLine = colorAlpha(color, 0.14)
    const STRONG: React.CSSProperties = { fontSize: 10, fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase', color: safeAccentColor, marginBottom: 4 }
    const KCELL: React.CSSProperties = { fontSize: 8, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: safeAccentColor }
    const bizBlock = (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexDirection: isLogoRight ? 'row-reverse' : 'row', minWidth: 0 }}>
        <LogoBox size={36} />
        <div style={{ textAlign: isLogoRight ? 'right' : 'left', minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#16202b', lineHeight: 1.1, letterSpacing: '-0.01em' }}>{workspaceName}</div>
          <div style={{ fontSize: 10, color: '#8a929b', marginTop: 2 }}>P.IVA 12345678901</div>
        </div>
      </div>
    )
    const idBlock = (
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.20em', textTransform: 'uppercase', color: safeAccentColor }}>PREVENTIVO</div>
        <div style={{ fontSize: 19, fontWeight: 800, color: '#16202b', lineHeight: 1.05, marginTop: 2, whiteSpace: 'nowrap' }}>N°&nbsp;014/2026</div>
      </div>
    )
    return (
      <div style={{ fontFamily: fontStack, fontSize: 14, color: '#111', background: '#fff', position: 'relative', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
        <Badge /><Watermark />

        {/* Header */}
        <div style={{ padding: '18px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
          {isLogoRight ? <>{idBlock}{bizBlock}</> : <>{bizBlock}{idBlock}</>}
        </div>
        <div style={{ height: 3, background: color, borderRadius: 2, margin: '12px 20px 0' }} />

        {/* Fascia dati */}
        <div style={{ display: 'flex', background: tint, borderRadius: 8, margin: '12px 20px 0', overflow: 'hidden' }}>
          <div style={{ flex: 1, padding: '6px 12px', borderRight: `1px solid ${tintLine}` }}>
            <div style={KCELL}>Data</div>
            <div style={{ fontSize: 11, color: '#1a2731', fontWeight: 600, marginTop: 1 }}>{today}</div>
          </div>
          <div style={{ flex: 1, padding: '6px 12px', borderRight: `1px solid ${tintLine}` }}>
            <div style={KCELL}>Valido fino al</div>
            <div style={{ fontSize: 11, color: '#1a2731', fontWeight: 600, marginTop: 1 }}>{expiry}</div>
          </div>
          <div style={{ flex: 1, padding: '6px 12px' }}>
            <div style={KCELL}>Regime</div>
            <div style={{ fontSize: 11, color: '#1a2731', fontWeight: 600, marginTop: 1 }}>Ordinario</div>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '14px 20px' }}>

          {/* Emittente + Cliente */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 16 }}>
            <div style={{ minWidth: 0 }}>
              <div style={STRONG}>Emittente</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#16202b' }}>{workspaceName}</div>
              <div style={{ fontSize: 10, color: '#6c727a', marginTop: 1 }}>Via Garibaldi 42, Milano (MI)</div>
            </div>
            <div style={{ flexShrink: 0, minWidth: 130, background: '#f7f9fa', border: '1px solid #e4e8eb', borderRadius: 8, padding: '9px 11px' }}>
              <div style={STRONG}>Cliente</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#16202b' }}>Condominio Via Dante 12</div>
              <div style={{ fontSize: 10, color: '#6c727a', marginTop: 1 }}>Via Dante 12, 20121 Milano (MI)</div>
            </div>
          </div>

          {/* Tabella */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 14 }}>
            <thead>
              <tr style={{ background: tint }}>
                {['Descrizione', 'Q.tà', 'Prezzo', 'Totale'].map((h, i) => (
                  <th key={h} style={{
                    padding: '7px 7px', textAlign: i === 0 ? 'left' : 'right',
                    fontSize: 9, fontWeight: 700, color: safeAccentColor,
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                    width: i === 0 ? undefined : i === 1 ? 34 : 64,
                    borderTopLeftRadius: i === 0 ? 6 : 0, borderBottomLeftRadius: i === 0 ? 6 : 0,
                    borderTopRightRadius: i === 3 ? 6 : 0, borderBottomRightRadius: i === 3 ? 6 : 0,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ITEMS.map((item, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #eef0f1' }}>
                  <td style={{ padding: '7px 7px', fontSize: 10, color: '#1e2830' }}>{item.description}</td>
                  <td style={{ padding: '7px 7px', fontSize: 12, textAlign: 'right', color: '#6c727a' }}>{item.qty}</td>
                  <td style={{ padding: '7px 7px', fontSize: 12, textAlign: 'right', color: '#6c727a' }}>{fmt(item.price)}&nbsp;€</td>
                  <td style={{ padding: '7px 7px', fontSize: 12, textAlign: 'right', fontWeight: 700, color: '#16202b' }}>{fmt(item.qty * item.price)}&nbsp;€</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totale a riquadro pieno */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ minWidth: 180, background: color, borderRadius: 9, padding: '11px 14px', color: onColor }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, marginBottom: 2, fontSize: 11, opacity: 0.82 }}>
                <span>Subtotale</span><span>{fmt(subtotal)}&nbsp;€</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, fontSize: 11, opacity: 0.82 }}>
                <span>IVA {VAT}%</span><span>{fmt(vatAmount)}&nbsp;€</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 20, borderTop: `1px solid ${colorAlpha(onColor, 0.28)}`, paddingTop: 7, marginTop: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.92 }}>Totale</span>
                <span style={{ fontSize: 17, fontWeight: 800, whiteSpace: 'nowrap' }}>{fmt(total)}&nbsp;€</span>
              </div>
            </div>
          </div>

          {legalNotice && (
            <p style={{ fontSize: 10, color: '#b3b1ab', borderTop: '1px solid #f0f0f0', paddingTop: 8, marginTop: 10, lineHeight: 1.5 }}>
              {legalNotice}
            </p>
          )}
        </div>

        {/* Footer */}
        <div style={{ borderTop: '1px solid #ebebeb', padding: '6px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <BrandingText />
          <span style={{ fontSize: 10, color: '#bbb' }}>Preventivo valido fino al {expiry}</span>
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // BOLD
  // ══════════════════════════════════════════════════════════════════════════
  if (presetKey === 'bold') {
    return (
      <div style={{ fontFamily: fontStack, fontSize: 14,color: '#111', background: '#fff', position: 'relative', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
        <Badge /><Watermark />

        {/* Header: dark full-width */}
        <div style={{ background: color, padding: '18px 22px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {isLogoRight ? (
            <>
              <div style={{ background: onColor, color: color, padding: '7px 14px', borderRadius: 5, fontSize: 12,fontWeight: 800, letterSpacing: '0.04em', whiteSpace: 'nowrap', flexShrink: 0 }}>
                PREVENTIVO #2026/047
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexDirection: 'row-reverse' }}>
                <LogoBox size={44} />
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 18,fontWeight: 800, color: onColor, lineHeight: 1.1 }}>{workspaceName}</div>
                  <div style={{ fontSize: 11,color: onColor, opacity: 0.65, marginTop: 3 }}>Via Garibaldi 42 · Milano · P.IVA 12345678901</div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <LogoBox size={44} />
                <div>
                  <div style={{ fontSize: 18,fontWeight: 800, color: onColor, lineHeight: 1.1 }}>{workspaceName}</div>
                  <div style={{ fontSize: 11,color: onColor, opacity: 0.65, marginTop: 3 }}>Via Garibaldi 42 · Milano · P.IVA 12345678901</div>
                </div>
              </div>
              {/* Badge pillola */}
              <div style={{ background: onColor, color: color, padding: '7px 14px', borderRadius: 5, fontSize: 12,fontWeight: 800, letterSpacing: '0.04em', whiteSpace: 'nowrap', flexShrink: 0 }}>
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
              <div style={{ fontSize: 13,fontWeight: 700, color: '#111' }}>Condominio Via Dante 12</div>
              <div style={{ fontSize: 11,color: '#666' }}>Via Dante 12, 20121 Milano (MI)</div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={LABEL_COMMON}>Numero preventivo</div>
              <div style={{ fontSize: 17,fontWeight: 800, color: '#111' }}>#2026/047</div>
              <div style={{ fontSize: 11,color: '#888', marginTop: 2 }}>C.F. CNDVDT12M20F205X</div>
            </div>
          </div>

          {/* Tabella */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10 }}>
            <thead>
              <tr style={{ background: colorAlpha(color, 0.09) }}>
                {['Descrizione lavori', 'Q.tà', 'Prezzo', 'Totale'].map((h, i) => (
                  <th key={h} style={{
                    padding: '6px 7px', textAlign: i === 0 ? 'left' : 'right',
                    fontSize: 10,fontWeight: 800, color: safeAccentColor,
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                    width: i === 0 ? undefined : i === 1 ? 30 : 58,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ITEMS.map((item, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '6px 7px', fontSize: 12,fontWeight: 500 }}>{item.description}</td>
                  <td style={{ padding: '6px 7px', fontSize: 12,textAlign: 'right', color: '#888' }}>{item.qty}</td>
                  <td style={{ padding: '6px 7px', fontSize: 12,textAlign: 'right', color: '#888' }}>{fmt(item.price)}&nbsp;€</td>
                  <td style={{ padding: '6px 7px', fontSize: 12,textAlign: 'right', fontWeight: 700 }}>{fmt(item.qty * item.price)}&nbsp;€</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Sub-totali */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
            <div style={{ minWidth: 150 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, marginBottom: 2 }}>
                <span style={{ fontSize: 11,color: '#999' }}>Subtotale</span>
                <span style={{ fontSize: 11,color: '#999' }}>{fmt(subtotal)}&nbsp;€</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24 }}>
                <span style={{ fontSize: 11,color: '#999' }}>IVA {VAT}%</span>
                <span style={{ fontSize: 11,color: '#999' }}>{fmt(vatAmount)}&nbsp;€</span>
              </div>
            </div>
          </div>

          {/* TOTALE box scuro */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ background: color, color: onColor, padding: '8px 14px', borderRadius: 6, textAlign: 'center', minWidth: 130 }}>
              <div style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.68, marginBottom: 2 }}>Totale da pagare</div>
              <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '0.01em', lineHeight: 1 }}>{fmt(total)}&nbsp;€</div>
            </div>
          </div>

          {legalNotice && (
            <p style={{ fontSize: 10,color: '#b3b1ab', borderTop: '1px solid #f0f0f0', paddingTop: 8, marginTop: 10, lineHeight: 1.5 }}>
              {legalNotice}
            </p>
          )}
        </div>

        {/* Footer */}
        <div style={{ borderTop: '1px solid #ebebeb', padding: '6px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <BrandingText />
          <span style={{ fontSize: 10,color: '#bbb' }}>Valido fino al {expiry}</span>
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
      <div style={{ fontFamily: fontStack, fontSize: 14,color: '#111', background: '#fff', position: 'relative', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
        <Badge /><Watermark />

        {/* Header: bianco, uppercase, bordo spesso */}
        <div style={{ padding: '16px 22px 12px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', borderBottom: `3px solid ${color}` }}>
          {isLogoRight ? (
            <>
              <div style={{ textAlign: 'left', flexShrink: 0 }}>
                <div style={{ fontSize: 10,fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.09em', color: '#888', marginBottom: 3 }}>Preventivo</div>
                <div style={{ fontSize: 20,fontWeight: 800, color: safeAccentColor, letterSpacing: '0.01em', lineHeight: 1 }}>#2026/047</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexDirection: 'row-reverse' as const }}>
                <LogoBox size={34} />
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14,fontWeight: 800, color: '#111', letterSpacing: '0.04em', textTransform: 'uppercase' as const, lineHeight: 1.2 }}>{workspaceName}</div>
                  <div style={{ fontSize: 8.5, color: '#888', marginTop: 2 }}>Via Garibaldi 42 · 20121 Milano · P.IVA 12345678901</div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <LogoBox size={34} />
                <div>
                  <div style={{ fontSize: 14,fontWeight: 800, color: '#111', letterSpacing: '0.04em', textTransform: 'uppercase' as const, lineHeight: 1.2 }}>{workspaceName}</div>
                  <div style={{ fontSize: 8.5, color: '#888', marginTop: 2 }}>Via Garibaldi 42 · 20121 Milano · P.IVA 12345678901</div>
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 10,fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.09em', color: '#888', marginBottom: 3 }}>Preventivo</div>
                <div style={{ fontSize: 20,fontWeight: 800, color: safeAccentColor, letterSpacing: '0.01em', lineHeight: 1 }}>#2026/047</div>
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
            { label: 'Totale IVA incl.', value: `${fmt(total)}\u00A0€`, accent: true },
          ].map((cell, i) => (
            <div key={i} style={{ padding: '7px 10px', borderRight: i < 3 ? '1px solid #e0e0e0' : undefined }}>
              <div style={LABEL_T}>{cell.label}</div>
              <div style={{ fontSize: 12,fontWeight: 600, color: cell.accent ? safeAccentColor : '#111' }}>{cell.value}</div>
            </div>
          ))}
        </div>

        {/* Body */}
        <div style={{ padding: '14px 22px' }}>
          {/* Tabella */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 0 }}>
            <thead>
              <tr style={{ background: color }}>
                {['Cod', 'Descrizione', 'U.M.', 'Q.tà', 'Prezzo', 'Tot.'].map((h, i) => (
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
                  <td style={{ padding: '6px 6px', fontSize: 11,color: '#aaa', verticalAlign: 'top', ...MONO }}>{String(i + 1).padStart(2, '0')}</td>
                  <td style={{ padding: '6px 6px', fontSize: 12,verticalAlign: 'top', lineHeight: 1.35 }}>
                    {item.description}<br />
                    <span style={{ fontSize: 12,fontWeight: 700, color: '#111', ...MONO }}>{fmt(item.qty * item.price)}&nbsp;€</span>
                  </td>
                  <td style={{ padding: '6px 6px', fontSize: 11,textAlign: 'right', color: '#888', verticalAlign: 'top' }}>cad</td>
                  <td style={{ padding: '6px 6px', fontSize: 11,textAlign: 'right', color: '#888', verticalAlign: 'top', ...MONO }}>1,00</td>
                  <td style={{ padding: '6px 6px', fontSize: 11,textAlign: 'right', color: '#888', verticalAlign: 'top', ...MONO }}>{fmt(item.price)}</td>
                  <td style={{ padding: '6px 6px', fontSize: 11,textAlign: 'right', verticalAlign: 'top' }}></td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totali full-width */}
          <div style={{ borderTop: '2px solid #e0e0e0', paddingTop: 10, marginTop: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
              <span style={{ fontSize: 11,fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#666' }}>Imponibile</span>
              <span style={{ fontSize: 12,color: '#666' }}>{fmt(subtotal)}&nbsp;€</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <span style={{ fontSize: 11,fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#666' }}>IVA {VAT}%</span>
              <span style={{ fontSize: 12,color: '#666' }}>{fmt(vatAmount)}&nbsp;€</span>
            </div>
            <div style={{ borderTop: `2px solid ${color}`, paddingTop: 7, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#111' }}>Totale preventivo</span>
              <span style={{ fontSize: 14,fontWeight: 800, color: '#111' }}>{fmt(total)}&nbsp;€</span>
            </div>
          </div>

          {legalNotice && (
            <p style={{ fontSize: 10,color: '#b3b1ab', borderTop: '1px solid #f0f0f0', paddingTop: 8, marginTop: 10, lineHeight: 1.5 }}>
              {legalNotice}
            </p>
          )}
        </div>

        {/* Footer */}
        <div style={{ borderTop: '1px solid #e5e5e5', padding: '6px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <BrandingText />
          <span style={{ fontSize: 10,color: '#bbb', ...MONO }}>Doc. #2026/047 · {todayS}</span>
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ELEGANTE — «Sartoriale» (Eli 20 ago): serif, testata a due livelli,
  // blocchi Da/Per, tabella a filetti, totale serif sotto un filetto colorato.
  // (default per preset sconosciuto). L'accento colora numero, filetti e labels.
  // ══════════════════════════════════════════════════════════════════════════
  const LABEL_E: React.CSSProperties = {
    fontSize: 9, fontWeight: 600, textTransform: 'uppercase',
    letterSpacing: '0.18em', color: safeAccentColor, marginBottom: 5,
  }
  const DATE_K: React.CSSProperties = {
    fontSize: 8, fontWeight: 600, textTransform: 'uppercase',
    letterSpacing: '0.15em', color: '#9aa0a6', marginBottom: 2,
  }
  const bizBlockE = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexDirection: isLogoRight ? 'row-reverse' : 'row', minWidth: 0 }}>
      <LogoBox size={44} bordered />
      <div style={{ textAlign: isLogoRight ? 'right' : 'left', minWidth: 0 }}>
        <div style={{ fontSize: 20, fontWeight: 600, color: '#22303c', lineHeight: 1.15 }}>{workspaceName}</div>
        <div style={{ fontSize: 10, color: '#8a8f96', marginTop: 2 }}>Via Garibaldi 42 · Milano · P.IVA 12345678901</div>
      </div>
    </div>
  )
  const idBlockE = (
    <div style={{ textAlign: 'right', flexShrink: 0, paddingTop: 4 }}>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.22em', textTransform: 'uppercase', color: safeAccentColor }}>Preventivo</div>
    </div>
  )

  return (
    <div style={{ fontFamily: fontStack, fontSize: 14, color: '#111', background: '#fff', position: 'relative', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
      <Badge /><Watermark />

      {/* Header a due livelli */}
      <div style={{ padding: '22px 26px 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 }}>
        {isLogoRight ? <>{idBlockE}{bizBlockE}</> : <>{bizBlockE}{idBlockE}</>}
      </div>
      <div style={{ height: 1, background: '#e7e5df', margin: '14px 26px 0' }} />

      {/* Body */}
      <div style={{ padding: '16px 26px' }}>

        {/* Titolo documento + date */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, marginBottom: 18, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 22, fontWeight: 600, color: '#22303c', lineHeight: 1, whiteSpace: 'nowrap' }}>N°&nbsp;<span style={{ color: safeAccentColor }}>014/2026</span></div>
          <div style={{ display: 'flex', gap: 20 }}>
            <div>
              <div style={DATE_K}>Data</div>
              <div style={{ fontSize: 12, color: '#2a333c', fontWeight: 600, whiteSpace: 'nowrap' }}>{today}</div>
            </div>
            <div>
              <div style={DATE_K}>Valido fino al</div>
              <div style={{ fontSize: 12, color: '#2a333c', fontWeight: 600, whiteSpace: 'nowrap' }}>{expiry}</div>
            </div>
          </div>
        </div>

        {/* Da / Per */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24, marginBottom: 18 }}>
          <div style={{ minWidth: 0 }}>
            <div style={LABEL_E}>Da</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#22303c' }}>{workspaceName}</div>
            <div style={{ fontSize: 10, color: '#6c727a', marginTop: 1 }}>Via Garibaldi 42, Milano (MI)</div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={LABEL_E}>Per</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#22303c' }}>Condominio Via Dante 12</div>
            <div style={{ fontSize: 10, color: '#6c727a', marginTop: 1 }}>Via Dante 12, 20121 Milano (MI)</div>
          </div>
        </div>

        {/* Tabella: filetti, accento sotto la testata */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${safeAccentColor}` }}>
              {['Descrizione', 'Q.tà', 'Prezzo', 'Totale'].map((h, i) => (
                <th key={h} style={{
                  padding: '4px 0 7px', paddingLeft: i > 0 ? 8 : 0,
                  textAlign: i === 0 ? 'left' : 'right',
                  fontSize: 8, fontWeight: 600, color: '#8a9098',
                  textTransform: 'uppercase', letterSpacing: '0.12em',
                  width: i === 0 ? undefined : i === 1 ? 30 : 60,
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ITEMS.map((item, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #efeee9' }}>
                <td style={{ padding: '7px 0', fontSize: 12, color: '#2a333c' }}>{item.description}</td>
                <td style={{ padding: '7px 0', paddingLeft: 8, fontSize: 12, textAlign: 'right', color: '#8a8f96' }}>{item.qty}</td>
                <td style={{ padding: '7px 0', paddingLeft: 8, fontSize: 12, textAlign: 'right', color: '#8a8f96' }}>{fmt(item.price)}&nbsp;€</td>
                <td style={{ padding: '7px 0', paddingLeft: 8, fontSize: 12, textAlign: 'right', fontWeight: 600, color: '#22303c' }}>{fmt(item.qty * item.price)}&nbsp;€</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totali serif */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ minWidth: 160 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, marginBottom: 3 }}>
              <span style={{ fontSize: 11, color: '#8a8f96' }}>Subtotale</span>
              <span style={{ fontSize: 11, color: '#6c727a' }}>{fmt(subtotal)}&nbsp;€</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24 }}>
              <span style={{ fontSize: 11, color: '#8a8f96' }}>IVA {VAT}%</span>
              <span style={{ fontSize: 11, color: '#6c727a' }}>{fmt(vatAmount)}&nbsp;€</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 24, borderTop: `2px solid ${safeAccentColor}`, paddingTop: 8, marginTop: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.16em', color: '#22303c' }}>Totale</span>
              <span style={{ fontSize: 19, fontWeight: 600, color: '#22303c' }}>{fmt(total)}&nbsp;€</span>
            </div>
          </div>
        </div>

        {legalNotice && (
          <p style={{ fontSize: 10, color: '#b3b1ab', borderTop: '1px solid #efeee9', paddingTop: 8, marginTop: 10, lineHeight: 1.5 }}>
            {legalNotice}
          </p>
        )}
      </div>

      {/* Footer */}
      <div style={{ borderTop: '1px solid #efeee9', padding: '7px 26px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <BrandingText color="#adb0b6" />
        <span style={{ fontSize: 10, color: '#adb0b6' }}>Valido fino al {expiry}</span>
      </div>
    </div>
  )
}
