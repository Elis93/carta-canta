// ============================================================
// GET /api/studio/[workspaceId]/export?from&to
// Download del registro fatture da parte del COMMERCIALISTA.
// L'accesso è verificato dal link attivo (accountant_links) matchato
// sull'email confermata dell'utente — MAI dal solo parametro URL.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { getStudioUser, assertAccountantAccess } from '@/lib/studio'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildRegistroFattureCsv } from '@/lib/fiscal/registro-fatture'
import { isValidIsoDate } from '@/lib/csv'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const { workspaceId } = await params
  const user = await getStudioUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const ws = await assertAccountantAccess(user, workspaceId)
  if (!ws) return NextResponse.json({ error: 'Accesso non consentito' }, { status: 403 })

  const from = request.nextUrl.searchParams.get('from') ?? ''
  const to = request.nextUrl.searchParams.get('to') ?? ''
  if (!isValidIsoDate(from) || !isValidIsoDate(to) || from > to) {
    return NextResponse.json({ error: 'Intervallo di date non valido.' }, { status: 400 })
  }

  const csv = await buildRegistroFattureCsv(createAdminClient(), workspaceId, ws, from, to)
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="registro_fatture_${from}_${to}.csv"`,
    },
  })
}
