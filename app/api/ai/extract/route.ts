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
// NOTA: i PDF passano dal TESTO (unpdf + extract-doc-text, import dinamici
// nel blocco PDF sotto) — il vecchio PDF→immagine via Chromium è stato
// rimosso il 3 ago: su Vercel Lambda non poteva funzionare (B.8).
import {
  ACCEPTED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
} from '@/lib/ai/types'
import type { AcceptedMimeType } from '@/lib/ai/types'
import { checkPublicRateLimit, rateLimitResponse } from '@/lib/public-rate-limit'

export async function POST(request: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }

  // ── Plan check ────────────────────────────────────────────
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
  const rl = await checkPublicRateLimit({ key: `ai:${workspace.id}`, limit: 5, window: '1 m', windowMs: 60_000 })
  if (rl.blocked) {
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
    // PDF → TESTO (unpdf, puro JS) → modello TESTUALE. Il vecchio percorso
    // PDF→immagine passava da Chromium, che su Vercel Lambda non parte
    // (manca libnss3, regola B.8): l'import PDF falliva SEMPRE in
    // produzione ("Impossibile elaborare il PDF" — bug Eli 3 ago).
    let docText = ''
    try {
      const { extractText, getDocumentProxy } = await import('unpdf')
      const pdf = await getDocumentProxy(new Uint8Array(fileBuffer))
      const { text } = await extractText(pdf, { mergePages: true })
      docText = (text ?? '').trim()
    } catch (pdfErr) {
      console.error('[AI Extract] lettura PDF fallita:', pdfErr)
      return NextResponse.json(
        { error: 'Impossibile leggere il PDF. Prova a caricare una foto del documento.' },
        { status: 422 }
      )
    }
    if (docText.length < 60) {
      // PDF scansionato (solo immagini, nessun testo): la strada giusta è la foto
      return NextResponse.json(
        { error: 'Questo PDF sembra una scansione senza testo. Fotografa le pagine e carica le foto: le leggiamo da lì.' },
        { status: 422 }
      )
    }
    try {
      const { extractItemsFromDocumentText } = await import('@/lib/ai/extract-doc-text')
      const result = await extractItemsFromDocumentText(docText)
      await recordAiExtraction(workspace.id)
      return NextResponse.json(result, { status: 200 })
    } catch (aiErr) {
      console.error('[AI Extract] estrazione dal testo PDF fallita:', aiErr)
      return NextResponse.json(
        { error: 'AI non disponibile al momento. Aggiungi le voci manualmente.', ai_unavailable: true },
        { status: 503 }
      )
    }
  }

  // Immagine diretta
  imageBase64 = fileBuffer.toString('base64')
  imageMime = file.type

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
