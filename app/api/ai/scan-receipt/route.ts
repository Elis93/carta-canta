// ============================================================
// POST /api/ai/scan-receipt
// Riceve una FOTO di scontrino/ricevuta ed estrae importo, data,
// categoria, fornitore per pre-compilare la "Nuova spesa" del Bilancio.
//
// Stessa quota/limiti dell'import listino (Mistral UE primario →
// OpenAI fallback). Solo immagini (niente PDF: uno scontrino è una foto).
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { scanReceiptWithMistral, scanReceiptWithOpenAI } from '@/lib/ai/receipt'
import { getAiImportQuota, quotaExhaustedMessage, checkExtractionCap, recordAiExtraction } from '@/lib/ai/quota'
import { MAX_FILE_SIZE_BYTES } from '@/lib/ai/types'
import { checkPublicRateLimit, rateLimitResponse } from '@/lib/public-rate-limit'

// Niente HEIC/HEIF: i provider vision (Mistral/OpenAI) non li leggono e non
// c'è conversione server-side — un .heic consumerebbe la quota per poi fallire
// con un 502 fuorviante (stessa lezione di extract-photos, 14 lug). iOS con
// accept="image/*" converte da solo HEIC→JPEG all'upload.
const RECEIPT_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export async function POST(request: NextRequest) {
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

  // ── Quota (stesso serbatoio dell'AI import) ───────────────
  const quota = await getAiImportQuota(workspace.id, workspace.plan)
  if (!quota.allowed) {
    return NextResponse.json(
      { error: quotaExhaustedMessage(quota.reason), paywall: quota.reason === 'free_used' || quota.reason === 'tank_empty', upgrade_url: '/abbonamento' },
      { status: 403 }
    )
  }

  // ── Rate limit: 5/minuto per workspace ────────────────────
  const rl = await checkPublicRateLimit({ key: `ai-receipt:${workspace.id}`, limit: 5, window: '1 m', windowMs: 60_000 })
  if (rl.blocked) {
    return rateLimitResponse(rl.resetAt, 'Hai raggiunto il limite di 5 scansioni al minuto. Riprova tra qualche istante.')
  }

  // ── Tetto estrazioni mensile (costo AI reale) ─────────────
  const extractCap = await checkExtractionCap(workspace.id, workspace.plan)
  if (!extractCap.allowed) {
    return NextResponse.json(
      { error: 'Hai raggiunto il limite di elaborazioni AI per questo mese. Inserisci la spesa a mano; si ricarica il mese prossimo.' },
      { status: 403 }
    )
  }

  // ── Parsing file ──────────────────────────────────────────
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Richiesta non valida' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Nessuna foto ricevuta' }, { status: 400 })
  }
  if (!RECEIPT_MIME_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Formato non supportato. Usa una foto JPG, PNG o WEBP.' }, { status: 415 })
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: 'La foto supera i 10 MB consentiti.' }, { status: 413 })
  }

  const imageBase64 = Buffer.from(await file.arrayBuffer()).toString('base64')
  const imageMime = file.type

  // ── Estrazione: Mistral (UE) primario → OpenAI fallback ───
  try {
    const result = await scanReceiptWithMistral(imageBase64, imageMime)
    await recordAiExtraction(workspace.id)
    return NextResponse.json(result, { status: 200 })
  } catch (err) {
    console.warn('[AI Receipt] Mistral fallito, provo OpenAI:', err instanceof Error ? err.message : err)
  }

  try {
    const result = await scanReceiptWithOpenAI(imageBase64, imageMime)
    await recordAiExtraction(workspace.id)
    return NextResponse.json({ ...result, _fallback: true }, { status: 200 })
  } catch (openAiErr) {
    console.error('[AI Receipt] Anche OpenAI fallito:', openAiErr instanceof Error ? openAiErr.message : openAiErr)
  }

  return NextResponse.json(
    { error: 'AI non disponibile al momento. Inserisci la spesa a mano.', ai_unavailable: true },
    { status: 503 }
  )
}
