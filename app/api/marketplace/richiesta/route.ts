// ============================================================
// POST /api/marketplace/richiesta
// Pubblica — il cliente (senza account) invia una richiesta di preventivo
// a un artigiano del marketplace. La richiesta finisce nella sezione
// "Richieste" in app; l'email di avviso NON contiene i dettagli.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v4'
import { createElement } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/send'
import { MarketplaceRichiestaEmail } from '@/lib/email/templates/marketplace_richiesta'
import { checkPublicRateLimit, rateLimitResponse } from '@/lib/public-rate-limit'
import { clientIpFrom } from '@/lib/client-ip'

const BodySchema = z.object({
  workspace_id: z.string().uuid(),
  name: z.string().min(2).max(80),
  // Il contatto deve somigliare a un'email o a un telefono anche lato
  // server (il check client si aggira con un POST diretto)
  contact: z.string().min(5).max(120).refine(
    (c) => /^\S+@\S+\.\S+$/.test(c.trim()) || (c.replace(/\D/g, '').length >= 6 && /^[+\d\s\-./()]+$/.test(c.trim())),
    'Il contatto deve essere un telefono o un\u2019email validi.'
  ),
  city: z.string().max(80).optional(),
  message: z.string().min(5).max(2000),
  // Honeypot anti-bot: campo invisibile agli umani — se arriva pieno è spam
  website: z.string().max(0).optional(),
})

function dottedName(full: string): string {
  const parts = full.trim().split(/\s+/).filter(Boolean)
  if (parts.length <= 1) return full.trim()
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`
}

export async function POST(request: NextRequest) {
  // x-real-ip primario (non spoofabile su Vercel) — vedi lib/client-ip.ts
  const ip = clientIpFrom(request.headers) ?? 'unknown'
  const rl = await checkPublicRateLimit({ key: `mk-request:${ip}`, limit: 5, window: '1 h', windowMs: 3_600_000 })
  if (rl.blocked) {
    return rateLimitResponse(rl.resetAt, 'Troppe richieste. Riprova più tardi.')
  }

  let body: z.infer<typeof BodySchema>
  try {
    body = BodySchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: 'Compila nome, contatto e descrizione del lavoro.' }, { status: 400 })
  }

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabella 043 non ancora in types/database.ts
  const db = admin as any

  // Solo profili pubblicati possono ricevere richieste
  const { data: profile } = await db
    .from('marketplace_profiles')
    .select('workspace_id, enabled, published_at')
    .eq('workspace_id', body.workspace_id)
    .maybeSingle()
  if (!profile?.enabled || !profile.published_at) {
    return NextResponse.json({ error: 'Profilo non disponibile.' }, { status: 404 })
  }

  const { error } = await db.from('marketplace_requests').insert({
    workspace_id: body.workspace_id,
    customer_name: body.name.trim(),
    customer_contact: body.contact.trim(),
    customer_city: body.city?.trim() || null,
    message: body.message.trim(),
  })
  if (error) {
    return NextResponse.json({ error: 'Invio non riuscito. Riprova.' }, { status: 500 })
  }

  // Email di avviso all'artigiano — SOLO chi ha contattato, senza dettagli
  try {
    const { data: ws } = await admin
      .from('workspaces')
      .select('owner_id')
      .eq('id', body.workspace_id)
      .maybeSingle()
    if (ws?.owner_id) {
      const { data: ownerData } = await admin.auth.admin.getUserById(ws.owner_id)
      const ownerEmail = ownerData?.user?.email
      if (ownerEmail) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://cartacanta.app'
        await sendEmail({
          to: ownerEmail,
          subject: 'Nuova richiesta dal marketplace',
          react: createElement(MarketplaceRichiestaEmail, {
            customerName: dottedName(body.name),
            customerCity: body.city?.trim() || null,
            appUrl,
          }),
        })
      }
    }
  } catch (err) {
    console.warn('[marketplace/richiesta] email avviso fallita (non bloccante):', err)
  }

  return NextResponse.json({ success: true })
}
