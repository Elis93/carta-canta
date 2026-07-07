// ============================================================
// POST /api/p/[token]/view
//
// Endpoint chiamato dal browser reale al caricamento della pagina
// pubblica del preventivo. Segna il documento come "visto" e notifica
// l'owner per email.
//
// Eseguito solo da JavaScript nel browser → filtra automaticamente
// scanner di sicurezza email, bot, crawler e anteprima automatiche.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createElement } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/send'
import { PreventivoVistoEmail } from '@/lib/email/templates/preventivo_visto'

interface Params {
  params: Promise<{ token: string }>
}

// User-Agent pattern di bot e scanner noti — ulteriore difesa in profondità
// oltre al fatto che il JS non viene eseguito dagli scanner
const BOT_UA_RE = /bot|spider|crawl|slurp|scan|check|probe|monitor|facebookexternalhit|twitterbot|linkedin|whatsapp|telegram|discord|microsoft.*link|barracuda|proofpoint|mimecast|symantec|cisco|trend.*micro|fortinet|sophos|mcafee|avast|kaspersky|curl|wget|python|java\/|php|perl|ruby|go-http/i

export async function POST(request: NextRequest, { params }: Params) {
  const { token } = await params

  const ua = request.headers.get('user-agent') ?? ''

  // UA vuoto o riconosciuto come bot → ignora silenziosamente
  if (!ua.trim() || BOT_UA_RE.test(ua)) {
    return NextResponse.json({ ok: true })
  }

  const admin = createAdminClient()

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    null
  const country = request.headers.get('x-vercel-ip-country') ?? null

  // Carica il documento tramite public_token
  const { data: doc } = await admin
    .from('documents')
    .select(`
      id, status, doc_number, title, doc_type,
      workspaces!workspace_id (owner_id, ragione_sociale, name)
    `)
    .eq('public_token', token)
    .is('deleted_at', null)
    .in('status', ['sent', 'viewed'])
    .maybeSingle()

  if (!doc) return NextResponse.json({ ok: true })

  // Registra l'apertura per analytics (ogni visita, non solo la prima)
  void Promise.resolve(admin.from('document_views').insert({
    document_id: doc.id,
    ip_address:  ip      ?? undefined,
    user_agent:  ua      ?? undefined,
    country:     country ?? undefined,
  })).catch(() => {})

  // Transizione sent → viewed solo al primo accesso umano reale.
  // La clausola .eq('status', 'sent') rende l'operazione idempotente:
  // se lo status è già 'viewed' (apertura successiva) non fa nulla.
  if (doc.status !== 'sent') return NextResponse.json({ ok: true })

  const { data: updated } = await admin
    .from('documents')
    .update({ status: 'viewed' })
    .eq('id', doc.id)
    .eq('status', 'sent')
    .select('id')

  // Notifica email all'owner solo se la transizione è avvenuta ora
  if (!updated?.length) return NextResponse.json({ ok: true })

  try {
    const ws = doc.workspaces as { owner_id: string; ragione_sociale: string | null; name: string }
    const { data: ownerData } = await admin.auth.admin.getUserById(ws.owner_id)
    const ownerEmail = ownerData?.user?.email
    if (ownerEmail) {
      const wsName      = ws.ragione_sociale ?? ws.name
      const appUrl      = process.env.NEXT_PUBLIC_APP_URL ?? 'https://cartacanta.app'
      const isPreventivo = (doc.doc_type as string) !== 'fattura'
      const viewedAt    = new Date().toLocaleString('it-IT', {
        day: '2-digit', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      } as Intl.DateTimeFormatOptions)

      await sendEmail({
        to:      ownerEmail,
        subject: (() => {
          const docRef = doc.title ? `"${doc.title}"` : doc.doc_number ?? null
          const tipo = isPreventivo ? 'Il preventivo' : 'La fattura'
          const stato = `è stat${isPreventivo ? 'o' : 'a'} apert${isPreventivo ? 'o' : 'a'}`
          return docRef ? `${tipo} ${docRef} ${stato}` : `${tipo} ${stato}`
        })(),
        react:   createElement(PreventivoVistoEmail, {
          documentTitle:  doc.title ?? doc.doc_number ?? (isPreventivo ? 'Preventivo' : 'Fattura'),
          documentNumber: doc.doc_number ?? undefined,
          workspaceName:  wsName,
          viewedAt,
          documentUrl:    `${appUrl}/${isPreventivo ? 'preventivi' : 'fatture'}/${doc.id}`,
          docType:        isPreventivo ? 'preventivo' : 'fattura',
        }),
      })
    }
  } catch { /* non blocca la risposta */ }

  return NextResponse.json({ ok: true })
}
