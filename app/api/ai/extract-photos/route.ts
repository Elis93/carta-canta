// ============================================================
// POST /api/ai/extract-photos  (multipart: photos[] + notes)
// "Preventivo dalle foto": l'AI propone le VOCI (descrizioni) dalle foto
// del cantiere + note. Il PREZZO lo attacca il NOSTRO codice dal catalogo
// dell'utente (matchCatalog), MAI l'AI. Le quantità solo se nelle note.
// Stessa quota/kill-switch/rate-limit dell'AI import.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  extractScopeFromPhotosMistral,
  extractScopeFromPhotosOpenAI,
  type ScopeResult,
} from '@/lib/ai/extract-photos'
import { matchCatalog, type CatalogEntry } from '@/lib/ai/catalog-match'
import { getAiImportQuota, quotaExhaustedMessage, checkExtractionCap, recordAiExtraction } from '@/lib/ai/quota'
import { checkPublicRateLimit, rateLimitResponse } from '@/lib/public-rate-limit'

const AI_ENABLED = process.env.NEXT_PUBLIC_AI_IMPORT_ENABLED === 'true'
const MAX_PHOTOS = 6
const MAX_BYTES = 8 * 1024 * 1024 // per foto
// NIENTE HEIC/HEIF: i provider vision (Mistral/OpenAI) non li leggono e non
// abbiamo una conversione server-side — accettarli produrrebbe solo un 502
// fuorviante. Le foto iPhone arrivano comunque: con accept="image/*" iOS
// converte da solo HEIC → JPEG al momento dell'upload.
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp']

