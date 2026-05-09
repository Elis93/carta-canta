// POST /api/voice/transcribe
// Riceve un blob audio (FormData: campo "audio"), lo trascrive con AssemblyAI
// Universal-3 in italiano, aggiorna il contatore mensile e restituisce il testo.
//
// Limiti mensili per piano:
//   Free            → 300 sec  (5 min)
//   Pro/Team/Lifetime → 3600 sec (60 min)
//
// Risposta 429 quando il quota è esaurito, con messaggio leggibile.

import { NextRequest, NextResponse } from 'next/server'
import { AssemblyAI } from 'assemblyai'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Secondi disponibili per piano al mese
const PLAN_LIMITS: Record<string, number> = {
  free:     300,   //  5 minuti
  pro:      3600,  // 60 minuti
  team:     3600,
  lifetime: 3600,
}

export async function POST(request: NextRequest) {
  // ── Verifica API key al più presto (errore di configurazione evidente) ────
  const apiKey = process.env.ASSEMBLYAI_API_KEY
  if (!apiKey) {
    console.error('[voice/transcribe] ASSEMBLYAI_API_KEY non configurata')
    return NextResponse.json({ error: 'Servizio vocale non configurato (API key mancante).' }, { status: 503 })
  }
  console.log('[voice/transcribe] API key presente, lunghezza:', apiKey.length)

  // ── Auth ─────────────────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  }
  console.log('[voice/transcribe] User:', user.id)

  // ── Workspace + piano ────────────────────────────────────────────────────
  let workspaceId: string | null = null
  let plan = 'free'

  const { data: ownedWs } = await supabase
    .from('workspaces')
    .select('id, plan')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (ownedWs) {
    workspaceId = ownedWs.id
    plan = ownedWs.plan
  } else {
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id, workspaces!workspace_id(id, plan)')
      .eq('user_id', user.id)
      .not('accepted_at', 'is', null)
      .limit(1)
      .maybeSingle()

    if (membership) {
      const ws = membership.workspaces as { id: string; plan: string } | null
      workspaceId = ws?.id ?? null
      plan = ws?.plan ?? 'free'
    }
  }

  if (!workspaceId) {
    return NextResponse.json({ error: 'Workspace non trovato' }, { status: 404 })
  }

  // ── Verifica quota mensile ────────────────────────────────────────────────
  const limitSeconds = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free
  const period = new Date().toISOString().slice(0, 7) // 'YYYY-MM'

  // Tabella voice_usage non ancora nei tipi generati — cast necessario
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  const { data: usageRow } = await admin
    .from('voice_usage')
    .select('seconds_used')
    .eq('workspace_id', workspaceId)
    .eq('period', period)
    .maybeSingle() as { data: { seconds_used: number } | null }

  const secondsUsed = usageRow?.seconds_used ?? 0

  if (secondsUsed >= limitSeconds) {
    const isPaid = plan !== 'free'
    return NextResponse.json({
      error: isPaid
        ? `Hai esaurito i 60 minuti vocali del piano ${plan === 'team' ? 'Team' : 'Pro'} questo mese. Si ripristinano il 1° del mese prossimo.`
        : `Hai esaurito i 5 minuti vocali del piano Free questo mese. Passa a Pro per 60 minuti/mese.`,
      code: 'QUOTA_EXCEEDED',
      isPaid,
    }, { status: 429 })
  }

  // ── Leggi audio dalla richiesta ──────────────────────────────────────────
  let formData: FormData
  try {
    formData = await request.formData()
  } catch (err) {
    console.error('[voice/transcribe] FormData parse error:', err)
    return NextResponse.json({ error: 'Formato richiesta non valido' }, { status: 400 })
  }

  const audioFile = formData.get('audio') as File | null
  if (!audioFile || audioFile.size === 0) {
    console.error('[voice/transcribe] Audio mancante, formData keys:', [...formData.keys()])
    return NextResponse.json({ error: 'Audio mancante o vuoto' }, { status: 400 })
  }

  console.log('[voice/transcribe] Audio ricevuto:', {
    name: audioFile.name,
    type: audioFile.type,
    size: audioFile.size,
  })

  // Limite 10 MB per registrazione (>60 sec WebM/Opus ≈ 2–3 MB, abbondante)
  if (audioFile.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'File audio troppo grande (max 10 MB)' }, { status: 413 })
  }

  // ── Trascrizione AssemblyAI ──────────────────────────────────────────────
  // speech_model: 'best' = Universal-3 Pro (massima qualità, include italiano)
  const client = new AssemblyAI({ apiKey })
  const audioBuffer = Buffer.from(await audioFile.arrayBuffer())
  console.log('[voice/transcribe] Buffer size:', audioBuffer.length, 'bytes')

  let text = ''
  let durationSeconds = 0

  try {
    console.log('[voice/transcribe] Invio ad AssemblyAI...')
    const transcript = await client.transcripts.transcribe({
      audio: audioBuffer,
      language_code: 'it',
      speech_models: ['universal'],  // SDK v4: array di stringhe (rimpiazza speech_model deprecato)
      format_text: true,
    })

    console.log('[voice/transcribe] Risposta AssemblyAI:', {
      status: transcript.status,
      id: transcript.id,
      audio_duration: transcript.audio_duration,
      error: transcript.error,
      text_length: transcript.text?.length ?? 0,
    })

    if (transcript.status === 'error') {
      console.error('[voice/transcribe] AssemblyAI status=error:', transcript.error)
      return NextResponse.json({
        error: `Errore del servizio di trascrizione: ${transcript.error ?? 'sconosciuto'}`,
      }, { status: 502 })
    }

    text = transcript.text ?? ''
    durationSeconds = Math.ceil(transcript.audio_duration ?? 0)
  } catch (err) {
    // Log dettagliato dell'eccezione per diagnostica su Vercel
    const e = err as Error & { status?: number; response?: unknown }
    console.error('[voice/transcribe] AssemblyAI exception:', {
      message:  e.message,
      name:     e.name,
      status:   e.status,
      response: e.response,
      stack:    e.stack?.split('\n').slice(0, 5).join('\n'),
    })
    return NextResponse.json({
      error: `Errore di trascrizione: ${e.message ?? 'sconosciuto'}. Riprova tra poco.`,
    }, { status: 502 })
  }

  // ── Aggiorna utilizzo mensile ─────────────────────────────────────────────
  if (durationSeconds > 0) {
    if (usageRow) {
      await admin
        .from('voice_usage')
        .update({
          seconds_used: secondsUsed + durationSeconds,
          updated_at: new Date().toISOString(),
        })
        .eq('workspace_id', workspaceId)
        .eq('period', period)
    } else {
      await admin
        .from('voice_usage')
        .insert({ workspace_id: workspaceId, period, seconds_used: durationSeconds })
    }
  }

  const remainingSeconds = Math.max(0, limitSeconds - secondsUsed - durationSeconds)

  return NextResponse.json({
    text,
    durationSeconds,
    remainingSeconds,
    limitSeconds,
  })
}
