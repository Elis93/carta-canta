// ============================================================
// POST /api/ai/extract
// Riceve un'immagine o PDF, estrae le voci con GPT-4o-mini,
// fallback su Mistral-small se OpenAI non risponde.
//
// Solo utenti Pro / Team / Lifetime.
// Rate limit: 5 richieste/minuto per workspace (TODO: Upstash Step 9).
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractWithOpenAI } from '@/lib/ai/extract'
import { extractWithMistral } from '@/lib/ai/fallback'
import { pdfToImageBase64 } from '@/lib/ai/pdf-to-image'
import {
  ACCEPTED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
} from '@/lib/ai/types'
import type { AcceptedMimeType } from '@/lib/ai/types'

// Piani che possono usare l'AI import
const AI_PLANS = new Set(['pro', 'team', 'lifetime'])

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

  if (!AI_PLANS.has(workspace.plan)) {
    return NextResponse.json(
      {
        error: 'AI Import è disponibile nel piano Pro.',
        paywall: true,
        upgrade_url: '/abbonamento',
      },
      { status: 403 }
    )
  }

  // ── TODO Step 9: Rate limit con Upstash Redis ─────────────
  // const rateLimit = await checkRateLimit(`ai:${workspace.id}`, { requests: 5, window: '1m' })
  // if (!rateLimit.success) return NextResponse.json({ error: 'Troppo veloce. Riprova tra qualche istante.' }, { status: 429 })

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
    try {
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

  // ── Estrazione AI: OpenAI → Mistral fallback ──────────────
  let openAiError: string | null = null

  // Tentativo 1: OpenAI GPT-4o-mini
  try {
    const result = await extractWithOpenAI(imageBase64, imageMime)
    return NextResponse.json(result, { status: 200 })
  } catch (err) {
    openAiError = err instanceof Error ? err.message : 'Errore OpenAI'
    console.warn('[AI Extract] OpenAI fallito, provo Mistral:', openAiError)
  }

  // Tentativo 2: Mistral fallback
  try {
    const result = await extractWithMistral(imageBase64, imageMime)
    return NextResponse.json({ ...result, _fallback: true }, { status: 200 })
  } catch (mistralErr) {
    const mistralError = mistralErr instanceof Error ? mistralErr.message : 'Errore Mistral'
    console.error('[AI Extract] Anche Mistral fallito:', mistralError)
  }

  // Entrambi falliti — MAI bloccare l'utente (regola CLAUDE_v4.md §7)
  return NextResponse.json(
    {
      error: 'AI non disponibile al momento. Compila il preventivo manualmente.',
      ai_unavailable: true,
    },
    { status: 503 }
  )
}
