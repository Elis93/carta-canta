// ============================================================
// POST /api/ai/extract
// Riceve un'immagine o PDF, estrae le voci con Mistral (UE, primario),
// fallback su OpenAI GPT-4o-mini (decisione Eli — Mistral primario).
//
// Aperto anche ai Free con quota (1 import a vita + serbatoio globale);
// Pro/Team/Lifetime: 15 al mese. Vedi lib/ai/quota.ts.
// Rate limit: 5 richieste/minuto per workspace.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractWithOpenAI } from '@/lib/ai/extract'
import { extractWithMistral } from '@/lib/ai/fallback'
import { getAiImportQuota, quotaExhaustedMessage, checkExtractionCap, recordAiExtraction } from '@/lib/ai/quota'
// NOTA: pdfToImageBase64 è importato dinamicamente nel blocco PDF (sotto)
// perché lib/ai/pdf-to-image.ts importa @sparticuz/chromium staticamente,
// che crasherebbe il module loading su Vercel Lambda anche per richieste immagine.
import {
  ACCEPTED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
} from '@/lib/ai/types'
import type { AcceptedMimeType } from '@/lib/ai/types'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }

  // ── Plan check ────────────────────────────────────────────
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, plan')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!workspace) {
    return NextResponse.json({ error: 'Workspace non trovato' }, { status: 404 })
  }

  // ── Quota (Free 1 a vita + serbatoio · Pro 15/mese) ───────
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

  // ── Rate limit: 5 richieste / minuto per workspace ───────
  const rl = checkRateLimit(`ai:${workspace.id}`, { limit: 5, windowMs: 60_000 })
  if (!rl.success) {
    return rateLimitResponse(rl.resetAt, 'Hai raggiunto il limite di 5 elaborazioni al minuto. Riprova tra qualche istante.')
  }

  // ── Tetto ESTRAZIONI (costo AI reale anche senza salvataggio) ──
  // Persistente su DB, a differenza del rate limit in-memory: chi rifà
  // foto all'infinito senza mai salvare non brucia il budget del mese.
  const extractCap = await checkExtractionCap(workspace.id, workspace.plan)
  if (!extractCap.allowed) {
    return NextResponse.json(
      { error: 'Hai raggiunto il limite di elaborazioni AI per questo mese. Le voci già estratte restano modificabili; si ricarica il mese prossimo.' },
      { status: 403 }
    )
  }

  // ── Parsing multipart ─────────────────────────────────────
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Richiesta non valida' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Nessun file ricevuto' }, { status: 400 })
  }

  // ── Validazione file ──────────────────────────────────────
  if (!ACCEPTED_MIME_TYPES.includes(file.type as AcceptedMimeType)) {
    return NextResponse.json(
      { error: `Formato non supportato. Usa: JPG, PNG, WEBP o PDF` },
      { status: 415 }
    )
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { error: `Il file supera i 10 MB consentiti` },
      { status: 413 }
    )
  }

  // ── Prepara immagine base64 ───────────────────────────────
  let imageBase64: string
  let imageMime: string

  const fileBuffer = Buffer.from(await file.arrayBuffer())

  if (file.type === 'application/pdf') {
    // PDF → screenshot prima pagina via Playwright
    // Import dinamico: evita che @sparticuz/chromium venga caricato staticamente
    // e faccia crashare il modulo anche per richieste immagine (manca libnss3 su Lambda).
    try {
      const { pdfToImageBase64 } = await import('@/lib/ai/pdf-to-image')
      imageBase64 = await pdfToImageBase64(fileBuffer)
      imageMime = 'image/png'
    } catch (pdfErr) {
      console.error('[AI Extract] PDF→image fallito:', pdfErr)
      return NextResponse.json(
        { error: 'Impossibile elaborare il PDF. Prova a caricare una foto del documento.' },
        { status: 422 }
      )
    }
  } else {
    // Immagine diretta
    imageBase64 = fileBuffer.toString('base64')
    imageMime = file.type
  }

  // ── Estrazione AI: Mistral (UE) primario → OpenAI fallback ──
  // Decisione Eli (DECISIONI_E_FEEDBACK.md — AI import): Mistral primario.
  let mistralError: string | null = null

  // Tentativo 1: Mistral (pixtral, server EU)
  try {
    const result = await extractWithMistral(imageBase64, imageMime)
    await recordAiExtraction(workspace.id)
    return NextResponse.json(result, { status: 200 })
  } catch (err) {
    mistralError = err instanceof Error ? err.message : 'Errore Mistral'
    console.warn('[AI Extract] Mistral fallito, provo OpenAI:', mistralError)
  }

  // Tentativo 2: OpenAI GPT-4o-mini (fallback)
  try {
    const result = await extractWithOpenAI(imageBase64, imageMime)
    await recordAiExtraction(workspace.id)
    return NextResponse.json({ ...result, _fallback: true }, { status: 200 })
  } catch (openAiErr) {
    const openAiError = openAiErr instanceof Error ? openAiErr.message : 'Errore OpenAI'
    console.error('[AI Extract] Anche OpenAI fallito:', openAiError)
  }

  // Entrambi falliti — MAI bloccare l'utente (regola CLAUDE_v4.md §7)
  return NextResponse.json(
    {
      error: 'AI non disponibile al momento. Aggiungi le voci manualmente.',
      ai_unavailable: true,
    },
    { status: 503 }
  )
}
