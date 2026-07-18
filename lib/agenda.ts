// ── Agenda di oggi (Home) ──────────────────────────────────────────────────
// Appuntamenti della GIORNATA (ora italiana): sopralluoghi con appuntamento
// e lavori con "prossimo intervento". Stessa logica della pagina /calendario
// (query con margine di fuso ±36h, poi filtro sul giorno Roma) — qui limitata
// a oggi per la card in Home. Tollerante pre-migration (047/048/049).

import type { createClient } from '@/lib/supabase/server'

type ServerClient = Awaited<ReturnType<typeof createClient>>

export interface AgendaEvent {
  kind: 'sopralluogo' | 'lavoro'
  id: string
  title: string
  scheduled_at: string
  clients: { name: string | null; surname: string | null } | null
}

/** Chiave giorno (YYYY-MM-DD) nel fuso di Roma. */
export const romeDayKey = (x: Date) => x.toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' })

/** "08:30" nel fuso di Roma. */
export function romeTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' })
}

export interface TodayAgenda {
  events: AgendaEvent[]
  /** true se esiste ALMENO un appuntamento futuro (anche oltre oggi):
   *  distingue "agenda vuota del tutto" (CTA primo appuntamento) da
   *  "oggi libero ma c'è altro in agenda". */
  hasUpcoming: boolean
}

export async function getTodayEvents(
  supabase: ServerClient,
  workspaceId: string
): Promise<TodayAgenda> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelle 047/048/049 non ancora in types/database.ts
  const db = supabase as any
  const nowIso = new Date().toISOString()
  const from = new Date(Date.now() - 36 * 3_600_000).toISOString()
  const to = new Date(Date.now() + 36 * 3_600_000).toISOString()

  const select = 'id, title, scheduled_at, clients ( name, surname )'
  const countUpcoming = (table: string) =>
    db
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .gte('scheduled_at', nowIso)
      .then((r: { count: number | null }) => r.count ?? 0)
      .catch(() => 0) // migration non applicata
  const [sopralluoghiRes, lavoriRes, upcomingSop, upcomingLav] = await Promise.all([
    db
      .from('sopralluoghi')
      .select(select)
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .not('scheduled_at', 'is', null)
      .gte('scheduled_at', from)
      .lte('scheduled_at', to)
      .order('scheduled_at', { ascending: true })
      .limit(30)
      .then((r: { data: unknown[] | null }) => r.data)
      .catch(() => null), // migration 047 non applicata
    db
      .from('lavori')
      .select(select)
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .not('scheduled_at', 'is', null)
      .gte('scheduled_at', from)
      .lte('scheduled_at', to)
      .order('scheduled_at', { ascending: true })
      .limit(30)
      .then((r: { data: unknown[] | null }) => r.data)
      .catch(() => null), // migration 048/049 non applicata
    countUpcoming('sopralluoghi'),
    countUpcoming('lavori'),
  ])

  const today = romeDayKey(new Date())
  const events: AgendaEvent[] = []
  for (const r of ((sopralluoghiRes ?? []) as Array<Omit<AgendaEvent, 'kind'>>)) events.push({ kind: 'sopralluogo', ...r })
  for (const r of ((lavoriRes ?? []) as Array<Omit<AgendaEvent, 'kind'>>)) events.push({ kind: 'lavoro', ...r })
  return {
    events: events
      .filter((e) => romeDayKey(new Date(e.scheduled_at)) === today)
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()),
    hasUpcoming: (upcomingSop as number) + (upcomingLav as number) > 0,
  }
}
