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
import { margineDocumento } from '@/lib/margine/calcolo'
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
}: {
  voci: VoceItem[]
  /** Sconto documento come stringhe grezze del form (stesse di fiscalOpts) */
  discountPct: string
  discountFixed: string
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
        <Lock size={12} style={{ color: VIOLA, flexShrink: 0 }} />
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: VIOLA, whiteSpace: 'nowrap' }}>
          Margine · solo tu lo vedi
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 15, fontWeight: 700, color: valColor, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
          {headerValue}
        </span>
        <ChevronDown
          size={15}
          style={{ color: '#8a86a8', flexShrink: 0, transition: 'transform .15s', transform: open ? 'rotate(180deg)' : 'none' }}
        />
      </button>

      {open && (
        <div style={{ borderTop: '1px solid #e4dff2', padding: '9px 13px 12px' }}>
          <Riga label={`Margine sulle voci con costo (${m.vociConCosto})`} value={fmtEuro(m.margineVoci)} color="#161616" />
          {m.scontoDocumento > 0 && (
            <Riga label="Sconto sul documento" value={`−${m.scontoDocumento.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`} color={ROSSO} />
          )}
          {m.vociSenzaCosto > 0 && (
            <Riga
              label={`${m.vociSenzaCosto === 1 ? '1 voce senza costo: non contata' : `${m.vociSenzaCosto} voci senza costo: non contate`}`}
              value="—"
              color="#b08d3e"
            />
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, borderTop: '1px solid #e4dff2', marginTop: 5, paddingTop: 8, fontSize: 13, fontWeight: 700, color: '#161616' }}>
            <span>Margine finale{negative ? ' — stai lavorando sotto costo' : ''}</span>
            <span style={{ color: valColor, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{headerValue}</span>
          </div>
          <p style={{ fontSize: 11.5, color: '#6a6488', lineHeight: 1.5, margin: '8px 0 0' }}>
            Si aggiorna mentre modifichi prezzi e sconto. Non compare mai su PDF, link per il cliente ed email.
            {m.marginePct == null && m.vociSenzaCosto > 0 ? ' La percentuale compare quando tutte le voci hanno un costo.' : ''}
          </p>
        </div>
      )}
    </div>
  )
}

function Riga({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12.5, padding: '4px 0', color: '#55534b' }}>
      <span>{label}</span>
      <span style={{ fontWeight: 600, color, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  )
}
