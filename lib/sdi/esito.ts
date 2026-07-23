// ============================================================
// Esiti SDI — mappatura dei tipi di notifica e parsing TOLLERANTE
// delle risposte/payload OpenAPI (la forma esatta non è documentata
// pubblicamente: si estrae in modo difensivo e si LOGGA ciò che non
// si riconosce, per calibrare in sandbox — stesso metodo dei 4 fix
// di integrazione del 22 lug).
//
// Tipi di notifica SdI (fatture EMESSE, evento 'customer-notification'):
//   RC = ricevuta di consegna            → consegnata
//   MC = mancata consegna                → mancata_consegna (fattura valida)
//   AT = attestazione con impossibilità  → mancata_consegna
//   NS = notifica di scarto              → scartata
//   DT = decorrenza termini              → consegnata (processo concluso, valida)
//   NE = esito committente (B2B acc/rif) → non gestito in fase 1 (null)
// ============================================================

import type { SdiEsito } from './types'

export function mapNotificationType(t: string): SdiEsito | null {
  switch (t.trim().toUpperCase()) {
    case 'RC': return 'consegnata'
    case 'DT': return 'consegnata'
    case 'MC': return 'mancata_consegna'
    case 'AT': return 'mancata_consegna'
    case 'NS': return 'scartata'
    default: return null // NE e sconosciuti
  }
}

const TYPE_KEY = /^(type|tipo|notification(_type)?|tipo_notifica)$/i
const MSG_KEY = /^(message|description|descrizione|motivo|error|detail)$/i
const UUID_KEY = /^(uuid|id|invoice_uuid|uuid_invoice|invoice_id|id_invoice)$/i
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const NOTIF_TYPES = new Set(['RC', 'MC', 'AT', 'NS', 'DT', 'NE'])

function walk(node: unknown, depth: number, visit: (obj: Record<string, unknown>) => void): void {
  if (depth > 4 || node === null || typeof node !== 'object') return
  if (Array.isArray(node)) {
    for (const item of node) walk(item, depth + 1, visit)
    return
  }
  const obj = node as Record<string, unknown>
  visit(obj)
  for (const v of Object.values(obj)) walk(v, depth + 1, visit)
}

/**
 * Cerca nel JSON i tipi di notifica SdI e ritorna l'esito complessivo.
 * Priorità: NS (scarto, terminale) > RC > DT > MC/AT — così un retry
 * andato a buon fine (RC dopo MC) vince sulla mancata consegna.
 */
export function extractNotificationEsito(json: unknown): { esito: SdiEsito; message: string | null } | null {
  const found: Array<{ type: string; message: string | null }> = []
  walk(json, 0, (obj) => {
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'string' && TYPE_KEY.test(k) && NOTIF_TYPES.has(v.trim().toUpperCase())) {
        let message: string | null = null
        for (const [mk, mv] of Object.entries(obj)) {
          if (typeof mv === 'string' && mv.trim() && MSG_KEY.test(mk)) { message = mv.slice(0, 500); break }
        }
        found.push({ type: v.trim().toUpperCase(), message })
      }
    }
  })
  if (found.length === 0) return null
  const byType = (t: string) => found.find((f) => f.type === t)
  const pick = byType('NS') ?? byType('RC') ?? byType('DT') ?? byType('MC') ?? byType('AT')
  if (!pick) return null // solo NE: esito committente, non gestito in fase 1
  const esito = mapNotificationType(pick.type)
  return esito ? { esito, message: pick.message } : null
}

/** UUID candidati (id fattura presso il provider) trovati nel payload. */
export function extractUuidCandidates(json: unknown): string[] {
  const withInvoiceKey: string[] = []
  const others: string[] = []
  walk(json, 0, (obj) => {
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'string' && UUID_KEY.test(k) && UUID_RE.test(v.trim())) {
        (/invoice/i.test(k) ? withInvoiceKey : others).push(v.trim())
      }
    }
  })
  // Prima i campi che nominano la fattura, poi gli altri; dedup mantenendo l'ordine.
  return [...new Set([...withInvoiceKey, ...others])]
}
