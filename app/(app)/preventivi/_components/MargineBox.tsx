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

import { useState } from 'react'
import { Lock, ChevronDown } from 'lucide-react'
import { margineDocumento, margineVoce } from '@/lib/margine/calcolo'
import { parseImportoIt } from '@/lib/utils'
import type { VoceItem } from './PreventivoForm'

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
  const headerValue = `${fmtEuro(m.margineFinale)}${m.marginePct != null ? ` · ${m.marginePct.toLocaleString('it-IT', { maximumFractionDigits: 1 })}%` : ''}`

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
          <span style={{ fontSize: 15, fontWeight: 700, color: valColor, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
            {headerValue}
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
          {meaningful.map((v, i) => {
            const mv = margineVoce(v)
            return (
              <Riga
                key={v._key}
                label={v.description.trim() || `Voce ${i + 1}`}
                value={mv ? fmtEuro(mv.margine) : 'senza costo'}
                color={mv ? (mv.margine < 0 ? ROSSO : '#161616') : '#b08d3e'}
                muted={!mv}
              />
            )
          })}
          {m.scontoDocumento > 0 && (
            <Riga label="Sconto sul documento" value={`\u2212${m.scontoDocumento.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} \u20AC`} color={ROSSO} />
          )}
          <p style={{ fontSize: 11.5, color: '#6a6488', lineHeight: 1.5, margin: '8px 0 0' }}>
            {negative ? 'Stai lavorando sotto costo. ' : ''}
            Solo per i tuoi occhi: mai su PDF, link o email al cliente.
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
