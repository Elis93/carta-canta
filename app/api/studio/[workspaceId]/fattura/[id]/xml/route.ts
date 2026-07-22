// ============================================================
// GET /api/studio/[workspaceId]/fattura/[id]/xml
// Download dell'XML FatturaPA da parte del COMMERCIALISTA (feedback Eli
// 22 lug #20). Accesso verificato dal link attivo (accountant_links)
// sull'email confermata — MAI dal solo parametro URL. Sola lettura.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { getStudioUser, assertAccountantAccess } from '@/lib/studio'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildInvoiceXmlForDoc } from '@/lib/sdi/doc-xml'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string; id: string }> },
) {
  const { workspaceId, id } = await params
  const user = await getStudioUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const access = await assertAccountantAccess(user, workspaceId)
  if (!access) return NextResponse.json({ error: 'Accesso non consentito' }, { status: 403 })

  const admin = createAdminClient()
  // Dati fiscali completi del cedente (assertAccountantAccess ritorna solo i campi base).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- select dinamica
  const { data: ws } = await (admin as any)
    .from('workspaces')
    .select('id, name, ragione_sociale, piva, indirizzo, cap, citta, provincia, fiscal_regime')
    .eq('id', workspaceId)
    .maybeSingle()
  if (!ws) return NextResponse.json({ error: 'Workspace non trovato' }, { status: 404 })

  // cedenteEmail null: l'email del cedente non è quella del commercialista.
  const built = await buildInvoiceXmlForDoc(admin, workspaceId, id, ws, null)
  if (!built) return NextResponse.json({ error: 'Fattura non trovata' }, { status: 404 })

  return new NextResponse(built.xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Content-Disposition': `attachment; filename="fattura_${built.numero.replace(/\//g, '-')}.xml"`,
    },
  })
}
