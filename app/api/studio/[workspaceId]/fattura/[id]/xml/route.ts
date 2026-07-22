// ============================================================
// GET /api/studio/[workspaceId]/fattura/[id]/xml
// Download dell'XML FatturaPA da parte del COMMERCIALISTA (feedback Eli
// 22 lug #20). Accesso verificato dal link attivo (accountant_links)
// sull'email confermata — MAI dal solo parametro URL. Sola lettura.
// L'helper applica le guardie della trasmissione (bozze escluse, niente
// sconti/multi-aliquota non rappresentabili, dati fiscali completi).
// Errori in testo semplice, leggibili nel browser.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { getStudioUser, assertAccountantAccess } from '@/lib/studio'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildInvoiceXmlForDoc } from '@/lib/sdi/doc-xml'

const TEXT = { 'Content-Type': 'text/plain; charset=utf-8' }

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string; id: string }> },
) {
  const { workspaceId, id } = await params
  const user = await getStudioUser()
  if (!user) return new NextResponse('Non autenticato.', { status: 401, headers: TEXT })

  const access = await assertAccountantAccess(user, workspaceId)
  if (!access) return new NextResponse('Accesso non consentito.', { status: 403, headers: TEXT })

  const admin = createAdminClient()
  // Dati fiscali completi del cedente (assertAccountantAccess ritorna solo i campi base).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- select dinamica
  const { data: ws } = await (admin as any)
    .from('workspaces')
    .select('id, name, ragione_sociale, piva, indirizzo, cap, citta, provincia, fiscal_regime')
    .eq('id', workspaceId)
    .maybeSingle()
  if (!ws) return new NextResponse('Workspace non trovato.', { status: 404, headers: TEXT })

  // cedenteEmail null: l'email del cedente non è quella del commercialista.
  const built = await buildInvoiceXmlForDoc(admin, workspaceId, id, ws, null)
  if (!built.ok) return new NextResponse(built.error, { status: built.status, headers: TEXT })

  return new NextResponse(built.xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Content-Disposition': `attachment; filename="fattura_${built.numero.replace(/\//g, '-')}.xml"`,
    },
  })
}
