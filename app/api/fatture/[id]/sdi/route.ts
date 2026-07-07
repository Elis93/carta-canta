// ============================================================
// POST /api/fatture/[id]/sdi
// Invia la fattura allo SDI (fase 1: SOLO INVIO) tramite il layer
// di astrazione lib/sdi/. Con provider mock (nessuna chiave OpenAPI)
// il flusso è di PROVA: nessuna trasmissione reale.
// Body opzionale: { codice_destinatario?, pec? } → salvati sul cliente.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSdiProvider, buildFatturaPaXml, type SdiInvoice } from '@/lib/sdi'
import { getSdiQuota, recordSdiUse, sdiQuotaMessage } from '@/lib/sdi/quota'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

const SDI_ENABLED = process.env.NEXT_PUBLIC_SDI_ENABLED === 'true'

const REGIME_MAP: Record<string, 'RF19' | 'RF01' | 'RF02'> = {
  forfettario: 'RF19',
  ordinario: 'RF01',
  minimi: 'RF02',
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!SDI_ENABLED) {
    return NextResponse.json({ error: 'La fatturazione elettronica non è ancora attiva.' }, { status: 403 })
  }

  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const rl = checkRateLimit(`sdi:${user.id}`, { limit: 10, windowMs: 60_000 })
  if (!rl.success) return rateLimitResponse(rl.resetAt, 'Troppi invii ravvicinati. Attendi un momento.')

  // Body opzionale: canale telematico del cliente da salvare
  let bodyDest: string | null = null
  let bodyPec: string | null = null
  try {
    const raw = await request.json()
    if (raw && typeof raw === 'object') {
      const d = String(raw.codice_destinatario ?? '').trim().toUpperCase()
      if (/^[A-Z0-9]{7}$/.test(d)) bodyDest = d
      const p = String(raw.pec ?? '').trim()
      if (/^\S+@\S+\.\S+$/.test(p)) bodyPec = p
    }
  } catch { /* body assente */ }

  // ── Workspace (owner) con dati fiscali ────────────────────
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, plan, name, ragione_sociale, piva, indirizzo, cap, citta, provincia, fiscal_regime')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!workspace) return NextResponse.json({ error: 'Workspace non trovato' }, { status: 404 })

  const missingWs: string[] = []
  if (!workspace.piva || !/^\d{11}$/.test(workspace.piva.replace(/\D/g, ''))) missingWs.push('P.IVA')
  if (!workspace.indirizzo) missingWs.push('indirizzo')
  if (!workspace.cap) missingWs.push('CAP')
  if (!workspace.citta) missingWs.push('città')
  if (!workspace.provincia) missingWs.push('provincia')
  if (missingWs.length > 0) {
    return NextResponse.json(
      { error: `Completa i tuoi dati fiscali in Impostazioni: manca ${missingWs.join(', ')}.` },
      { status: 422 }
    )
  }

  // ── Fattura con voci e cliente ────────────────────────────
  const { data: doc } = await supabase
    .from('documents')
    .select('*, document_items(*), clients!client_id(*)')
    .eq('id', id)
    .eq('workspace_id', workspace.id)
    .eq('doc_type', 'fattura')
    .is('deleted_at', null)
    .maybeSingle()
  if (!doc) return NextResponse.json({ error: 'Fattura non trovata' }, { status: 404 })
  if (doc.status === 'draft') {
    return NextResponse.json({ error: 'Invia prima la fattura al cliente (o segnala definitiva): le bozze non si trasmettono allo SDI.' }, { status: 422 })
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 044 non ancora in types/database.ts
  const docX = doc as any
  if (docX.sdi_status && docX.sdi_status !== 'scartata') {
    return NextResponse.json({ error: 'Questa fattura è già stata trasmessa allo SDI.' }, { status: 409 })
  }
  if (!doc.doc_number) {
    return NextResponse.json({ error: 'La fattura non ha ancora un numero.' }, { status: 422 })
  }

  const client = doc.clients as Record<string, unknown> | null
  if (!client) return NextResponse.json({ error: 'Associa un cliente alla fattura prima di trasmetterla.' }, { status: 422 })

  const items = (doc.document_items ?? []).filter(
    (i) => String(i.description ?? '').trim() !== ''
  )
  if (items.length === 0) {
    return NextResponse.json({ error: 'La fattura non ha voci.' }, { status: 422 })
  }

  // ── Limiti fase 1: l'XML non rappresenta ancora sconti né riepiloghi
  // multi-aliquota — trasmettere produrrebbe uno scarto SDI (o peggio,
  // un XML con importi diversi dal PDF). Meglio un no chiaro subito.
  const hasDiscount =
    Number(doc.discount_pct ?? 0) > 0 ||
    Number(doc.discount_fixed ?? 0) > 0 ||
    items.some((i) => Number(i.discount_pct ?? 0) > 0)
  if (hasDiscount) {
    return NextResponse.json(
      { error: 'Le fatture con sconti non sono ancora supportate per la trasmissione allo SDI. Crea la fattura con i prezzi già scontati e riprova.' },
      { status: 422 }
    )
  }
  if (workspace.fiscal_regime !== 'forfettario') {
    const rates = new Set(items.map((i) => Number(i.vat_rate ?? doc.vat_rate_default ?? 22)))
    if (rates.size > 1) {
      return NextResponse.json(
        { error: 'Le fatture con aliquote IVA diverse tra le voci non sono ancora supportate per la trasmissione allo SDI.' },
        { status: 422 }
      )
    }
  }

  // Canale del cessionario: body → rubrica → '0000000' (privato senza canale)
  const clientDest = bodyDest ?? (String(client.codice_destinatario ?? '').trim().toUpperCase() || null)
  const clientPec = bodyPec ?? (String(client.pec ?? '').trim() || null)
  const codiceDestinatario = clientDest && /^[A-Z0-9]{7}$/.test(clientDest) ? clientDest : '0000000'

  const clientPiva = String(client.piva ?? '').replace(/\D/g, '') || null
  const clientCf = String(client.codice_fiscale ?? '').trim().toUpperCase() || null
  if (!clientPiva && !clientCf) {
    return NextResponse.json(
      { error: 'Al cliente manca P.IVA o Codice Fiscale: aggiungilo in rubrica e riprova.' },
      { status: 422 }
    )
  }

  // Salva il canale sul cliente per le prossime volte (tollerante)
  if (bodyDest || bodyPec) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 044 non ancora in types/database.ts
    await (supabase as any)
      .from('clients')
      .update({ ...(bodyDest ? { codice_destinatario: bodyDest } : {}), ...(bodyPec ? { pec: bodyPec } : {}) })
      .eq('id', client.id as string)
  }

  // ── Quota (Pro illimitato · Free 8 a vita + kill-switch €15/mese) ──
  const quota = await getSdiQuota(workspace.id, workspace.plan)
  if (!quota.allowed) {
    return NextResponse.json(
      { error: sdiQuotaMessage(quota.reason), paywall: quota.reason !== 'unavailable', upgrade_url: '/abbonamento' },
      { status: 403 }
    )
  }

  // ── Costruisci la fattura per il layer SDI ────────────────
  const regime = REGIME_MAP[workspace.fiscal_regime] ?? 'RF19'
  const isForf = regime === 'RF19'
  const causale = isForf
    ? 'Operazione effettuata ai sensi dell’art. 1, commi da 54 a 89, della Legge n. 190/2014 e successive modificazioni — regime forfettario. Operazione senza applicazione dell’IVA.'
    : null

  const numeroPulito = doc.doc_number.replace(/^[A-Za-z]+/, '')
  const invoice: SdiInvoice = {
    numero: numeroPulito,
    data: (doc.created_at ?? new Date().toISOString()).slice(0, 10),
    cedente: {
      denominazione: workspace.ragione_sociale ?? workspace.name,
      piva: workspace.piva!.replace(/\D/g, ''),
      codiceFiscale: null,
      indirizzo: workspace.indirizzo!,
      cap: workspace.cap!,
      citta: workspace.citta!,
      provincia: workspace.provincia!,
      regimeFiscale: regime,
      email: user.email ?? null,
    },
    cessionario: {
      denominazione: [client.name, client.surname].filter(Boolean).join(' ') || 'Cliente',
      piva: clientPiva,
      codiceFiscale: clientCf,
      indirizzo: (client.indirizzo as string | null) ?? null,
      cap: (client.cap as string | null) ?? null,
      citta: (client.citta as string | null) ?? null,
      provincia: (client.provincia as string | null) ?? null,
      codiceDestinatario,
      pec: clientPec,
    },
    righe: items.map((i) => ({
      descrizione: String(i.description),
      quantita: Number(i.quantity ?? 1),
      prezzoUnitario: Number(i.unit_price ?? 0),
      totale: Number(i.total ?? 0),
      aliquotaIva: Number(i.vat_rate ?? doc.vat_rate_default ?? 22),
    })),
    imponibile: Number(doc.subtotal ?? 0),
    imposta: Number(doc.tax_amount ?? 0),
    totale: Number(doc.total ?? 0),
    bollo: Number(doc.bollo_amount ?? 0),
    causale,
  }

  const xml = buildFatturaPaXml(invoice)
  const provider = getSdiProvider()

  // Configurazione anagrafica sul provider — una volta per workspace
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonna 044 non ancora in types/database.ts
  const wsX = workspace as any
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://cartacanta.app'
  const webhookUrl = `${appUrl}/api/webhooks/sdi?secret=${process.env.SDI_WEBHOOK_SECRET ?? ''}`
  {
    // Rilettura tollerante del flag (non è nel select tipizzato sopra)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: cfgRow } = await (supabase as any)
      .from('workspaces')
      .select('sdi_config_done_at')
      .eq('id', workspace.id)
      .maybeSingle()
    if (!cfgRow?.sdi_config_done_at) {
      const cfg = await provider.ensureConfiguration(invoice.cedente, webhookUrl)
      if (!cfg.ok) return NextResponse.json({ error: cfg.error ?? 'Configurazione non riuscita.' }, { status: 502 })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('workspaces')
        .update({ sdi_config_done_at: new Date().toISOString() })
        .eq('id', wsX.id)
    }
  }

  // ── Claim atomico anti doppio-invio ───────────────────────
  // Solo UNA richiesta concorrente può portare sdi_status a 'inviata'
  // (da null o da 'scartata'): la seconda non trova righe e riceve 409.
  // Se poi il provider fallisce, lo stato viene ripristinato.
  const prevSdiStatus = (docX.sdi_status as string | null) ?? null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 044 non ancora in types/database.ts
  const { data: claimed, error: claimError } = await (supabase as any)
    .from('documents')
    .update({ sdi_status: 'inviata', sdi_updated_at: new Date().toISOString() })
    .eq('id', id)
    .or('sdi_status.is.null,sdi_status.eq.scartata')
    .select('id')
  if (claimError || !claimed || claimed.length === 0) {
    return NextResponse.json({ error: 'Questa fattura risulta già in trasmissione allo SDI.' }, { status: 409 })
  }

  // ── Invio ─────────────────────────────────────────────────
  const result = await provider.sendInvoice(invoice, xml)
  if (!result.ok) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('documents')
      .update({ sdi_status: prevSdiStatus, sdi_updated_at: new Date().toISOString() })
      .eq('id', id)
    return NextResponse.json({ error: result.error }, { status: 502 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 044 non ancora in types/database.ts
  const { error: updateError } = await (supabase as any)
    .from('documents')
    .update({
      sdi_sent_at: new Date().toISOString(),
      sdi_updated_at: new Date().toISOString(),
      sdi_error: null,
      sdi_provider_id: result.providerId,
    })
    .eq('id', id)
  if (updateError) {
    console.error('[sdi] stato non salvato dopo invio:', updateError)
    // Senza provider_id il webhook non troverà mai questa fattura e ogni
    // reinvio prenderebbe 409: meglio ripristinare e far riprovare.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('documents')
      .update({ sdi_status: prevSdiStatus, sdi_updated_at: new Date().toISOString() })
      .eq('id', id)
    return NextResponse.json({ error: 'Invio riuscito ma stato non salvato: riprova tra un momento.' }, { status: 500 })
  }

  await recordSdiUse(workspace.id, workspace.plan, id)

  return NextResponse.json({ success: true, mock: result.mock })
}
