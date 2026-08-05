// ============================================================
// GET /api/studio/[workspaceId]/export-bilancio?from&to
// Download del bilancio (entrate/uscite per cassa) da parte del
// COMMERCIALISTA. Stessa verifica dell'export registro: l'accesso
// deriva dal link attivo (accountant_links) matchato sull'email
// confermata dell'utente — MAI dal solo parametro URL.
// Nessun gate di piano: sono i dati del cliente che l'ha invitato
// (per gli account Free le uscite saranno semplicemente vuote).
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { getStudioUser, assertAccountantAccess } from '@/lib/studio'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildBilancioCsv } from '@/lib/fiscal/bilancio-csv'
import { isValidIsoDate } from '@/lib/csv'
import { guardExport } from '@/lib/security/export-guard'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const { workspaceId } = await params
  const user = await getStudioUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const ws = await assertAccountantAccess(user, workspaceId)
  if (!ws) return NextResponse.json({ error: 'Accesso non consentito' }, { status: 403 })

  // Freno e traccia (audit 5 ago), per coppia commercialista+cliente.
  const bloccato = await guardExport({
    userId: user.id, workspaceId, what: 'studio-bilancio', perWorkspace: true,
  })
  if (bloccato) return bloccato

  const from = request.nextUrl.searchParams.get('from') ?? ''
  const to = request.nextUrl.searchParams.get('to') ?? ''
  if (!isValidIsoDate(from) || !isValidIsoDate(to) || from > to) {
    return NextResponse.json({ error: 'Intervallo di date non valido.' }, { status: 400 })
  }

  let csv: string
  try {
    csv = await buildBilancioCsv(createAdminClient(), workspaceId, ws, from, to)
  } catch (err) {
    // Il builder lancia se non riesce a leggere TUTTO: al
    // commercialista non deve mai arrivare un file incompleto.
    console.error('[studio/export] bilancio non riuscito:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Esportazione non riuscita. Riprova tra qualche secondo.' },
      { status: 500 },
    )
  }
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="bilancio_${from}_${to}.csv"`,
    },
  })
}
