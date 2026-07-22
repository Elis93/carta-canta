// ============================================================
// GET /api/fatture/[id]/xml
// Scarica l'XML FatturaPA della fattura per verifica/consegna al
// commercialista, SENZA passare da OpenAPI (feedback Eli 22 lug #20).
// Non trasmette nulla. Usa l'helper condiviso buildInvoiceXmlForDoc.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveWorkspaceForUser } from '@/lib/actions/resolve-workspace'
import { buildInvoiceXmlForDoc } from '@/lib/sdi/doc-xml'

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const ws = await resolveWorkspaceForUser<Parameters<typeof buildInvoiceXmlForDoc>[3] & { id: string }>(
    supabase, user.id,
    'id, name, ragione_sociale, piva, indirizzo, cap, citta, provincia, fiscal_regime',
  )
  if (!ws) return NextResponse.json({ error: 'Workspace non trovato' }, { status: 404 })

  const built = await buildInvoiceXmlForDoc(supabase, ws.id, id, ws, user.email ?? null)
  if (!built) return NextResponse.json({ error: 'Fattura non trovata' }, { status: 404 })

  return new NextResponse(built.xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Content-Disposition': `attachment; filename="fattura_${built.numero.replace(/\//g, '-')}.xml"`,
    },
  })
}
