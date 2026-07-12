// ============================================================
// GET /api/bilancio/export?from=YYYY-MM-DD&to=YYYY-MM-DD
// Esporta il bilancio (entrate + uscite) in CSV per il periodo scelto —
// formato pensato per il commercialista: separatore ";" (Excel italiano),
// BOM UTF-8, importi con la virgola. Feature Pro come il Bilancio.
// La logica è condivisa con l'area /studio (lib/fiscal/bilancio-csv.ts).
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { getSessionWorkspace } from '@/lib/workspace-context'
import { buildBilancioCsv } from '@/lib/fiscal/bilancio-csv'
import { isValidIsoDate } from '@/lib/csv'

export async function GET(request: NextRequest) {
  const { user, workspace, supabase } = await getSessionWorkspace()
  if (!user || !workspace) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  if (workspace.plan === 'free') {
    return NextResponse.json({ error: 'Il Bilancio è una funzione Pro.' }, { status: 403 })
  }

  const from = request.nextUrl.searchParams.get('from') ?? ''
  const to = request.nextUrl.searchParams.get('to') ?? ''
  if (!isValidIsoDate(from) || !isValidIsoDate(to) || from > to) {
    return NextResponse.json({ error: 'Intervallo di date non valido.' }, { status: 400 })
  }

  const csv = await buildBilancioCsv(supabase, workspace.id, workspace, from, to)
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="bilancio_${from}_${to}.csv"`,
    },
  })
}
