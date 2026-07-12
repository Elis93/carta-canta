// ============================================================
// POST /api/ai/extract-voci
// Trasforma il TESTO degli appunti di sopralluogo in voci di
// preventivo strutturate. Mistral primario → fallback OpenAI.
// Stessa quota e stesso tetto estrazioni dell'AI import
// (il costo AI nasce all'estrazione). Rate limit 5/min.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractItemsFromTextMistral, extractItemsFromTextOpenAI } from '@/lib/ai/extract-text'
import { getAiImportQuota, quotaExhaustedMessage, checkExtractionCap, recordAiExtraction } from '@/lib/ai/quota'
import { checkPublicRateLimit, rateLimitResponse } from '@/lib/public-rate-limit'

const AI_ENABLED = process.env.NEXT_PUBLIC_AI_IMPORT_ENABLED === 'true'

export async function POST(request: NextRequest) {
  if (!AI_ENABLED) {
    return NextResponse.json({ error: 'Funzione non disponibile' }, { status: 404 })
  }

  // ── Auth ──────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  // Prima come owner, poi come membro invitato (piano Team) — le route AI
  // devono funzionare anche per i collaboratori, non solo per il titolare.
  let { data: workspace } = await supabase
    .from('workspaces')
    .select('id, plan')
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
        .select('id, plan')
        .eq('id', membership.workspace_id)
        .maybeSingle()
      workspace = mw
    }
  }
  if (!workspace) return NextResponse.json({ error: 'Workspace non trovato' }, { status: 404 })

  // ── Quota (stessa dell'AI import) ─────────────────────────
  const quota = await getAiImportQuota(workspace.id, workspace.plan)
  if (!quota.allowed) {
    return NextResponse.json(
      {
        error: quotaExhaustedMessage(quota.reason),
        paywall: quota.reason === 'free_used' || quota.reason === 'tank_empty',
        upgrade_url: '/abbonamento',
      },
      { status: 403 }
    )
  }

  // ── Rate limit: 5 richieste / minuto per workspace ────────
  const rl = await checkPublicRateLimit({ key: `ai:${workspace.id}`, limit: 5, window: '1 m', windowMs: 60_000 })
  if (rl.blocked) {
    return rateLimitResponse(rl.resetAt, 'Hai raggiunto il limite di 5 elaborazioni al minuto. Riprova tra qualche istante.')
  }

  // ── Tetto ESTRAZIONI mensile (persistente su DB) ──────────
  const extractCap = await checkExtractionCap(workspace.id, workspace.plan)
  if (!extractCap.allowed) {
    return NextResponse.json(
      { error: 'Hai raggiunto il limite di elaborazioni AI per questo mese. Si ricarica il mese prossimo.' },
      { status: 403 }
    )
  }

  // ── Body ──────────────────────────────────────────────────
  let text = ''
  try {
    const body = await request.json()
    text = String(body?.text ?? '').trim()
  } catch {
    return NextResponse.json({ error: 'Richiesta non valida' }, { status: 400 })
  }
  if (text.length < 5) {
    return NextResponse.json({ error: 'Le note sono troppo corte per estrarre delle voci.' }, { status: 400 })
  }
  if (text.length > 4000) text = text.slice(0, 4000)

  // ── Estrazione: Mistral primario → fallback OpenAI ────────
  // (la quota si consuma solo a estrazione riuscita, come per l'AI import)
  try {
    const result = await extractItemsFromTextMistral(text)
    await recordAiExtraction(workspace.id)
    return NextResponse.json(result)
  } catch {
    try {
      const result = await extractItemsFromTextOpenAI(text)
      await recordAiExtraction(workspace.id)
      return NextResponse.json(result)
    } catch {
      return NextResponse.json(
        { error: 'Estrazione non riuscita. Riprova tra qualche istante o inserisci le voci a mano.' },
        { status: 502 }
      )
    }
  }
}
