// ── Mocks (hoistati da Vitest prima degli import) ──────────────────────────
import { vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/ai/quota', () => ({
  getAiImportQuota: vi.fn(),
  quotaExhaustedMessage: vi.fn(() => 'Quota esaurita'),
  checkExtractionCap: vi.fn(),
  recordAiExtraction: vi.fn(),
}))
vi.mock('@/lib/public-rate-limit', () => ({
  checkPublicRateLimit: vi.fn(),
  rateLimitResponse: vi.fn(() => new Response('troppe richieste', { status: 429 })),
}))
vi.mock('@/lib/ai/extract-photos', () => ({
  extractScopeFromPhotosMistral: vi.fn(),
  extractScopeFromPhotosOpenAI: vi.fn(),
}))

// ── Import ─────────────────────────────────────────────────────────────────
import { describe, it, expect, beforeEach } from 'vitest'
import { createClient } from '@/lib/supabase/server'
import { getAiImportQuota, checkExtractionCap, recordAiExtraction } from '@/lib/ai/quota'
import { checkPublicRateLimit } from '@/lib/public-rate-limit'
import { extractScopeFromPhotosMistral, extractScopeFromPhotosOpenAI } from '@/lib/ai/extract-photos'

// La route /api/ai/extract-photos è il cuore "anti-invenzione" del preventivo
// dalle foto: qui si verificano le GUARDIE (formati, limiti, IDOR, catalogo
// illeggibile → niente quota consumata) e che i PREZZI vengano solo dal
// catalogo, mai dall'AI.

// AI_ENABLED è letto all'IMPORT del modulo → import dinamico dopo stubEnv.
async function loadRoute(enabled = true) {
  vi.resetModules()
  vi.stubEnv('NEXT_PUBLIC_AI_IMPORT_ENABLED', enabled ? 'true' : 'false')
  return await import('@/app/api/ai/extract-photos/route')
}

// ── Supabase finto: coda di risultati consumata in ordine di await ─────────
function buildSupabase(results: Array<{ data?: unknown; error?: unknown }>, user: { id: string } | null = { id: 'user-1' }) {
  const queue = [...results]
  const next = () => queue.shift() ?? { data: null, error: null }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {}
  for (const m of ['select', 'eq', 'is', 'not', 'limit', 'order']) {
    chain[m] = () => chain
  }
  chain.maybeSingle = () => Promise.resolve(next())
  chain.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
    Promise.resolve(next()).then(res, rej)

  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: () => chain,
    storage: { from: () => ({ download: vi.fn() }) },
  }
}

const WS = { data: { id: 'ws-1', plan: 'pro' }, error: null }

function jpeg(name = 'foto.jpg', bytes = 100) {
  return new File([new Uint8Array(bytes)], name, { type: 'image/jpeg' })
}

function multipartRequest(files: File[], notes = '') {
  const form = new FormData()
  form.set('notes', notes)
  for (const f of files) form.append('photos', f)
  return new Request('http://localhost/api/ai/extract-photos', { method: 'POST', body: form })
}

function jsonRequest(body: unknown) {
  return new Request('http://localhost/api/ai/extract-photos', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks() // azzera anche i CONTATORI (recordAiExtraction, ecc.)
  vi.mocked(getAiImportQuota).mockResolvedValue({ allowed: true } as never)
  vi.mocked(checkExtractionCap).mockResolvedValue({ allowed: true } as never)
  vi.mocked(checkPublicRateLimit).mockResolvedValue({ blocked: false } as never)
  vi.mocked(recordAiExtraction).mockResolvedValue(undefined as never)
})

