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
import { SDI_SEND_ATTEMPT_MARKER } from '@/lib/sdi/types'
import { isValidPivaFormat } from '@/lib/fiscal/piva'
import { getSdiQuota, recordSdiUse, sdiQuotaMessage } from '@/lib/sdi/quota'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { resolveWorkspaceForUser } from '@/lib/actions/resolve-workspace'

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
  // Valori DIGITATI ma non validi: vanno segnalati, non ignorati in silenzio
  // (prima un "ABC12" digitato nel dialog spariva e si usava il valore vecchio
  // della rubrica, o '0000000' — l'utente credeva di averlo cambiato).
  let rawDestInvalid: string | null = null
  let rawPecInvalid: string | null = null
  try {
    const raw = await request.json()
    if (raw && typeof raw === 'object') {
      const d = String(raw.codice_destinatario ?? '').trim().toUpperCase()
      if (/^[A-Z0-9]{7}$/.test(d)) bodyDest = d
      else if (d) rawDestInvalid = d
      const p = String(raw.pec ?? '').trim()
      if (/^\S+@\S+\.\S+$/.test(p)) bodyPec = p
      else if (p) rawPecInvalid = p
    }
  } catch { /* body assente */ }

  if (rawDestInvalid) {
    return NextResponse.json(
      { error: `Il codice destinatario "${rawDestInvalid}" non è valido: deve essere di 7 caratteri tra lettere e numeri. Correggilo, oppure lascialo vuoto se il cliente è un privato.` },
      { status: 422 }
    )
  }
  if (rawPecInvalid) {
    return NextResponse.json(
      { error: `L'indirizzo PEC "${rawPecInvalid}" non sembra un indirizzo valido: controllalo e riprova.` },
      { status: 422 }
    )
  }

  // ── Workspace (owner) con dati fiscali ────────────────────
  // Prima come titolare, poi come collaboratore invitato (piano Team).
  const workspace = await resolveWorkspaceForUser(supabase, user.id,
    'id, plan, name, ragione_sociale, piva, indirizzo, cap, citta, provincia, fiscal_regime')
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
  // Una fattura ANNULLATA non si trasmette (review 25 lug A3): trasmettere un
  // documento che l'app dichiara annullato lo renderebbe emesso e
  // intoccabile (nota di credito come unica correzione).
  if (doc.status === 'rejected') {
    return NextResponse.json({ error: 'Questa fattura è annullata: riattivala (o creane una nuova) prima di trasmetterla allo SDI.' }, { status: 422 })
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
  // Ritenuta d'acconto: l'XML fase 1 non ha il blocco DatiRitenuta → il totale
  // uscirebbe al netto SENZA dichiararla (rappresentazione fiscale diversa dal
  // PDF, accettata in silenzio dallo SdI). Meglio un no chiaro (audit 24 lug A1).
  if (Number((doc as { ritenuta_pct?: number }).ritenuta_pct ?? 0) > 0) {
    return NextResponse.json(
      { error: 'Le fatture con ritenuta d’acconto non sono ancora supportate per la trasmissione allo SDI.' },
      { status: 422 }
    )
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
  // Pre-check FORMALE dei dati del cliente (audit 25 lug, ricerca web: la
  // P.IVA errata è tra le PRIME cause di scarto SdI — 00305 e simili).
  // Meglio fermarsi qui che bruciare una trasmissione (e una quota) per un
  // errore di battitura. NB: la validità "reale" (P.IVA cessata) la può dire
  // solo l'Agenzia — qui si intercettano i typo evidenti.
  if (clientPiva && !isValidPivaFormat(clientPiva)) {
    return NextResponse.json(
      { error: `La P.IVA del cliente (${clientPiva}) non sembra corretta: dev'essere di 11 cifre e superare il controllo di validità. Correggila in rubrica e riprova — una P.IVA sbagliata fa scartare la fattura dallo SDI.` },
      { status: 422 }
    )
  }
  if (!clientPiva && clientCf && !/^[A-Z0-9]{11}$|^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/.test(clientCf)) {
    return NextResponse.json(
      { error: `Il Codice Fiscale del cliente (${clientCf}) non sembra corretto: controllalo in rubrica e riprova.` },
      { status: 422 }
    )
  }
  // Codice destinatario compilato ma NON valido: prima veniva sostituito in
  // SILENZIO con '0000000' (recapito generico) — la fattura arrivava allo SdI
  // ma non al canale telematico del cliente, che se ne accorgeva solo dopo.
  if (clientDest && !/^[A-Z0-9]{7}$/.test(clientDest)) {
    return NextResponse.json(
      { error: `Il codice destinatario "${clientDest}" non è valido: deve essere di 7 caratteri (lettere e numeri). Correggilo, oppure lascialo vuoto se il cliente è un privato.` },
      { status: 422 }
    )
  }

  // Salva il canale sul cliente per le prossime volte (tollerante).
  // PRIMA del pre-check indirizzo: se l'indirizzo manca, la PEC/codice
  // destinatario appena digitati non vanno persi (review 22 lug B3).
  if (bodyDest || bodyPec) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 044 non ancora in types/database.ts
    await (supabase as any)
      .from('clients')
      .update({ ...(bodyDest ? { codice_destinatario: bodyDest } : {}), ...(bodyPec ? { pec: bodyPec } : {}) })
      .eq('id', client.id as string)
  }

  // Pre-check INDIRIZZO del cessionario: lo SDI lo esige (Sede: Indirizzo,
  // CAP, Comune) e senza questo controllo l'errore arrivava CRIPTICO dal
  // provider a trasmissione già tentata ("cessionario_committente.sede.
  // indirizzo…" — successo in sandbox il 22 lug). Meglio un no chiaro prima.
  const missingClient: string[] = []
  if (!String(client.indirizzo ?? '').trim()) missingClient.push('indirizzo')
  if (!/^\d{5}$/.test(String(client.cap ?? '').trim())) missingClient.push('CAP')
  if (!String(client.citta ?? '').trim()) missingClient.push('città')
  if (missingClient.length > 0) {
    return NextResponse.json(
      { error: `Per la fattura elettronica serve l'indirizzo completo del cliente: manca ${missingClient.join(', ')}. Completa la sua scheda in rubrica e riprova.` },
      { status: 422 }
    )
  }

  // ── Quota (Pro: tetto sicurezza €50/mese · Free 8 a vita + kill-switch €15/mese) ──
  const quota = await getSdiQuota(workspace.id, workspace.plan)
  if (!quota.allowed) {
    // Il paywall "passa a Pro" ha senso solo per i limiti del piano Free; per il
    // tetto di sicurezza Pro (pro_cap) l'utente è già Pro → niente upgrade.
    const showPaywall = quota.reason === 'free_used' || quota.reason === 'budget_paused'
    return NextResponse.json(
      { error: sdiQuotaMessage(quota.reason), paywall: showPaywall, ...(showPaywall ? { upgrade_url: '/abbonamento' } : {}) },
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
  // Senza SDI_WEBHOOK_SECRET i callback verrebbero registrati con secret vuoto
  // → il nostro webhook (fail-closed) risponderebbe SEMPRE 401 e nessun esito
  // arriverebbe mai, in silenzio (review 25 lug #4). Log forte; l'invio
  // procede comunque: l'esito resta recuperabile con "Controlla l'esito ora".
  if (!process.env.SDI_WEBHOOK_SECRET) {
    console.error('[sdi] SDI_WEBHOOK_SECRET mancante: i callback esito NON funzioneranno (solo pull manuale).')
  }
  const webhookUrl = `${appUrl}/api/webhooks/sdi?secret=${process.env.SDI_WEBHOOK_SECRET ?? ''}`
  {
    // ⚠️ La configurazione va (ri)verificata a OGNI trasmissione, non solo
    // quando il flag è vuoto (review 23 lug A1): il profilo può esistere già
    // sul provider con i callback VECCHI/SBAGLIATI, e l'aggancio di quelli
    // giusti (attachCallbacks) scatta solo dentro ensureConfiguration —
    // col gate sul flag, un workspace già configurato non li avrebbe
    // aggiornati MAI. Idempotente: profilo esistente → 400/230 trattato
    // come ok + callback riallineati. Costo: 1-2 chiamate extra a invio.
    const cfg = await provider.ensureConfiguration(invoice.cedente, webhookUrl)
    if (!cfg.ok) return NextResponse.json({ error: cfg.error ?? 'Configurazione non riuscita.' }, { status: 502 })
    // Flag informativo (prima configurazione riuscita) — rilettura tollerante
    // (la colonna non è nel select tipizzato sopra)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: cfgRow } = await (supabase as any)
      .from('workspaces')
      .select('sdi_config_done_at')
      .eq('id', workspace.id)
      .maybeSingle()
    if (!cfgRow?.sdi_config_done_at) {
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
  const prevProviderId = (docX.sdi_provider_id as string | null) ?? null
  const prevSentAt = (docX.sdi_sent_at as string | null) ?? null
  const prevSdiError = (docX.sdi_error as string | null) ?? null
  const prevSnapshot = (docX.sdi_xml_snapshot as string | null) ?? null
  // ⚠️ Il claim AZZERA anche sdi_provider_id (review 23 lug M2): sul REINVIO
  // di una scartata, il vecchio uuid restava agganciato durante l'invio —
  // un retry del webhook (o un "Controlla l'esito") con la vecchia NS
  // avrebbe rimarcato 'scartata' la trasmissione NUOVA in volo, aprendo
  // alla doppia trasmissione. Senza uuid, il vecchio esito non trova nulla.
  // E azzera sdi_sent_at (review 25 lug #2): sul reinvio di una scartata la
  // vecchia data restava → un reinvio interrotto non risultava mai "orfano"
  // (né sbloccabile né controllabile) e la fattura restava inchiodata.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 044 non ancora in types/database.ts
  const { data: claimed, error: claimError } = await (supabase as any)
    .from('documents')
    .update({ sdi_status: 'inviata', sdi_provider_id: null, sdi_sent_at: null, sdi_updated_at: new Date().toISOString() })
    .eq('id', id)
    .or('sdi_status.is.null,sdi_status.eq.scartata')
    .select('id')
  if (claimError || !claimed || claimed.length === 0) {
    return NextResponse.json({ error: 'Questa fattura risulta già in trasmissione allo SDI.' }, { status: 409 })
  }

  // ── Marker "tentativo avviato" (review 25 lug, finding ALTA) ──────────────
  // Scritto DOPO il claim e PRIMA della chiamata al provider: se la lambda
  // muore dopo sendInvoice ma prima del salvataggio, il marker distingue
  // "nulla è partito" (reclaim sicuro) da "potrebbe essere partita" (reclaim
  // vietato). Se QUESTA scrittura fallisce, meglio fermarsi che inviare senza
  // rete di sicurezza: si rilascia il claim e si chiede di riprovare.
  // Azzera lo snapshot del tentativo PRECEDENTE (best-effort, tollerante
  // pre-058, review 25 lug M1): se il salvataggio del nuovo snapshot dovesse
  // fallire, "Scarica XML" non deve mai spacciare il vecchio XML per quello
  // appena trasmesso. Il rollback lo ripristina.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonna 058
  await (supabase as any)
    .from('documents')
    .update({ sdi_xml_snapshot: null })
    .eq('id', id)
    .then(({ error: e }: { error: unknown }) => { if (e) console.error('[sdi] azzeramento snapshot pre-invio non riuscito (pre-058?):', e) })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: markerRows, error: markerRowErr } = await (supabase as any)
    .from('documents')
    .update({ sdi_error: SDI_SEND_ATTEMPT_MARKER })
    .eq('id', id)
    .eq('sdi_status', 'inviata')
    .select('id')
  const markerError = markerRowErr ?? (!markerRows || markerRows.length === 0 ? new Error('marker: 0 righe (stato cambiato sotto i piedi)') : null)
  if (markerError) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('documents')
      .update({ sdi_status: prevSdiStatus, sdi_provider_id: prevProviderId, sdi_sent_at: prevSentAt, sdi_updated_at: new Date().toISOString() })
      .eq('id', id)
    if (prevSnapshot) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonna 058, best-effort
      await (supabase as any).from('documents').update({ sdi_xml_snapshot: prevSnapshot }).eq('id', id).then(() => {}, () => {})
    }
    return NextResponse.json({ error: 'Problema tecnico momentaneo: la fattura NON è stata trasmessa. Riprova.' }, { status: 502 })
  }

  // ── Invio ─────────────────────────────────────────────────
  const result = await provider.sendInvoice(invoice, xml)
  if (!result.ok) {
    // Rollback VERIFICATO con un retry (review 25 lug #6): se fallisse in
    // silenzio la fattura resterebbe 'inviata' col marker → il reclaim la
    // rifiuterebbe per sempre pur non essendo partito nulla.
    const rollbackPatch = { sdi_status: prevSdiStatus, sdi_provider_id: prevProviderId, sdi_sent_at: prevSentAt, sdi_error: prevSdiError, sdi_updated_at: new Date().toISOString() }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: rbErr } = await (supabase as any).from('documents').update(rollbackPatch).eq('id', id)
    if (rbErr) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: rbRetryErr } = await (supabase as any).from('documents').update(rollbackPatch).eq('id', id)
      if (rbRetryErr) console.error('[sdi] CRITICO: rollback claim fallito due volte — fattura', id, 'resta bloccata col marker, serve sblocco manuale:', rbRetryErr)
    }
    if (prevSnapshot) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonna 058, best-effort
      await (supabase as any).from('documents').update({ sdi_xml_snapshot: prevSnapshot }).eq('id', id).then(() => {}, () => {})
    }
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
    console.error('[sdi] stato non salvato dopo invio — RITENTO (provider_id da salvare):', updateError, result.providerId)
    // ⚠️ NON ripristinare lo stato e NON invitare al retry (audit 24 lug A3):
    // la fattura è GIÀ stata trasmessa allo SdI: un reinvio sarebbe una
    // SECONDA trasmissione fiscale. Ritento UNA volta di salvare il
    // provider_id; se fallisce ancora, la fattura resta 'inviata' (l'esito
    // si recupererà quando il provider_id sarà noto) — meglio uno stato da
    // riconciliare che una doppia trasmissione.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: retryErr } = await (supabase as any)
      .from('documents')
      .update({ sdi_sent_at: new Date().toISOString(), sdi_updated_at: new Date().toISOString(), sdi_error: null, sdi_provider_id: result.providerId })
      .eq('id', id)
    if (retryErr) {
      console.error('[sdi] provider_id NON salvato dopo 2 tentativi (riconciliazione manuale):', retryErr, id, result.providerId)
      // ⚠️ `warning`, NON `error` (review 25 lug A1): con status 200 + campo
      // error il client entrava nel ramo successo e mostrava "Fattura inviata"
      // scartando l'avviso — il "NON reinviarla" non arrivava MAI all'utente.
      return NextResponse.json({
        success: true,
        warning: 'La fattura È STATA trasmessa allo SDI, ma non sono riuscito a salvarne la conferma: NON reinviarla. Se tra qualche ora lo stato è ancora fermo, scrivici da Aiuto.',
      })
    }
  }

  await recordSdiUse(workspace.id, workspace.plan, id)

  // Snapshot dell'XML EFFETTIVAMENTE trasmesso (scelta Eli 25 lug): "Scarica XML"
  // ricostruisce dai dati attuali, che potrebbero divergere da questo. Salvarlo
  // qui congela la prova identica a ciò che è andato allo SdI. Best-effort e
  // tollerante pre-migration 058: un errore (colonna assente) NON compromette
  // la trasmissione, già andata a buon fine.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonna 058 non ancora in types/database.ts
  const { error: snapErr } = await (supabase as any)
    .from('documents')
    .update({ sdi_xml_snapshot: xml })
    .eq('id', id)
  if (snapErr) console.error('[sdi] snapshot XML non salvato (pre-058? — "Scarica XML" ricostruirà dai dati):', snapErr)

  return NextResponse.json({ success: true, mock: result.mock })
}
