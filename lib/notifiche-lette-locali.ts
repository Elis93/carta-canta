// ── Memoria LOCALE delle notifiche appena lette (25 ago 2026) ───────────────
//
// Il tocco su una notifica la marca letta sul server, ma la Home può tornare
// a schermo dalla cache del router PRIMA che la versione fresca arrivi: la
// campanella mostrava ancora «1» su una notifica appena letta (collaudo Eli).
// La revalidation resta (è la via maestra); questa è la RETE: le chiavi lette
// si segnano anche qui e il conteggio le sottrae comunque, qualunque sia lo
// stato della cache. sessionStorage = per scheda, si svuota da sé; il server
// resta la fonte di verità alla prossima lettura fresca.

const KEY = 'cc_notif_lette'
const MAX = 120

export function segnaLettaLocale(...keys: string[]): void {
  try {
    const raw = sessionStorage.getItem(KEY)
    const prev: string[] = raw ? JSON.parse(raw) : []
    const next = [...new Set([...prev, ...keys])].slice(-MAX)
    sessionStorage.setItem(KEY, JSON.stringify(next))
  } catch { /* storage bloccato: resta la sola revalidation */ }
}

export function letteLocali(): Set<string> {
  try {
    const raw = sessionStorage.getItem(KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

/** Applica le letture locali a una lista arrivata dal server (magari stantia). */
export function applicaLetteLocali<T extends { key: string; read: boolean }>(list: T[]): T[] {
  const set = letteLocali()
  if (set.size === 0) return list
  return list.map((n) => (!n.read && set.has(n.key) ? { ...n, read: true } : n))
}
