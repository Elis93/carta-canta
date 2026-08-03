// ============================================================
// GET /api/r/[token]/pdf
// Pubblica — vista di stampa del RAPPORTINO di fine lavoro
// (2 ago: il cliente può scaricarselo come documento).
// Stesse regole della pagina /r/[token]: foto SOLO quelle rese
// visibili dall'artigiano; 404 se il rapportino non esiste.
// ?preview=1 → senza stampa automatica.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildRapportinoHtml, oreLabelFromMinutes } from '@/lib/pdf/rapportino'
import { preparePrintHtml } from '@/lib/pdf/logo'
import { checkPublicRateLimit } from '@/lib/public-rate-limit'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const preview = request.nextUrl.searchParams.get('preview') === '1'

  // report_token è un UUID (crypto.randomUUID in setRapportino)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
    return NextResponse.json({ error: 'Link non valido.' }, { status: 404 })
  }

  // Stessa guardia delle altre route pubbliche (pdf documenti: 20/min)
  const rl = await checkPublicRateLimit({ key: `pdf-r:${token}`, limit: 20, window: '1 m', windowMs: 60_000 })
  if (rl.blocked) {
    return NextResponse.json({ error: 'Troppe richieste. Riprova tra poco.' }, { status: 429 })
  }

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 049-053 non ancora in types/database.ts
  const db = admin as any

  // Lavoro dal token — cascata tollerante pre-053 come la pagina /r
  let lav: {
    id: string
    workspace_id: string
    title: string | null
    address: string | null
    finished_at: string | null
    report_text: string | null
    report_sent_at: string | null
    report_signed_at: string | null
    report_signer_name: string | null
    report_signature_image?: string | null
    clients: { name: string | null; surname: string | null } | null
  } | null = null
  try {
    let { data, error } = await db
      .from('lavori')
      .select('id, workspace_id, title, address, finished_at, report_text, report_sent_at, report_signed_at, report_signer_name, report_signature_image, clients ( name, surname )')
      .eq('report_token', token)
      .maybeSingle()
    if (error?.code === '42703') {
      ;({ data, error } = await db
        .from('lavori')
        .select('id, workspace_id, title, address, finished_at, report_text, report_sent_at, report_signed_at, report_signer_name, clients ( name, surname )')
        .eq('report_token', token)
        .maybeSingle())
    }
    if (error) throw error
    lav = data
  } catch {
    return NextResponse.json({ error: 'Rapportino non trovato.' }, { status: 404 })
  }
  if (!lav?.report_text) {
    return NextResponse.json({ error: 'Rapportino non trovato.' }, { status: 404 })
  }

  const { data: ws } = await admin
    .from('workspaces')
    .select('ragione_sociale, name, logo_url')
    .eq('id', lav.workspace_id)
    .maybeSingle()

  // Ore + foto visibili (tolleranti pre-migration, come /r)
  let laborMinutes = 0
  let lavDocumentId: string | null = null
  try {
    let { data: extra, error: extraErr } = await db
      .from('lavori')
      .select('labor_minutes, document_id')
      .eq('id', lav.id)
      .maybeSingle()
    if (extraErr?.code === '42703') {
      ;({ data: extra, error: extraErr } = await db
        .from('lavori')
        .select('document_id')
        .eq('id', lav.id)
        .maybeSingle())
    }
    if (!extraErr && extra) {
      const m = Number((extra as { labor_minutes?: number }).labor_minutes ?? 0)
      laborMinutes = Number.isFinite(m) && m > 0 ? Math.round(m) : 0
      lavDocumentId = (extra as { document_id?: string | null }).document_id ?? null
    }
  } catch { /* pre-migration */ }

  let photos: Array<{ storage_path: string; label: string | null }> = []
  if (lavDocumentId) {
    try {
      const { data } = await db
        .from('work_photos')
        .select('storage_path, label')
        .eq('document_id', lavDocumentId)
        .eq('visible_to_client', true)
        .order('created_at', { ascending: true })
      photos = data ?? []
    } catch { /* pre-migration */ }
  }
  const photoBase = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/work-photos/`

  const html = buildRapportinoHtml({
    wsName: ws?.ragione_sociale || ws?.name || 'Carta Canta',
    logoUrl: ws?.logo_url ?? null,
    title: lav.title,
    address: lav.address,
    clientName: [lav.clients?.name, lav.clients?.surname].filter(Boolean).join(' ') || null,
    finishedAt: lav.finished_at,
    sentAt: lav.report_sent_at,
    reportText: lav.report_text,
    oreLabel: oreLabelFromMinutes(laborMinutes),
    photos: photos.map((p) => ({ url: `${photoBase}${p.storage_path}`, label: p.label })),
    signedAt: lav.report_signed_at,
    signerName: lav.report_signer_name,
    signatureImage: lav.report_signature_image ?? null,
  })

  return new NextResponse(preparePrintHtml(html, !preview), {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
