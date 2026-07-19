// GET /api/agenda/busy?from=YYYY-MM-DD&to=YYYY-MM-DD
// Impegni (sopralluoghi + lavori con appuntamento) del workspace nel periodo,
// per mostrare i pallini "giorni occupati" e l'avviso nel form appuntamento.
// Sola lettura, scoped al workspace via getSessionWorkspace.

import { NextRequest, NextResponse } from 'next/server'
import { getSessionWorkspace } from '@/lib/workspace-context'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Giorno "YYYY-MM-DD" in ora italiana (coerente con l'Agenda). */
function dayKeyRome(iso: string): string {
  return new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' })
}
function timeRome(iso: string): string {
  return new Date(iso).toLocaleTimeString('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' })
}

export async function GET(request: NextRequest) {
  const { user, workspace, supabase } = await getSessionWorkspace()
  if (!user || !workspace) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  if (!from || !to || !DATE_RE.test(from) || !DATE_RE.test(to)) {
    return NextResponse.json({ error: 'Intervallo non valido' }, { status: 400 })
  }

  // Margine ±36h sul range (poi il giorno si calcola in ora di Roma)
  const fromIso = new Date(new Date(`${from}T12:00:00Z`).getTime() - 36 * 3_600_000).toISOString()
  const toIso = new Date(new Date(`${to}T12:00:00Z`).getTime() + 36 * 3_600_000).toISOString()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelle 047/048 non ancora in types/database.ts
  const db = supabase as any
  const q = (table: string) => db
    .from(table)
    .select('id, title, scheduled_at')
    .eq('workspace_id', workspace.id)
    .is('deleted_at', null)
    .not('scheduled_at', 'is', null)
    .gte('scheduled_at', fromIso)
    .lte('scheduled_at', toIso)
    .order('scheduled_at', { ascending: true })
    .limit(500)
    .then((r: { data: unknown[] | null }) => r.data)
    .catch(() => null)

  const [sopr, lav] = await Promise.all([q('sopralluoghi'), q('lavori')])

  type Row = { id: string; title: string | null; scheduled_at: string }
  const appointments = [
    ...((sopr ?? []) as Row[]).map((r) => ({ kind: 'sopralluogo' as const, ...r })),
    ...((lav ?? []) as Row[]).map((r) => ({ kind: 'lavoro' as const, ...r })),
  ]
    .filter((r) => r.scheduled_at)
    .map((r) => ({
      kind: r.kind,
      id: r.id,
      title: r.title ?? '',
      day: dayKeyRome(r.scheduled_at),
      time: timeRome(r.scheduled_at),
    }))
    .sort((a, b) => (a.day === b.day ? a.time.localeCompare(b.time) : a.day.localeCompare(b.day)))

  return NextResponse.json({ appointments })
}
