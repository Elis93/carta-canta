'use client'

// ============================================================
// Calcolatrice di cantiere — usata in tre punti:
//  • dal preventivo (prop onUse): ogni risultato ha "Usa" che riempie
//    la quantità della voce;
//  • dagli appunti del SOPRALLUOGO (prop onSnapshot + initial): "Salva"
//    consegna il calcolo COMPLETO (input + risultato) da conservare e
//    rimodificare; `initial` riapre la calcolatrice già compilata;
//  • dalla pagina /calcoli (senza prop): ogni risultato ha "Copia".
// Tutto lato client, nessun dato salvato qui. Matematica in lib/calc/calc.ts.
// ============================================================

import { useState } from 'react'
import { toast } from 'sonner'
import { parseImportoIt } from '@/lib/utils'
import { areaMq, volumeMc, piastrelle, verniceLitri } from '@/lib/calc/calc'
import type { CalcTab } from '@/lib/calc/misure'

type Tab = CalcTab

/** Calcolo completo consegnato da "Salva": input della linguetta + risultato. */
export interface CalcSnapshot {
  tab: Tab
  fields: Record<string, string>
  label: string
  value: number
  unit: string
  unitValue: string
  decimals: number
}

const TABS: { key: Tab; label: string }[] = [
  { key: 'superficie', label: 'Superficie' },
  { key: 'volume', label: 'Volume' },
  { key: 'piastrelle', label: 'Piastrelle' },
  { key: 'vernice', label: 'Vernice' },
]

const ORO = '#c9a44c'
const ORO_DEEP = '#b0863e'
const NAVY = '#1a1a2e'
const LINE = '#e3e3e6'

function num(s: string): number {
  const v = parseImportoIt(s.trim())
  return Number.isFinite(v) ? v : 0
}

function fmt(n: number, decimals = 2): string {
  return n.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: decimals })
}

// `unit` = etichetta mostrata (m², litri…); `unitValue` = valore salvato nel
// campo unità della voce (mq, mc, lt, pz) — così "Usa" imposta anche l'unità.
interface ResultRow { label: string; value: number; unit: string; unitValue: string; decimals?: number }

