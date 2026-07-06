// ============================================================
// POST /api/webhooks/sdi?secret=...
// Riceve gli esiti SDI dal provider e li mappa sugli stati della fattura:
// consegnata · mancata_consegna (valida comunque) · scartata (→ email).
//
// Forma del payload NORMALIZZATA dal layer di astrazione:
//   { provider_id: string, esito: 'consegnata'|'mancata_consegna'|'scartata', message?: string }
// ⚠️ L'adattamento del payload REALE OpenAPI a questa forma va verificato
// in sandbox (le chiavi arrivano da Eli). In prova si chiama a mano.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v4'
import { createElement } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/send'
import { SdiScartataEmail } from '@/lib/email/templates/sdi_scartata'

const BodySchema = z.object({
  provider_id: z.string().min(1),
  esito: z.enum(['consegnata', 'mancata_consegna', 'scartata']),
  message: z.string().max(500).optional(),
})

export async function POST(request: NextRequest) {
  const secret = process.env.SDI_WEBHOOK_SECRET
  if (!secret || request.nextUrl.searchParams.get('secret') !== secret) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  }

  let body: z.infer<typeof BodySchema>
  try {
    body = BodySchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: 'Payload non valido' }, { status: 400 })
  }

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 044 non ancora in types/database.ts
  const db = admin as any

  const { data: doc } = await db
    .from('documents')
    .select('id, doc_number, workspace_id, sdi_provider_id, sdi_status')
    .eq('sdi_provider_id', body.provider_id)
    .maybeSingle()
  if (!doc) return NextResponse.json({ error: 'Fattura non trovata' }, { status: 404 })

  // Solo la transizione da 'inviata' è valida: un webhook duplicato o in
  // ritardo non deve riportare indietro un esito già registrato
  // (es. 'consegnata' che torna 'scartata' per un retry del provider).
  if (doc.sdi_status !== 'inviata') {
    return NextResponse.json({ success: true, skipped: `stato attuale: ${doc.sdi_status}` })
  }

  const { error } = await db
    .from('documents')
    .update({
      sdi_status: body.esito,
      sdi_updated_at: new Date().toISOString(),
      sdi_error: body.esito === 'scartata' ? (body.message ?? 'Scartata dallo SDI') : null,
    })
    .eq('id', doc.id)
    .eq('sdi_status', 'inviata')
  if (error) {
    console.error('[webhooks/sdi] update fallito:', error)
    return NextResponse.json({ error: 'Aggiornamento non riuscito' }, { status: 500 })
  }

  // Scartata → anche EMAIL all'artigiano (decisione Eli; la notifica in
  // app la calcola la campanella dai dati)
  if (body.esito === 'scartata') {
    try {
      const { data: ws } = await admin
        .from('workspaces')
        .select('owner_id')
        .eq('id', doc.workspace_id)
        .maybeSingle()
      if (ws?.owner_id) {
        const { data: ownerData } = await admin.auth.admin.getUserById(ws.owner_id)
        const ownerEmail = ownerData?.user?.email
        if (ownerEmail) {
          const numClean = String(doc.doc_number ?? '').replace(/^[A-Za-z]+/, '')
          await sendEmail({
            to: ownerEmail,
            subject: `Fattura ${numClean} scartata dallo SDI — correggi e reinvia`,
            react: createElement(SdiScartataEmail, {
              docNumber: numClean,
              motivo: body.message ?? null,
              appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'https://cartacanta.app',
              documentId: doc.id,
            }),
          })
        }
      }
    } catch (err) {
      console.warn('[webhooks/sdi] email scarto fallita (non bloccante):', err)
    }
  }

  return NextResponse.json({ success: true })
}
