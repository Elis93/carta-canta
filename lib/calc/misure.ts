// ============================================================
// Misure calcolate del sopralluogo (migration 054, colonna JSONB).
// Ogni misura conserva GLI INPUT (fields) oltre al risultato: toccandola
// in app si riapre la calcolatrice già compilata e si può rimodificare
// (richiesta Eli 18 lug). Modulo PURO: usato dal form (client), dalle
// server action e dal rendering testo per le Note interne del preventivo.
// ============================================================

export type CalcTab = 'superficie' | 'volume' | 'piastrelle' | 'vernice'

export interface Misura {
  id: string
  tab: CalcTab
  /** Input della calcolatrice così come digitati (formato IT), per il re-edit */
  fields: Record<string, string>
  label: string
  /** Descrizione degli input, es. "4 × 3,5 m +10% scarto" */
  detail: string
  value: number
  unit: string
  decimals: number
}

const TABS: readonly string[] = ['superficie', 'volume', 'piastrelle', 'vernice']
export const MAX_MISURE = 40

export function fmtMisura(value: number, decimals = 2): string {
  return value.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: decimals })
}

/** Valida/ripulisce il JSON delle misure (dal form o dal DB). Tollerante: scarta le voci malformate. */
export function parseMisure(raw: unknown): Misura[] {
  let v = raw
  if (typeof v === 'string') {
    if (!v.trim()) return []
    try { v = JSON.parse(v) } catch { return [] }
  }
  if (!Array.isArray(v)) return []
  const out: Misura[] = []
  for (const m of v.slice(0, MAX_MISURE)) {
    if (!m || typeof m !== 'object') continue
    const o = m as Record<string, unknown>
    if (typeof o.id !== 'string' || !o.id) continue
    if (!TABS.includes(o.tab as string)) continue
    if (typeof o.label !== 'string' || typeof o.detail !== 'string') continue
    const value = Number(o.value)
    if (!Number.isFinite(value)) continue
    const fields: Record<string, string> = {}
    if (o.fields && typeof o.fields === 'object' && !Array.isArray(o.fields)) {
      for (const [k, val] of Object.entries(o.fields as Record<string, unknown>).slice(0, 8)) {
        if (typeof val === 'string') fields[k.slice(0, 20)] = val.slice(0, 20)
      }
    }
    const decimals = Number(o.decimals)
    out.push({
      id: o.id.slice(0, 40),
      tab: o.tab as CalcTab,
      fields,
      label: o.label.slice(0, 60),
      detail: o.detail.slice(0, 160),
      value,
      unit: typeof o.unit === 'string' ? o.unit.slice(0, 10) : '',
      decimals: Number.isFinite(decimals) ? Math.min(3, Math.max(0, Math.trunc(decimals))) : 2,
    })
  }
  return out
}

/** Riga leggibile di una misura: "Superficie: 4 × 3,5 m +10% scarto = 15,40 m²". */
export function misuraText(m: Misura): string {
  return `${m.label}: ${m.detail} = ${fmtMisura(m.value, m.decimals)} ${m.unit}`
}

/** Blocco testo per le Note interne del preventivo (trasformazione sopralluogo). */
export function misureToNotes(misure: Misura[]): string {
  if (misure.length === 0) return ''
  return 'Misure calcolate:\n' + misure.map((m) => `• ${misuraText(m)}`).join('\n')
}
