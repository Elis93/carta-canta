'use client'

// ============================================================
// "Margine — solo tu lo vedi" (PROGETTO_LISTINO_FORNITORE.md F1)
// Riquadro PRIVATO a tendina sotto il riepilogo del preventivo:
// chiuso = una riga con la cifra; aperto = dettaglio con lo
// sconto documento al suo posto (mai spalmato sulle voci).
// Compare SOLO se almeno una voce ha un costo: per chi non usa
// i costi la pagina resta identica (principio "invisibile").
// 🔒 Regola B.2: questi numeri non arrivano MAI al cliente —
// il componente vive solo nel form, dentro l'area (app).
// ============================================================

import { useEffect, useState } from 'react'
import { Lock, ChevronDown } from 'lucide-react'
import { margineDocumento, margineVoce } from '@/lib/margine/calcolo'
import { parseImportoIt } from '@/lib/utils'
import type { VoceItem } from './PreventivoForm'

// ── Campo costo della voce (traslocato QUI dalla card della voce, Eli 17 ago) ─
// Il Costo confondeva chi compila il primo preventivo («non è chiara la
// differenza tra prezzo, sconto e costo», collaudatori #3): era l'unico campo
// della voce che non riguarda il cliente. Ora arriva da solo da catalogo,
// listini e suggerimenti, e si vede/corregge solo qui — dove il concetto vive.
function CostoInput({ value, onChange }: { value: number | null; onChange: (n: number | null) => void }) {
  const fmt = (v: number | null) => v == null
    ? ''
    : v.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const [display, setDisplay] = useState(() => fmt(value))
  const [focused, setFocused] = useState(false)
  useEffect(() => {
    if (!focused) setDisplay(fmt(value))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, focused])
  return (
    <span className="relative" style={{ width: 92, flexShrink: 0, display: 'inline-block' }}>
      <input
        type="text"
        inputMode="decimal"
        value={display}
        placeholder="costo"
        aria-label="Costo d'acquisto della voce (solo per te)"
        onFocus={(e) => { setFocused(true); e.currentTarget.select() }}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^\d.,]/g, '')
          setDisplay(raw)
          if (raw.trim() === '') { onChange(null); return }
          const n = parseImportoIt(raw)
          if (!isNaN(n)) onChange(n > 0 ? n : null)
        }}
        onBlur={() => {
          setFocused(false)
          const n = parseImportoIt(display)
          if (display.trim() === '' || isNaN(n) || n <= 0) { setDisplay(''); onChange(null) }
          else { setDisplay(fmt(n)); onChange(n) }
        }}
        style={{
          width: '100%', height: 34, boxSizing: 'border-box', borderRadius: 9,
          border: '1px solid #d6d0e8', background: '#fff', padding: '0 18px 0 8px',
          fontSize: 13, fontVariantNumeric: 'tabular-nums', color: '#161616',
        }}
      />
      <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs pointer-events-none" style={{ color: '#8a84a3' }}>€</span>
    </span>
  )
}

const VIOLA = '#5a4f8a'
const VERDE = '#2f8a63'
const ROSSO = '#b05656'

