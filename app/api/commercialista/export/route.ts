// ============================================================
// GET /api/commercialista/export?from=YYYY-MM-DD&to=YYYY-MM-DD
// "Pacchetto commercialista" — registro CSV delle fatture emesse del
// PROPRIO workspace (l'artigiano lo scarica e lo manda al commercialista).
// La costruzione del CSV è in lib/fiscal/registro-fatture.ts (condivisa
// con l'area /studio del commercialista). Disponibile a tutti i piani.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { getSessionWorkspace } from '@/lib/workspace-context'
import { buildRegistroFattureCsv } from '@/lib/fiscal/registro-fatture'
import { isValidIsoDate } from '@/lib/csv'
import { guardExport } from '@/lib/security/export-guard'

export async function GET(request: NextRequest) {
  const { user, workspace, supabase } = await getSessionWorkspace()
  if (!user || !workspace) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  // Freno e traccia sugli export massivi (audit 5 ago).
  const bloccato = await guardExport({ userId: user.id, workspaceId: workspace.id, what: 'registro-fatture' })
  if (bloccato) return bloccato

  const from = request.nextUrl.searchParams.get('from') ?? ''
  const to = request.nextUrl.searchParams.get('to') ?? ''
  if (!isValidIsoDate(from) || !isValidIsoDate(to) || from > to) {
    return NextResponse.json({ error: 'Intervallo di date non valido.' }, { status: 400 })
  }

  let csv: string
  try {
    csv = await buildRegistroFattureCsv(
      supabase,
      workspace.id,
      { name: workspace.name, ragione_sociale: workspace.ragione_sociale, piva: (workspace as { piva?: string | null }).piva },
      from,
      to
    )
  } catch (err) {
    // I builder lanciano se non riescono a leggere TUTTO: meglio un
    // messaggio chiaro che un file fiscale incompleto.
    console.error('[export] registro non riuscito:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Esportazione non riuscita. Riprova tra qualche secondo.' },
      { status: 500 },
    )
  }
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="registro_fatture_${from}_${to}.csv"`,
    },
  })
}
