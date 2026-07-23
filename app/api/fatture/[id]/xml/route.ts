// ============================================================
// GET /api/fatture/[id]/xml
// Scarica l'XML FatturaPA della fattura per verifica/consegna al
// commercialista, SENZA passare da OpenAPI (feedback Eli 22 lug #20).
// Non trasmette nulla. Usa l'helper condiviso buildInvoiceXmlForDoc,
// che applica le stesse guardie della trasmissione (niente XML con
// importi diversi dal PDF). Gli errori sono testo semplice: chi clicca
// il link li legge direttamente nel browser.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveWorkspaceForUser } from '@/lib/actions/resolve-workspace'
import { buildInvoiceXmlForDoc } from '@/lib/sdi/doc-xml'

const TEXT = { 'Content-Type': 'text/plain; charset=utf-8' }

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Non autenticato.', { status: 401, headers: TEXT })

  const ws = await resolveWorkspaceForUser<{
    id: string; name: string | null; ragione_sociale: string | null; piva: string | null
    indirizzo: string | null; cap: string | null; citta: string | null
    provincia: string | null; fiscal_regime: string
  }>(
    supabase, user.id,
    'id, name, ragione_sociale, piva, indirizzo, cap, citta, provincia, fiscal_regime',
  )
  if (!ws) return new NextResponse('Workspace non trovato.', { status: 404, headers: TEXT })

  const built = await buildInvoiceXmlForDoc(supabase, ws.id, id, ws, user.email ?? null)
  if (!built.ok) return new NextResponse(built.error, { status: built.status, headers: TEXT })

  return new NextResponse(built.xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Content-Disposition': `attachment; filename="fattura_${built.numero.replace(/\//g, '-')}.xml"`,
    },
  })
}