export function Calcolatrice({ onUse, onSnapshot, initial }: {
  onUse?: (value: number, unit?: string) => void
  /** Modalità sopralluogo: "Salva" consegna input+risultato (esclusiva con onUse) */
  onSnapshot?: (snap: CalcSnapshot) => void
  /** Riapre la calcolatrice già compilata (re-edit di una misura salvata) */
  initial?: { tab: Tab; fields: Record<string, string> }
}) {
  const [tab, setTab] = useState<Tab>(initial?.tab ?? 'superficie')

  // Campi (stringhe: formato italiano con la virgola). `initial` compila
  // SOLO i campi della sua linguetta (chiavi canoniche di fieldsForTab).
  const init = initial?.fields ?? {}
  const isSupVol = initial?.tab === 'superficie' || initial?.tab === 'volume'
  const [lungh, setLungh] = useState(isSupVol ? (init.lungh ?? '') : '')
  const [largh, setLargh] = useState(isSupVol ? (init.largh ?? '') : '')
  const [alt, setAlt] = useState(initial?.tab === 'volume' ? (init.alt ?? '') : '')
  const [scarto, setScarto] = useState(isSupVol ? (init.scarto ?? '') : '')
  // Piastrelle
  const [pArea, setPArea] = useState(initial?.tab === 'piastrelle' ? (init.area ?? '') : '')
  const [lato1, setLato1] = useState(initial?.tab === 'piastrelle' ? (init.lato1 ?? '') : '')
  const [lato2, setLato2] = useState(initial?.tab === 'piastrelle' ? (init.lato2 ?? '') : '')
  const [pScarto, setPScarto] = useState(initial?.tab === 'piastrelle' ? (init.scarto ?? '') : '')
  // Vernice
  const [vArea, setVArea] = useState(initial?.tab === 'vernice' ? (init.area ?? '') : '')
  const [mani, setMani] = useState(initial?.tab === 'vernice' ? (init.mani ?? '2') : '2')
  const [resa, setResa] = useState(initial?.tab === 'vernice' ? (init.resa ?? '10') : '10')

  /** Input correnti della linguetta attiva (chiavi canoniche, per il re-edit). */
  function fieldsForTab(): Record<string, string> {
    if (tab === 'superficie') return { lungh, largh, scarto }
    if (tab === 'volume') return { lungh, largh, alt, scarto }
    if (tab === 'piastrelle') return { area: pArea, lato1, lato2, scarto: pScarto }
    return { area: vArea, mani, resa }
  }

  let results: ResultRow[] = []
  if (tab === 'superficie') {
    const mq = areaMq(num(lungh), num(largh), num(scarto))
    results = mq > 0 ? [{ label: 'Superficie', value: mq, unit: 'm²', unitValue: 'mq' }] : []
  } else if (tab === 'volume') {
    const mc = volumeMc(num(lungh), num(largh), num(alt), num(scarto))
    results = mc > 0 ? [{ label: 'Volume', value: mc, unit: 'm³', unitValue: 'mc' }] : []
  } else if (tab === 'piastrelle') {
    const r = piastrelle(num(pArea), num(lato1), num(lato2), num(pScarto))
    results = r.mq > 0
      ? [
          { label: 'Piastrelle', value: r.pezzi, unit: 'pz', unitValue: 'pz', decimals: 0 },
          { label: 'Superficie con scarto', value: r.mq, unit: 'm²', unitValue: 'mq' },
        ]
      : []
  } else {
    const l = verniceLitri(num(vArea), num(mani), num(resa))
    results = l > 0 ? [{ label: 'Vernice', value: l, unit: 'litri', unitValue: 'lt', decimals: 1 }] : []
  }

  // Riporto dell'area: se calcoli la Superficie e poi passi a Piastrelle/Vernice,
  // ritrovi già scritta la superficie (solo se il campo è vuoto, resta modificabile).
  // Si riporta l'area BASE (senza scarto): lo scarto si applica nella linguetta
  // di destinazione, altrimenti chi lo riscrive lì lo conterebbe due volte.
  function goTab(t: Tab) {
    if (t === 'piastrelle' || t === 'vernice') {
      const a = areaMq(num(lungh), num(largh), 0)
      if (a > 0) {
        if (t === 'piastrelle' && !pArea.trim()) setPArea(fmt(a, 2))
        if (t === 'vernice' && !vArea.trim()) setVArea(fmt(a, 2))
      }
    }
    setTab(t)
  }

  function copy(value: number, decimals: number) {
    const txt = fmt(value, decimals).replace(/\./g, '')
    navigator.clipboard?.writeText(txt).then(
      () => toast.success('Copiato'),
      () => toast.error('Copia non riuscita')
    )
  }

  return (
    <div>
      {/* Linguette */}
      <div style={{ display: 'flex', background: '#efece5', borderRadius: 11, padding: 3, gap: 2, marginBottom: 14 }}>
        {TABS.map((t) => {
          const on = tab === t.key
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => goTab(t.key)}
              style={{
                flex: 1, textAlign: 'center', fontSize: 12.5, fontWeight: 600,
                color: on ? NAVY : 'var(--cc-muted)', background: on ? '#fff' : 'transparent',
                boxShadow: on ? '0 1px 2px rgba(20,20,40,.08)' : 'none',
                borderRadius: 9, padding: '8px 0', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Campi per linguetta */}
      {(tab === 'superficie' || tab === 'volume') && (
        <>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Field value={lungh} onChange={setLungh} unit="lungh. m" placeholder="0" />
            <span style={{ color: 'var(--cc-muted)', fontSize: 18 }}>×</span>
            <Field value={largh} onChange={setLargh} unit="largh. m" placeholder="0" />
            {tab === 'volume' && (
              <>
                <span style={{ color: 'var(--cc-muted)', fontSize: 18 }}>×</span>
                <Field value={alt} onChange={setAlt} unit="alt. m" placeholder="0" />
              </>
            )}
          </div>
          <ScartoField value={scarto} onChange={setScarto} />
        </>
      )}

      {tab === 'piastrelle' && (
        <>
          <Field value={pArea} onChange={setPArea} unit="superficie m²" placeholder="0" full />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
            <Field value={lato1} onChange={setLato1} unit="lato cm" placeholder="60" />
            <span style={{ color: 'var(--cc-muted)', fontSize: 18 }}>×</span>
            <Field value={lato2} onChange={setLato2} unit="lato cm" placeholder="60" />
          </div>
          <ScartoField value={pScarto} onChange={setPScarto} />
        </>
      )}

      {tab === 'vernice' && (
        <>
          <Field value={vArea} onChange={setVArea} unit="superficie m²" placeholder="0" full />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <Field value={mani} onChange={setMani} unit="mani" placeholder="2" />
            <Field value={resa} onChange={setResa} unit="resa m²/l" placeholder="10" />
          </div>
        </>
      )}

      {/* Risultati */}
      {results.length > 0 ? (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {results.map((r) => (
            <div key={r.label} style={{ background: '#f6f0e2', border: '1px solid #e6dcc2', borderRadius: 11, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: ORO_DEEP, fontWeight: 600, letterSpacing: '.03em' }}>{r.label}</div>
                <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 22, fontWeight: 600, color: NAVY }}>
                  {fmt(r.value, r.decimals ?? 2)} <span style={{ fontSize: 14, color: ORO_DEEP }}>{r.unit}</span>
                </div>
              </div>
              {onSnapshot ? (
                <button type="button"
                  onClick={() => onSnapshot({ tab, fields: fieldsForTab(), label: r.label, value: r.value, unit: r.unit, unitValue: r.unitValue, decimals: r.decimals ?? 2 })}
                  style={{ flexShrink: 0, border: 'none', borderRadius: 10, background: NAVY, color: '#fff', fontSize: 13, fontWeight: 600, padding: '9px 14px', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Salva
                </button>
              ) : onUse ? (
                <button type="button" onClick={() => onUse(r.value, r.unitValue)}
                  style={{ flexShrink: 0, border: 'none', borderRadius: 10, background: NAVY, color: '#fff', fontSize: 13, fontWeight: 600, padding: '9px 14px', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Usa
                </button>
              ) : (
                <button type="button" onClick={() => copy(r.value, r.decimals ?? 2)}
                  style={{ flexShrink: 0, border: '1px solid ' + LINE, borderRadius: 10, background: '#fff', color: NAVY, fontSize: 13, fontWeight: 600, padding: '9px 14px', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Copia
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p style={{ marginTop: 14, fontSize: 13, color: 'var(--cc-muted)', lineHeight: 1.5 }}>
          Scrivi le misure qui sopra: il risultato compare qui.
        </p>
      )}

      {tab === 'piastrelle' && (
        <p style={{ fontSize: 11.5, color: 'var(--cc-muted)', lineHeight: 1.45, margin: '12px 0 0', background: '#faf7f0', border: '1px solid #eee3cc', borderRadius: 9, padding: '9px 11px' }}>
          Pezzi calcolati dal formato della piastrella. Controlla sempre le indicazioni della scatola.
        </p>
      )}
      {tab === 'vernice' && (
        <p style={{ fontSize: 11.5, color: 'var(--cc-muted)', lineHeight: 1.45, margin: '12px 0 0', background: '#faf7f0', border: '1px solid #eee3cc', borderRadius: 9, padding: '9px 11px' }}>
          Resa indicativa: quella reale è sulla latta. Con fondi assorbenti serve più prodotto.
        </p>
      )}
    </div>
  )
}

// ── Campi ───────────────────────────────────────────────────────────────────
function Field({ value, onChange, unit, placeholder, full }: {
  value: string; onChange: (v: string) => void; unit: string; placeholder?: string; full?: boolean
}) {
  return (
    <div style={{ flex: full ? undefined : 1, width: full ? '100%' : undefined, minWidth: 0, position: 'relative' }}>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ''))}
        inputMode="decimal"
        placeholder={placeholder}
        style={{ width: '100%', boxSizing: 'border-box', border: '1px solid ' + LINE, borderRadius: 10, height: 42, padding: '0 58px 0 12px', fontSize: 15, fontFamily: 'inherit', color: '#161616', background: '#fff' }}
      />
      <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--cc-muted)', pointerEvents: 'none' }}>{unit}</span>
    </div>
  )
}

function ScartoField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 10, fontSize: 13, color: '#55534b' }}>
      <span>+ scarto</span>
      <div style={{ position: 'relative', width: 84 }}>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ''))}
          inputMode="decimal"
          placeholder="0"
          style={{ width: '100%', boxSizing: 'border-box', border: '1px solid ' + LINE, borderRadius: 9, height: 38, padding: '0 26px 0 10px', fontSize: 14, fontFamily: 'inherit', color: '#161616', background: '#fff' }}
        />
        <span style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--cc-muted)', pointerEvents: 'none' }}>%</span>
      </div>
      <span style={{ color: 'var(--cc-muted)' }}>per tagli e sfridi</span>
    </div>
  )
}