function fmtEuro(v: number): string {
  const abs = Math.abs(v).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${v < 0 ? '−' : '+'}${abs} €`
}

export function MargineBox({
  voci,
  discountPct,
  discountFixed,
  tierLabel,
  onUpdateVoce,
}: {
  voci: VoceItem[]
  /** Sconto documento come stringhe grezze del form (stesse di fiscalOpts) */
  discountPct: string
  discountFixed: string
  /**
   * Con le proposte attive: nome della proposta a cui si riferisce QUESTO
   * margine (es. "Base"). Senza, scorrendo non si capisce che cambiando
   * linguetta cambia anche il margine (Eli, 7 ago).
   */
  tierLabel?: string | null
  /**
   * Aggiorna una voce per `_key` nel form. Dal 17 ago (Eli) il costo si
   * corregge QUI, non più nella card della voce: senza callback le righe
   * restano di sola lettura (compatibilità).
   */
  onUpdateVoce?: (key: string, updates: Partial<VoceItem>) => void
}) {
  const [open, setOpen] = useState(false)

  // Le righe "vuote" del form (nessuna descrizione, tutto a 0) non sono voci
  const meaningful = voci.filter(
    (v) => v.description.trim() !== '' || v.quantity > 0 || v.unit_price > 0
  )
  const m = margineDocumento(meaningful, {
    discount_pct: parseFloat(discountPct) || undefined,
    // Il campo sconto fisso del form è in formato it-IT ("1.250,00")
    discount_fixed: (() => { const n = parseImportoIt(discountFixed); return Number.isFinite(n) ? n : undefined })(),
  })

  if (m.vociConCosto === 0) return null

  const negative = m.margineFinale < 0
  const valColor = negative ? ROSSO : VERDE
  // La % (margine ÷ prezzo scontato) su una RIGA PROPRIA sotto l'euro (Eli,
  // 12 ago): prima era appiccicata all'euro con lo stesso stile e non si
  // leggeva. Compare solo se ogni voce ha un costo (altrimenti mezza verità).
  const pctStr = m.marginePct != null
    ? `${m.marginePct < 0 ? '−' : ''}${Math.abs(m.marginePct).toLocaleString('it-IT', { maximumFractionDigits: 1 })}% di margine`
    : null

  return (
    <div style={{ background: '#f6f4fb', border: '1px solid #dcd7ec', borderRadius: 12 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{
          display: 'flex', alignItems: 'center', gap: 7, width: '100%',
          padding: '12px 13px', background: 'none', border: 'none', cursor: 'pointer',
          fontFamily: 'inherit', textAlign: 'left',
        }}
      >
        {/* ⚠️ DUE blocchi, non quattro elementi in fila (Eli, 9 ago: *"la freccia
            per aprire il menu a tendina esce dalla sezione"*). Col nome della
            proposta il titolo diventa «Margine · Premium · solo tu lo vedi»:
            era `nowrap` e senza permesso di restringersi, quindi spingeva
            fuori dal riquadro la cifra e la freccia. Ora il titolo VA A CAPO
            dentro il suo blocco (`flex:1, minWidth:0`) e cifra e freccia
            stanno in un blocco che non si restringe mai. */}
        <span style={{ display: 'flex', alignItems: 'center', gap: 7, flex: 1, minWidth: 0 }}>
          <Lock size={12} style={{ color: VIOLA, flexShrink: 0 }} />
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: VIOLA, lineHeight: 1.35 }}>
            Margine{tierLabel ? ` · ${tierLabel}` : ''} · solo tu lo vedi
          </span>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
          {/* Euro sopra, % sotto — allineati a destra (colonna) */}
          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.2 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: valColor, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
              {fmtEuro(m.margineFinale)}
            </span>
            {pctStr && (
              <span style={{ fontSize: 11.5, fontWeight: 600, color: negative ? ROSSO : '#6a6488', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', marginTop: 1 }}>
                {pctStr}
              </span>
            )}
          </span>
          {/* 2 ago (Eli): la freccia era piccola e "quasi invisibile" a filo del
              bordo → più grande, viola pieno come il titolo */}
          <ChevronDown
            size={19}
            strokeWidth={2.4}
            style={{ color: VIOLA, flexShrink: 0, transition: 'transform .15s', transform: open ? 'rotate(180deg)' : 'none' }}
          />
        </span>
      </button>

      {/* 2 ago (Eli): "la stessa informazione ripetuta 3 volte" — il totale
          sta GIÀ nell'intestazione (sempre visibile): il dettaglio mostra la
          COMPOSIZIONE, una riga per voce col suo margine + lo sconto. */}
      {open && (
        <div style={{ borderTop: '1px solid #e4dff2', padding: '9px 13px 12px' }}>
          {/* Dal 17 ago (Eli) il COSTO si vede e si corregge QUI, non pi\u00F9 nella
              card della voce: una riga per voce con descrizione, campo costo e
              margine. Il costo arriva da solo da catalogo/listini; qui lo si
              controlla \u2014 e si completa dove manca, cos\u00EC compare anche la %. */}
          {onUpdateVoce && (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 10.5, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: '#8a84a3', padding: '2px 0 4px' }}>
              <span>Voce</span>
              <span style={{ display: 'flex', gap: 10 }}>
                <span style={{ width: 92 }}>Costo</span>
                <span>Margine</span>
              </span>
            </div>
          )}
          {meaningful.map((v, i) => {
            const mv = margineVoce(v)
            if (!onUpdateVoce) {
              return (
                <Riga
                  key={v._key}
                  label={v.description.trim() || `Voce ${i + 1}`}
                  value={mv ? fmtEuro(mv.margine) : 'senza costo'}
                  color={mv ? (mv.margine < 0 ? ROSSO : '#161616') : '#b08d3e'}
                  muted={!mv}
                />
              )
            }
            return (
              <div key={v._key} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, padding: '4px 0', color: '#55534b' }}>
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {v.description.trim() || `Voce ${i + 1}`}
                </span>
                <CostoInput
                  value={v.unit_cost ?? null}
                  onChange={(n) => onUpdateVoce(v._key, { unit_cost: n })}
                />
                <span style={{
                  width: 76, textAlign: 'right', fontWeight: 600, flexShrink: 0,
                  color: mv ? (mv.margine < 0 ? ROSSO : '#161616') : '#b8b3c9',
                  fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
                }}>
                  {mv ? fmtEuro(mv.margine) : '\u2014'}
                </span>
              </div>
            )
          })}
          {m.scontoDocumento > 0 && (
            <Riga label="Sconto sul documento" value={`\u2212${m.scontoDocumento.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} \u20AC`} color={ROSSO} />
          )}
          <p style={{ fontSize: 11.5, color: '#6a6488', lineHeight: 1.5, margin: '8px 0 0' }}>
            {negative ? 'Stai lavorando sotto costo. ' : ''}
            {onUpdateVoce
              ? 'Il costo \u00E8 quanto paghi tu (arriva da solo da catalogo e listini; qui lo correggi). Solo per i tuoi occhi: mai su PDF, link o email al cliente.'
              : 'Solo per i tuoi occhi: mai su PDF, link o email al cliente.'}
            {m.marginePct == null && m.vociSenzaCosto > 0 ? ' La % compare quando ogni voce ha un costo.' : ''}
          </p>
        </div>
      )}
    </div>
  )
}

function Riga({ label, value, color, muted = false }: { label: string; value: string; color: string; muted?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, fontSize: 12.5, padding: '4px 0', color: '#55534b' }}>
      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      <span style={{ fontWeight: muted ? 500 : 600, fontStyle: muted ? 'italic' : 'normal', color, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', flexShrink: 0 }}>{value}</span>
    </div>
  )
}
