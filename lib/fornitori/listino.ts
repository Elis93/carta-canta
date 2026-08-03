// ============================================================
// Listini fornitori (Fase 2, PROGETTO_LISTINO_FORNITORE.md) —
// logica PURA: prezzo di vendita proposto dal ricarico e matching
// del RINNOVO listino (flusso F: reimport → abbina le voci →
// aggiorna i costi → riepilogo "N voci rincarate, media +X%").
// 🔒 B.2: tutto ciò che passa da qui è PRIVATO dell'artigiano.
// ============================================================

const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100

/**
 * Prezzo di vendita PROPOSTO = costo + ricarico % del fornitore.
 * Sempre modificabile dall'artigiano: è una proposta, non un automatismo.
 * Ritorna null se il ricarico non è impostato o il costo non è valido.
 */
export function prezzoProposto(unitCost: number, markupPct: number | null | undefined): number | null {
  if (!Number.isFinite(unitCost) || unitCost < 0) return null
  if (markupPct == null || !Number.isFinite(markupPct) || markupPct < 0) return null
  return round2(unitCost * (1 + markupPct / 100))
}

// ── Rinnovo listino ─────────────────────────────────────────────────────

export interface ListinoItemEsistente {
  id: string
  code: string | null
  description: string
  unit_cost: number
}

export interface ListinoItemImportata {
  code?: string | null
  description: string
  unit: string
  unit_cost: number
}

export interface EsitoRinnovo {
  /** Voci esistenti abbinate: costo da aggiornare (incluse quelle invariate) */
  updates: Array<{ id: string; unit_cost: number }>
  /** Voci del nuovo import senza corrispondenza: da inserire */
  additions: ListinoItemImportata[]
  stats: {
    matched: number
    added: number
    /** Voci abbinate col costo AUMENTATO */
    increased: number
    /** Media % di aumento sulle sole voci rincarate (null se nessuna) */
    avgIncreasePct: number | null
  }
}

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ')

/**
 * Abbina il nuovo import alle voci esistenti del listino:
 * 1) per CODICE articolo (se entrambi ce l'hanno),
 * 2) altrimenti per descrizione normalizzata.
 * Ogni voce esistente è abbinata al massimo una volta.
 */
export function matchRinnovo(
  existing: ListinoItemEsistente[],
  imported: ListinoItemImportata[]
): EsitoRinnovo {
  const byCode = new Map<string, ListinoItemEsistente>()
  const byDesc = new Map<string, ListinoItemEsistente>()
  for (const ex of existing) {
    const c = norm(ex.code)
    if (c && !byCode.has(c)) byCode.set(c, ex)
    const d = norm(ex.description)
    if (d && !byDesc.has(d)) byDesc.set(d, ex)
  }

  const usati = new Set<string>()
  const updates: EsitoRinnovo['updates'] = []
  const additions: ListinoItemImportata[] = []
  const increasesPct: number[] = []

  for (const imp of imported) {
    const c = norm(imp.code)
    const d = norm(imp.description)
    let match: ListinoItemEsistente | undefined
    if (c && byCode.has(c) && !usati.has(byCode.get(c)!.id)) match = byCode.get(c)
    else if (d && byDesc.has(d) && !usati.has(byDesc.get(d)!.id)) match = byDesc.get(d)

    if (match) {
      usati.add(match.id)
      const nuovo = round2(imp.unit_cost)
      updates.push({ id: match.id, unit_cost: nuovo })
      if (match.unit_cost > 0 && nuovo > match.unit_cost) {
        increasesPct.push(((nuovo - match.unit_cost) / match.unit_cost) * 100)
      }
    } else {
      additions.push(imp)
    }
  }

  return {
    updates,
    additions,
    stats: {
      matched: updates.length,
      added: additions.length,
      increased: increasesPct.length,
      avgIncreasePct: increasesPct.length
        ? Math.round((increasesPct.reduce((a, b) => a + b, 0) / increasesPct.length) * 10) / 10
        : null,
    },
  }
}

/** Riepilogo leggibile del rinnovo: "3 voci aggiornate (2 rincarate, media +6,0%) · 1 voce nuova" */
export function riepilogoRinnovo(stats: EsitoRinnovo['stats']): string {
  const parts: string[] = []
  if (stats.matched > 0) {
    const rincaro = stats.increased > 0 && stats.avgIncreasePct != null
      ? ` (${stats.increased} rincarat${stats.increased === 1 ? 'a' : 'e'}, media +${stats.avgIncreasePct.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%)`
      : ''
    parts.push(`${stats.matched} voc${stats.matched === 1 ? 'e aggiornata' : 'i aggiornate'}${rincaro}`)
  }
  if (stats.added > 0) parts.push(`${stats.added} voc${stats.added === 1 ? 'e nuova' : 'i nuove'}`)
  return parts.join(' · ') || 'Nessuna voce importata'
}

/** Giorni (interi, arrotondati per difetto) da oggi a valid_until; negativo = scaduto. */
export function giorniAllaScadenza(validUntil: string, oggi: Date = new Date()): number {
  const end = new Date(`${validUntil}T23:59:59`)
  return Math.floor((end.getTime() - oggi.getTime()) / 86_400_000)
}
