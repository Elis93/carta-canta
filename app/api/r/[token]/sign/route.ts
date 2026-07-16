// ============================================================
// POST /api/r/[token]/sign
// Pubblica — no auth. Firma del rapportino di fine lavoro:
// salva nome, IP, UA e timestamp (firma elettronica semplice,
// stesso schema dell'accettazione preventivo). Colonne 049.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v4'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkPublicRateLimit, rateLimitResponse } from '@/lib/public-rate-limit'
import { clientIpFrom } from '@/lib/client-ip'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const BodySchema = z.object({
  signer_name: z.string().min(2, 'Nome obbligatorio (min. 2 caratteri)').max(120),
  // F20: firma a mano (PNG dal canvas) — stessi limiti dell'accettazione
  // preventivo. nullish per compatibilità con client vecchi in cache.
  signature_image: z.string().startsWith('data:image/png;base64,').max(65536).nullish(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  if (!UUID_RE.test(token)) {
    return NextResponse.json({ error: 'Rapportino non trovato' }, { status: 404 })
  }

  // ── Rate limit: 5 tentativi / ora per token ──────────────
  const rl = await checkPublicRateLimit({ key: `rapporto-sign:${token}`, limit: 5, window: '1 h', windowMs: 3_600_000 })
  if (rl.blocked) {
    return rateLimitResponse(rl.resetAt, 'Troppi tentativi. Attendi qualche minuto e riprova.')
  }

  // ── Valida body ──────────────────────────────────────────
  let body: z.infer<typeof BodySchema>
  try {
    body = BodySchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: 'Scrivi nome e cognome per firmare (min. 2 caratteri).' }, { status: 400 })
  }

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 049 non ancora in types/database.ts
  const db = admin as any

  // ── Carica rapportino via token ──────────────────────────
  const { data: lav, error: fetchError } = await db
    .from('lavori')
    .select('id, report_text, report_signed_at')
    .eq('report_token', token)
    .is('deleted_at', null)
    .maybeSingle()

  if (fetchError || !lav || !lav.report_text) {
    return NextResponse.json({ error: 'Rapportino non trovato' }, { status: 404 })
  }
  if (lav.report_signed_at) {
    return NextResponse.json({ error: 'Rapportino già firmato' }, { status: 409 })
  }

  // x-real-ip primario (non spoofabile su Vercel): l'IP è anche PROVA
  // della firma del rapportino — vedi lib/client-ip.ts
  const ip = clientIpFrom(request.headers)
  const ua = request.headers.get('user-agent') ?? null

  // ── Firma — update condizionale: un doppio submit non firma due volte ──
  const payload = {
    report_signed_at: new Date().toISOString(),
    report_signer_name: body.signer_name,
    report_signed_ip: ip,
    report_signed_ua: ua,
    report_signature_image: body.signature_image ?? null, // F20 (migration 053)
    updated_at: new Date().toISOString(),
  }
  let { data: updated, error: updateError } = await db
    .from('lavori')
    .update(payload)
    .eq('id', lav.id)
    .is('report_signed_at', null)
    .select('id')

  // Pre-migration 053 (colonna firma assente): la firma NON deve fallire —
  // si salva senza immagine, come prima del F20.
  if (updateError?.code === '42703') {
    const { report_signature_image: _drop, ...legacy } = payload
    void _drop
    ;({ data: updated, error: updateError } = await db
      .from('lavori')
      .update(legacy)
      .eq('id', lav.id)
      .is('report_signed_at', null)
      .select('id'))
  }

  if (updateError) {
    console.error('[rapporto-sign] DB update error:', updateError)
    return NextResponse.json({ error: 'Errore nel salvataggio' }, { status: 500 })
  }
  if (!updated || updated.length === 0) {
    return NextResponse.json({ error: 'Rapportino già firmato' }, { status: 409 })
  }

  return NextResponse.json({ success: true })
}
