// ============================================================
// POST /api/marketplace/segnala
// Pubblica — chiunque (senza account) può segnalare un profilo del
// marketplace. La segnalazione arriva via email a segnalazioni@cartacanta.app
// (procedura notice-and-takedown DSA). Sostituisce il vecchio mailto, che
// non faceva nulla senza un client di posta configurato.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v4'
import { createElement } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/send'
import { MarketplaceSegnalazioneEmail } from '@/lib/email/templates/marketplace_segnalazione'
import { checkPublicRateLimit, rateLimitResponse } from '@/lib/public-rate-limit'

const BodySchema = z.object({
  workspace_id: z.string().uuid(),
  reason: z.string().min(10).max(2000),
  // Contatto di chi segnala: FACOLTATIVO. Se fornito, deve somigliare a
  // un'email o a un telefono (per poter eventualmente ricontattare).
  reporter_contact: z.string().max(120).optional().refine(
    (c) => !c || c.trim() === '' || /^\S+@\S+\.\S+$/.test(c.trim()) || (c.replace(/\D/g, '').length >= 6 && /^[+\d\s\-./()]+$/.test(c.trim())),
    'Il contatto deve essere un telefono o un’email validi.'
  ),
  // Honeypot anti-bot: campo invisibile — se arriva pieno è spam
  website: z.string().max(0).optional(),
})

export async function POST(request: NextRequest) {
  // x-real-ip è impostato dalla piattaforma (Vercel) e NON è spoofabile;
  // x-forwarded-for solo come fallback (il suo primo elemento è controllabile
  // dal client → rotarlo aggirerebbe il rate-limit).
  const ip =
    request.headers.get('x-real-ip')?.trim() ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  // Le segnalazioni sono rare: 3/ora per IP è più che sufficiente e frena l'abuso.
  const rl = await checkPublicRateLimit({ key: `mk-report:${ip}`, limit: 3, window: '1 h', windowMs: 3_600_000 })
  if (rl.blocked) {
    return rateLimitResponse(rl.resetAt, 'Troppe segnalazioni. Riprova più tardi.')
  }

  let body: z.infer<typeof BodySchema>
  try {
    body = BodySchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: 'Scrivi il motivo della segnalazione (almeno 10 caratteri).' }, { status: 400 })
  }

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabella 043 non ancora in types/database.ts
  const db = admin as any

  // Solo profili esistenti (pubblicati o meno) possono essere segnalati
  const { data: profile } = await db
    .from('marketplace_profiles')
    .select('workspace_id, public_name')
    .eq('workspace_id', body.workspace_id)
    .maybeSingle()
  if (!profile) {
    return NextResponse.json({ error: 'Profilo non trovato.' }, { status: 404 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://cartacanta.app'
  const reporterContact = body.reporter_contact?.trim() || null
  const result = await sendEmail({
    to: 'segnalazioni@cartacanta.app',
    subject: `Segnalazione profilo marketplace: ${profile.public_name ?? body.workspace_id}`,
    replyTo: reporterContact && /^\S+@\S+\.\S+$/.test(reporterContact) ? reporterContact : undefined,
    react: createElement(MarketplaceSegnalazioneEmail, {
      profileName: profile.public_name ?? '(senza nome)',
      workspaceId: body.workspace_id,
      reason: body.reason.trim(),
      reporterContact,
      profileUrl: `${appUrl}/professionisti/${body.workspace_id}`,
    }),
  })
  if (!result.success) {
    return NextResponse.json({ error: 'Invio non riuscito. Riprova, o scrivi a segnalazioni@cartacanta.app.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