export async function POST(request: NextRequest) {
  if (!AI_ENABLED) return NextResponse.json({ error: 'Funzione non disponibile' }, { status: 404 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  // Owner o membro invitato (piano Team)
  let { data: workspace } = await supabase
    .from('workspaces').select('id, plan').eq('owner_id', user.id).maybeSingle()
  if (!workspace) {
    const { data: membership } = await supabase
      .from('workspace_members').select('workspace_id')
      .eq('user_id', user.id).not('accepted_at', 'is', null).order('accepted_at', { ascending: true }).limit(1).maybeSingle()
    if (membership) {
      const { data: mw } = await supabase.from('workspaces').select('id, plan').eq('id', membership.workspace_id).maybeSingle()
      workspace = mw
    }
  }
  if (!workspace) return NextResponse.json({ error: 'Workspace non trovato' }, { status: 404 })

  const quota = await getAiImportQuota(workspace.id, workspace.plan)
  if (!quota.allowed) {
    return NextResponse.json(
      { error: quotaExhaustedMessage(quota.reason), paywall: quota.reason === 'free_used' || quota.reason === 'tank_empty', upgrade_url: '/abbonamento' },
      { status: 403 })
  }
  const rl = await checkPublicRateLimit({ key: `ai:${workspace.id}`, limit: 5, window: '1 m', windowMs: 60_000 })
  if (rl.blocked) return rateLimitResponse(rl.resetAt, 'Hai raggiunto il limite di 5 elaborazioni al minuto. Riprova tra qualche istante.')
  const cap = await checkExtractionCap(workspace.id, workspace.plan)
  if (!cap.allowed) {
    return NextResponse.json({ error: 'Hai raggiunto il limite di elaborazioni AI per questo mese. Si ricarica il mese prossimo.' }, { status: 403 })
  }

  // ── Foto + note ───────────────────────────────────────────
  // Due sorgenti: (1) multipart = foto appena scattate/scelte dal telefono;
  // (2) JSON { document_id } = riusa le foto GIÀ caricate sul preventivo
  //     (tipicamente quelle del sopralluogo, collegate alla trasformazione)
  //     senza farle ricaricare all'artigiano.
  const contentType = request.headers.get('content-type') ?? ''
  let notes = ''
  const images: Array<{ base64: string; mime: string }> = []

  if (contentType.includes('application/json')) {
    let documentId = ''
    try {
      const body = await request.json()
      documentId = String(body.document_id ?? '')
      notes = String(body.notes ?? '').trim().slice(0, 4000)
    } catch {
      return NextResponse.json({ error: 'Richiesta non valida' }, { status: 400 })
    }
    if (!documentId) return NextResponse.json({ error: 'Preventivo non valido' }, { status: 400 })
    // Il documento deve appartenere al workspace (no IDOR)
    const { data: doc } = await supabase
      .from('documents')
      .select('id, internal_notes')
      .eq('id', documentId).eq('workspace_id', workspace.id).is('deleted_at', null)
      .maybeSingle()
    if (!doc) return NextResponse.json({ error: 'Preventivo non trovato' }, { status: 404 })
    // Se non arrivano note dal form, usa quelle interne del documento (dal sopralluogo)
    if (!notes) notes = String((doc as { internal_notes?: string | null }).internal_notes ?? '').trim().slice(0, 4000)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- work_photos (041) non in types
    const { data: wp } = await (supabase as any)
      .from('work_photos')
      .select('storage_path')
      .eq('document_id', documentId).eq('workspace_id', workspace.id)
      .order('created_at', { ascending: true })
      .limit(MAX_PHOTOS)
    const rows = (wp ?? []) as Array<{ storage_path: string }>
    if (rows.length === 0) return NextResponse.json({ error: 'Non ci sono foto caricate su questo preventivo.' }, { status: 400 })
    for (const r of rows) {
      const { data: blob } = await supabase.storage.from('work-photos').download(r.storage_path)
      if (!blob) continue
      const buf = Buffer.from(await blob.arrayBuffer())
      if (buf.byteLength > MAX_BYTES) continue
      // Le foto lavoro sono sempre ridimensionate a JPEG all'upload; fallback prudente
      const mime = ACCEPTED.includes(blob.type) ? blob.type : 'image/jpeg'
      images.push({ base64: buf.toString('base64'), mime })
    }
    if (images.length === 0) return NextResponse.json({ error: 'Non sono riuscito a leggere le foto del preventivo. Riprova o inserisci le voci a mano.' }, { status: 502 })
  } else {
    try {
      const form = await request.formData()
      notes = String(form.get('notes') ?? '').trim().slice(0, 4000)
      const files = form.getAll('photos').filter((f): f is File => f instanceof File)
      if (files.length === 0) return NextResponse.json({ error: 'Aggiungi almeno una foto.' }, { status: 400 })
      for (const f of files.slice(0, MAX_PHOTOS)) {
        if (!ACCEPTED.includes(f.type)) {
          return NextResponse.json({ error: 'Formato foto non supportato. Usa JPG, PNG o WEBP (dalla fotocamera o dalla galleria del telefono va bene).' }, { status: 400 })
        }
        if (f.size > MAX_BYTES) return NextResponse.json({ error: 'Una foto è troppo grande (max 8 MB).' }, { status: 400 })
        const buf = Buffer.from(await f.arrayBuffer())
        images.push({ base64: buf.toString('base64'), mime: f.type })
      }
    } catch {
      return NextResponse.json({ error: 'Richiesta non valida' }, { status: 400 })
    }
  }

  // ── Catalogo dell'utente (per l'abbinamento dei PREZZI, lato nostro) ──
  // Se il catalogo NON si legge (errore DB), fermati PRIMA di chiamare l'AI:
  // altrimenti si consumerebbe una elaborazione producendo tutte voci a
  // prezzo 0 "da prezzare" per un errore, non per assenza di match.
  const { data: catRows, error: catErr } = await supabase
    .from('catalog_items')
    .select('name, unit, unit_price')
    .eq('workspace_id', workspace.id)
    .eq('is_active', true)
    .limit(500)
  if (catErr) {
    return NextResponse.json({ error: 'Non riesco a leggere il tuo catalogo in questo momento. Riprova tra qualche istante.' }, { status: 503 })
  }
  const catalog: CatalogEntry[] = (catRows ?? []) as CatalogEntry[]
  const catalogNames = catalog.map((c) => c.name).filter(Boolean)

  // ── AI: solo le descrizioni (Mistral → OpenAI). Consuma quota a successo. ──
  let scope: ScopeResult
  try {
    scope = await extractScopeFromPhotosMistral(images, notes, catalogNames)
  } catch {
    try {
      scope = await extractScopeFromPhotosOpenAI(images, notes, catalogNames)
    } catch {
      return NextResponse.json({ error: 'Non sono riuscito a leggere le foto. Riprova o inserisci le voci a mano.' }, { status: 502 })
    }
  }
  await recordAiExtraction(workspace.id)

  // ── PREZZI: solo dal catalogo, nel NOSTRO codice. Mai dall'AI. ──
  const items = scope.items.map((it) => {
    const m = matchCatalog(it.description, catalog)
    return {
      description: it.description,
      unit: m?.unit ?? it.unit ?? 'pz',
      quantity: it.quantity, // null se non era nelle note
      unit_price: m ? m.unit_price : 0, // 0 = "da prezzare" (nessun prezzo AI)
      discount_pct: null,
      vat_rate: null,
      // metadati per i badge in UI
      price_source: m ? 'catalog' : 'todo',
      qty_source: it.quantity_from_notes ? 'notes' : 'todo',
      confidence: it.confidence,
    }
  })

  return NextResponse.json({ items, suggested_title: scope.suggested_title, provider: scope.provider })
}
