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

export async function GET(request: NextRequest) {
  const { user, workspace, supabase } = await getSessionWorkspace()
  if (!user || !workspace) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const from = request.nextUrl.searchParams.get('from') ?? ''
  const to = request.nextUrl.searchParams.get('to') ?? ''
  if (!isValidIsoDate(from) || !isValidIsoDate(to) || from > to) {
    return NextResponse.json({ error: 'Intervallo di date non valido.' }, { status: 400 })
  }

  const csv = await buildRegistroFattureCsv(
    supabase,
    workspace.id,
    { name: workspace.name, ragione_sociale: workspace.ragione_sociale, piva: (workspace as { piva?: string | null }).piva },
    from,
    to
  )
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="registro_fatture_${from}_${to}.csv"`,
    },
  })
}