describe('POST /api/ai/extract-photos — guardie', () => {
  it('flag AI spento → 404 senza toccare nulla', async () => {
    const { POST } = await loadRoute(false)
    const res = await POST(multipartRequest([jpeg()]) as never)
    expect(res.status).toBe(404)
    expect(createClient).not.toHaveBeenCalled()
  })

  it('non autenticato → 401', async () => {
    const { POST } = await loadRoute()
    vi.mocked(createClient).mockResolvedValue(buildSupabase([], null) as never)
    const res = await POST(multipartRequest([jpeg()]) as never)
    expect(res.status).toBe(401)
  })

  it('quota esaurita → 403 con paywall', async () => {
    const { POST } = await loadRoute()
    vi.mocked(createClient).mockResolvedValue(buildSupabase([WS]) as never)
    vi.mocked(getAiImportQuota).mockResolvedValue({ allowed: false, reason: 'free_used' } as never)
    const res = await POST(multipartRequest([jpeg()]) as never)
    expect(res.status).toBe(403)
    expect((await res.json()).paywall).toBe(true)
  })

  it('multipart senza foto → 400', async () => {
    const { POST } = await loadRoute()
    vi.mocked(createClient).mockResolvedValue(buildSupabase([WS]) as never)
    const res = await POST(multipartRequest([]) as never)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/almeno una foto/)
  })

  it('HEIC rifiutato con messaggio chiaro (i provider non lo leggono)', async () => {
    const { POST } = await loadRoute()
    vi.mocked(createClient).mockResolvedValue(buildSupabase([WS]) as never)
    const heic = new File([new Uint8Array(10)], 'foto.heic', { type: 'image/heic' })
    const res = await POST(multipartRequest([heic]) as never)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/JPG, PNG o WEBP/)
  })

  it('foto oltre gli 8 MB → 400', async () => {
    const { POST } = await loadRoute()
    vi.mocked(createClient).mockResolvedValue(buildSupabase([WS]) as never)
    const res = await POST(multipartRequest([jpeg('grande.jpg', 8 * 1024 * 1024 + 1)]) as never)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/troppo grande/)
  })

  it('ramo JSON senza document_id → 400', async () => {
    const { POST } = await loadRoute()
    vi.mocked(createClient).mockResolvedValue(buildSupabase([WS]) as never)
    const res = await POST(jsonRequest({ notes: 'ciao' }) as never)
    expect(res.status).toBe(400)
  })

  it('ramo JSON: documento di un ALTRO workspace → 404 (no IDOR)', async () => {
    const { POST } = await loadRoute()
    // coda: workspace → documents.maybeSingle() = null (scoping fallito)
    vi.mocked(createClient).mockResolvedValue(buildSupabase([WS, { data: null, error: null }]) as never)
    const res = await POST(jsonRequest({ document_id: 'doc-altrui' }) as never)
    expect(res.status).toBe(404)
    expect(extractScopeFromPhotosMistral).not.toHaveBeenCalled()
  })

  it('catalogo illeggibile → 503 PRIMA di chiamare l\'AI (quota non consumata)', async () => {
    const { POST } = await loadRoute()
    // coda: workspace → catalog_items (await) = errore DB
    vi.mocked(createClient).mockResolvedValue(
      buildSupabase([WS, { data: null, error: { message: 'db down' } }]) as never
    )
    const res = await POST(multipartRequest([jpeg()]) as never)
    expect(res.status).toBe(503)
    expect(extractScopeFromPhotosMistral).not.toHaveBeenCalled()
    expect(extractScopeFromPhotosOpenAI).not.toHaveBeenCalled()
    expect(recordAiExtraction).not.toHaveBeenCalled()
  })
})

describe('POST /api/ai/extract-photos — prezzi SOLO dal catalogo', () => {
  it('voce con match a catalogo prende il SUO prezzo; senza match resta 0 "da prezzare"', async () => {
    const { POST } = await loadRoute()
    // coda: workspace → catalog_items (await)
    vi.mocked(createClient).mockResolvedValue(
      buildSupabase([
        WS,
        { data: [{ name: 'Sostituzione rubinetto miscelatore', unit: 'cad', unit_price: 120 }], error: null },
      ]) as never
    )
    vi.mocked(extractScopeFromPhotosMistral).mockResolvedValue({
      provider: 'mistral',
      suggested_title: 'Bagno',
      items: [
        // match col catalogo + quantità dalle note
        { description: 'Sostituzione rubinetto miscelatore', unit: 'pz', quantity: 2, quantity_from_notes: true, confidence: 0.9 },
        // nessun match → prezzo 0, quantità da compilare
        { description: 'Lavoro mai visto prima', unit: 'pz', quantity: null, quantity_from_notes: false, confidence: 0.4 },
      ],
    } as never)

    const res = await POST(multipartRequest([jpeg()], 'bagno 2 rubinetti') as never)
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.provider).toBe('mistral')
    expect(body.items).toHaveLength(2)

    const [conMatch, senzaMatch] = body.items
    expect(conMatch.unit_price).toBe(120)          // prezzo dal CATALOGO
    expect(conMatch.unit).toBe('cad')              // unità del catalogo
    expect(conMatch.price_source).toBe('catalog')
    expect(conMatch.qty_source).toBe('notes')
    expect(conMatch.quantity).toBe(2)

    expect(senzaMatch.unit_price).toBe(0)          // MAI un prezzo inventato
    expect(senzaMatch.price_source).toBe('todo')
    expect(senzaMatch.qty_source).toBe('todo')
    expect(senzaMatch.quantity).toBeNull()

    expect(recordAiExtraction).toHaveBeenCalledWith('ws-1')
  })

  it('Mistral fallisce → fallback OpenAI; entrambi giù → 502 senza consumare quota', async () => {
    const { POST } = await loadRoute()
    vi.mocked(createClient).mockResolvedValue(
      buildSupabase([WS, { data: [], error: null }]) as never
    )
    vi.mocked(extractScopeFromPhotosMistral).mockRejectedValue(new Error('mistral giù'))
    vi.mocked(extractScopeFromPhotosOpenAI).mockRejectedValue(new Error('openai giù'))

    const res = await POST(multipartRequest([jpeg()]) as never)
    expect(res.status).toBe(502)
    expect(recordAiExtraction).not.toHaveBeenCalled()
  })
})
