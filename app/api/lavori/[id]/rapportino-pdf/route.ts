// ============================================================
// GET /api/lavori/[id]/rapportino-pdf
// Autenticata — la STESSA vista di stampa del rapportino che ha
// il cliente, per l'artigiano (2 ago: "scaricabile da entrambi").
// ?preview=1 → senza stampa automatica.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildRapportinoHtml, oreLabelFromMinutes } from '@/lib/pdf/rapportino'
import { preparePrintHtml } from '@/lib/pdf/logo'
import { signPhotoPaths } from '@/lib/photos/signed-url'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const preview = request.nextUrl.searchParams.get('preview') === '1'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  let { data: workspace } = await supabase
    .from('workspaces')
    .select('id, ragione_sociale, name, logo_url')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!workspace) {
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .not('accepted_at', 'is', null)
      .limit(1)
      .maybeSingle()
    if (membership) {
      const { data: mw } = await supabase
        .from('workspaces')
        .select('id, ragione_sociale, name, logo_url')
        .eq('id', membership.workspace_id)
        .maybeSingle()
      workspace = mw
    }
  }
  if (!workspace) return NextResponse.json({ error: 'Workspace non trovato' }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 049-053 non ancora in types/database.ts
  const db = supabase as any

  let lav: {
    id: string
    title: string | null
    address: string | null
    finished_at: string | null
    report_text: string | null
    report_sent_at: string | null
    report_signed_at: string | null
    report_signer_name: string | null
    report_signature_image?: string | null
    labor_minutes?: number | null
    document_id?: string | null
    show_labor_to_client?: boolean | null
    clients: { name: string | null; surname: string | null } | null
  } | null = null
  try {
    let { data, error } = await db
      .from('lavori')
      .select('id, title, address, finished_at, report_text, report_sent_at, report_signed_at, report_signer_name, report_signature_image, labor_minutes, document_id, show_labor_to_client, clients ( name, surname )')
      .eq('id', id)
      .eq('workspace_id', workspace.id)
      .maybeSingle()
    if (error?.code === '42703') {
      ;({ data, error } = await db
        .from('lavori')
        .select('id, title, address, finished_at, report_text, report_sent_at, report_signed_at, report_signer_name, document_id, clients ( name, surname )')
        .eq('id', id)
        .eq('workspace_id', workspace.id)
        .maybeSingle())
    }
    if (error) throw error
    lav = data
  } catch {
    return NextResponse.json({ error: 'Lavoro non trovato.' }, { status: 404 })
  }
  if (!lav?.report_text) {
    return new NextResponse('Questo lavoro non ha ancora un rapportino: crealo dalla scheda lavoro.', {
      status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }

  let photos: Array<{ storage_path: string; label: string | null }> = []
  if (lav.document_id) {
    try {
      const { data } = await db
        .from('work_photos')
        .select('storage_path, label')
        .eq('document_id', lav.document_id)
        .eq('visible_to_client', true)
        .order('created_at', { ascending: true })
      photos = data ?? []
    } catch { /* pre-migration */ }
  }
  // Firma con l'admin: l'accesso è già stato verificato sopra (workspace), e
  // così funziona anche per i COLLABORATORI, che non sono proprietari della
  // cartella in cui stanno le foto caricate dal titolare.
  const photoUrls = await signPhotoPaths(createAdminClient(), photos.map((p) => p.storage_path))

  const html = buildRapportinoHtml({
    wsName: workspace.ragione_sociale || workspace.name || 'Carta Canta',
    logoUrl: workspace.logo_url ?? null,
    title: lav.title,
    address: lav.address,
    clientName: [lav.clients?.name, lav.clients?.surname].filter(Boolean).join(' ') || null,
    finishedAt: lav.finished_at,
    sentAt: lav.report_sent_at,
    reportText: lav.report_text,
    // 086: anche l'anteprima dell'artigiano è «la vista del cliente» → ore solo con la spunta.
    oreLabel: lav.show_labor_to_client === true ? oreLabelFromMinutes(Number(lav.labor_minutes ?? 0)) : null,
    photos: photos.filter((p) => photoUrls.has(p.storage_path)).map((p) => ({ url: photoUrls.get(p.storage_path)!, label: p.label })),
    signedAt: lav.report_signed_at,
    signerName: lav.report_signer_name,
    signatureImage: lav.report_signature_image ?? null,
  })

  return new NextResponse(preparePrintHtml(html, !preview), {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
