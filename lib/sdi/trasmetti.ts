// ============================================================
// TRASMISSIONE SdI — il cuore estratto dalla route (11 ago 2026).
//
// PERCHÉ: il pilota automatico (decisione Eli: «di default automatico deve
// essere acceso») trasmette dal CRON, dove non esiste una sessione utente.
// La logica — con TUTTE le guardie accumulate nei collaudi di luglio (claim
// atomico, marker anti-doppio-invio, rollback verificato, quota, tetto NC,
// coerenza 00421) — vive qui, identica; la route e il cron sono due
// involucri sottili sopra questa funzione.
//
// ⚠️ NON riordinare le guardie: ogni blocco ha la sua storia (commenti nel
// corpo). L'esito è { status, body } — la route lo traduce in NextResponse,
// il cron lo legge e decide se riprogrammare.
// ============================================================

import { getSdiProvider, buildFatturaPaXml, ritenutaPerXml, type SdiInvoice } from '@/lib/sdi'
import { numeroFiscale } from '@/lib/sdi/doc-xml'
import { superaIlTetto, baseStornabile } from '@/lib/documents/storno'
import { SDI_SEND_ATTEMPT_MARKER } from '@/lib/sdi/types'
import { forfettarioCausale } from '@/lib/sdi/causale'
import { isValidPivaFormat } from '@/lib/fiscal/piva'
import { getSdiQuota, recordSdiUse, sdiQuotaMessage } from '@/lib/sdi/quota'
import { logSecurityEvent } from '@/lib/security/events'
import { giornoItaliano } from '@/lib/sdi/termini'
import { espandiBeniSignificativi, type VoceSplittabile } from '@/lib/fiscal/beni-significativi'

const REGIME_MAP: Record<string, 'RF19' | 'RF01' | 'RF02'> = {
  forfettario: 'RF19',
  ordinario: 'RF01',
  minimi: 'RF02',
}

export interface WorkspaceTrasmissione {
  id: string
  plan: string
  name: string
  ragione_sociale: string | null
  piva: string | null
  indirizzo: string | null
  cap: string | null
  citta: string | null
  provincia: string | null
  fiscal_regime: string
}

export interface EsitoTrasmissione {
  status: number
  body: Record<string, unknown>
}

export async function trasmettiDocumentoSdi(opts: {
  /** Client Supabase con i permessi giusti: di sessione (route) o admin (cron) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 044+ non nei tipi
  supabase: any
  workspace: WorkspaceTrasmissione
  docId: string
  /** Chi trasmette (per il registro di sicurezza); il cron passa l'owner */
  userId: string
  /** Email del cedente nell'XML (contatto); il cron passa quella dell'owner */
  userEmail: string | null
  /** Canale telematico digitato nel dialog (solo route; il cron passa null) */
  bodyDest: string | null
  bodyPec: string | null
}): Promise<EsitoTrasmissione> {
  const { supabase, workspace, userId, userEmail, bodyDest, bodyPec } = opts
  const id = opts.docId

  const missingWs: string[] = []
  // La P.IVA del CEDENTE compare su OGNI fattura: se è sbagliata lo scarto è
  // sistematico → stesso checksum applicato al cliente (review 25 lug F5).
  if (!workspace.piva || !isValidPivaFormat(workspace.piva)) missingWs.push('P.IVA')
  if (!workspace.indirizzo) missingWs.push('indirizzo')
  if (!workspace.cap) missingWs.push('CAP')
  if (!workspace.citta) missingWs.push('città')
  if (!workspace.provincia) missingWs.push('provincia')
  if (missingWs.length > 0) {
    return { status: 422, body: { error: `Completa i tuoi dati fiscali in Impostazioni: manca ${missingWs.join(', ')}.` } }
  }

  // ── Fattura con voci e cliente ────────────────────────────
  const { data: doc } = await supabase
    .from('documents')
    .select('*, document_items(*), clients!client_id(*)')
    .eq('id', id)
    .eq('workspace_id', workspace.id)
    // ⚠️ Anche le NOTE DI CREDITO: una TD04 che resta nell'app non storna
    // nulla — per l'Agenzia la fattura originale è ancora intera. È la
    // trasmissione a farla esistere.
    .in('doc_type', ['fattura', 'nota_credito', 'nota_debito'])
    .is('deleted_at', null)
    .maybeSingle()
  if (!doc) return { status: 404, body: { error: 'Fattura non trovata' } }
  const isNotaCredito = doc.doc_type === 'nota_credito'
  // Nota di DEBITO (TD05): stesse guardie della nota di credito — deve
  // riferirsi a una fattura davvero trasmessa — MENO il tetto, che qui non
  // ha senso: si sta integrando, non stornando, e quanto integrare lo sa
  // solo l'artigiano.
  const isNotaDebito = doc.doc_type === 'nota_debito'
  const isNota = isNotaCredito || isNotaDebito
  const nomeNota = isNotaDebito ? 'nota di debito' : 'nota di credito'
  if (doc.status === 'draft') {
    return { status: 422, body: {
      error: isNota
        ? `Invia prima la ${nomeNota} al cliente: le bozze non si trasmettono allo SdI.`
        : 'Invia prima la fattura al cliente (o segnala definitiva): le bozze non si trasmettono allo SdI.',
    } }
  }
  // Una fattura ANNULLATA non si trasmette (review 25 lug A3): trasmettere un
  // documento che l'app dichiara annullato lo renderebbe emesso e
  // intoccabile (nota di credito come unica correzione).
  if (doc.status === 'rejected') {
    return { status: 422, body: { error: 'Questa fattura è annullata: riattivala (o creane una nuova) prima di trasmetterla allo SdI.' } }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 044 non ancora in types/database.ts
  const docX = doc as any
  if (docX.sdi_status && docX.sdi_status !== 'scartata') {
    return { status: 409, body: { error: 'Questa fattura è già stata trasmessa allo SdI.' } }
  }
  if (!doc.doc_number) {
    return { status: 422, body: { error: 'La fattura non ha ancora un numero.' } }
  }

  const client = doc.clients as Record<string, unknown> | null
  if (!client) return { status: 422, body: { error: 'Associa un cliente alla fattura prima di trasmetterla.' } }

  type VoceRiga = { description?: unknown; discount_pct?: unknown; vat_rate?: unknown; quantity?: unknown; unit_price?: unknown; total?: unknown; bene_significativo?: unknown }
  // ⚠️ BENI SIGNIFICATIVI (081): la voce marcata si spezza in due — quota al
  // 10% ed eccedenza al 22% — PRIMA di costruire l'XML. Stessa funzione
  // (idempotente) del motore fiscale: righe e riepilogo non possono divergere
  // dal PDF che il cliente ha in mano.
  const items = espandiBeniSignificativi(
    ((doc.document_items ?? []) as VoceRiga[]).filter(
      (i) => String(i.description ?? '').trim() !== ''
    ) as unknown as VoceSplittabile[],
    workspace.fiscal_regime,
    (doc as { vat_rate_default?: number | null }).vat_rate_default,
  ) as unknown as VoceRiga[]
  if (items.length === 0) {
    return { status: 422, body: { error: 'La fattura non ha voci.' } }
  }

  // ── Limiti fase 1: l'XML non rappresenta ancora sconti né riepiloghi
  // multi-aliquota — trasmettere produrrebbe uno scarto SdI (o peggio,
  // un XML con importi diversi dal PDF). Meglio un no chiaro subito.
  const hasDiscount =
    Number(doc.discount_pct ?? 0) > 0 ||
    Number(doc.discount_fixed ?? 0) > 0 ||
    items.some((i) => Number(i.discount_pct ?? 0) > 0)
  if (hasDiscount) {
    return { status: 422, body: { error: 'Le fatture con sconti non sono ancora supportate per la trasmissione allo SdI. Crea la fattura con i prezzi già scontati e riprova.' } }
  }
  // Le ALIQUOTE DIVERSE sono ora supportate: `DatiRiepilogo` esce con un
  // blocco per aliquota (081) — serviva dai beni significativi, che per
  // costruzione producono sempre due aliquote (10% e 22%).
  // La RITENUTA è ora dichiarata nell'XML (081): blocco `DatiRitenuta` e
  // `Ritenuta = SI` su ogni riga (senza, scarto 00415). Il rifiuto del
  // 24 lug non serve più.

  // Canale del cessionario: body → rubrica → '0000000' (privato senza canale)
  const clientDest = bodyDest ?? (String(client.codice_destinatario ?? '').trim().toUpperCase() || null)
  const clientPec = bodyPec ?? (String(client.pec ?? '').trim() || null)
  const codiceDestinatario = clientDest && /^[A-Z0-9]{7}$/.test(clientDest) ? clientDest : '0000000'

  const clientPiva = String(client.piva ?? '').replace(/\D/g, '') || null
  const clientCf = String(client.codice_fiscale ?? '').trim().toUpperCase() || null
  if (!clientPiva && !clientCf) {
    return { status: 422, body: { error: 'Al cliente manca P.IVA o Codice Fiscale: aggiungilo in rubrica e riprova.' } }
  }
  // Pre-check FORMALE dei dati del cliente (audit 25 lug, ricerca web: la
  // P.IVA errata è tra le PRIME cause di scarto SdI — 00305 e simili).
  // Meglio fermarsi qui che bruciare una trasmissione (e una quota) per un
  // errore di battitura. NB: la validità "reale" (P.IVA cessata) la può dire
  // solo l'Agenzia — qui si intercettano i typo evidenti.
  if (clientPiva && !isValidPivaFormat(clientPiva)) {
    return { status: 422, body: { error: `La P.IVA del cliente (${clientPiva}) non sembra corretta: dev'essere di 11 cifre e superare il controllo di validità. Correggila in rubrica e riprova — una P.IVA sbagliata fa scartare la fattura dallo SdI.` } }
  }
  // ⚠️ La regex ammette l'OMOCODIA (review 25 lug F2): quando due persone
  // avrebbero lo stesso CF, l'Agenzia sostituisce alcune CIFRE con lettere
  // (L M N P Q R S T U V). Un pattern rigido a sole cifre rifiuterebbe CF
  // VALIDI — e il ramo scatta proprio sui privati, il caso più comune.
  // Il ramo a 11 caratteri copre il CF numerico degli enti.
  const CF_PERSONA = /^[A-Z]{6}[0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/
  const CF_ENTE = /^[0-9]{11}$/
  if (clientCf && !CF_PERSONA.test(clientCf) && !CF_ENTE.test(clientCf)) {
    return { status: 422, body: { error: `Il Codice Fiscale del cliente (${clientCf}) non sembra corretto: controllalo in rubrica e riprova.` } }
  }
  // Codice destinatario compilato ma NON valido: prima veniva sostituito in
  // SILENZIO con '0000000' (recapito generico) — la fattura arrivava allo SdI
  // ma non al canale telematico del cliente, che se ne accorgeva solo dopo.
  if (clientDest && !/^[A-Z0-9]{7}$/.test(clientDest)) {
    return { status: 422, body: { error: `Il codice destinatario "${clientDest}" non è valido: deve essere di 7 caratteri (lettere e numeri). Correggilo, oppure lascialo vuoto se il cliente è un privato.` } }
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

  // Pre-check INDIRIZZO del cessionario: lo SdI lo esige (Sede: Indirizzo,
  // CAP, Comune) e senza questo controllo l'errore arrivava CRIPTICO dal
  // provider a trasmissione già tentata ("cessionario_committente.sede.
  // indirizzo…" — successo in sandbox il 22 lug). Meglio un no chiaro prima.
  const missingClient: string[] = []
  if (!String(client.indirizzo ?? '').trim()) missingClient.push('indirizzo')
  if (!/^\d{5}$/.test(String(client.cap ?? '').trim())) missingClient.push('CAP')
  if (!String(client.citta ?? '').trim()) missingClient.push('città')
  if (missingClient.length > 0) {
    return { status: 422, body: { error: `Per la fattura elettronica serve l'indirizzo completo del cliente: manca ${missingClient.join(', ')}. Completa la sua scheda in rubrica e riprova.` } }
  }

  // ── Quota (Pro: tetto sicurezza €50/mese · Free 8 a vita + kill-switch €15/mese) ──
  const quota = await getSdiQuota(workspace.id, workspace.plan)
  if (!quota.allowed) {
    // Il paywall "passa a Pro" ha senso solo per i limiti del piano Free; per il
    // tetto di sicurezza Pro (pro_cap) l'utente è già Pro → niente upgrade.
    const showPaywall = quota.reason === 'free_used' || quota.reason === 'budget_paused'
    return { status: 403, body: { error: sdiQuotaMessage(quota.reason), paywall: showPaywall, ...(showPaywall ? { upgrade_url: '/abbonamento' } : {}) } }
  }

  // ── Costruisci la fattura per il layer SdI ────────────────
  const regime = REGIME_MAP[workspace.fiscal_regime] ?? 'RF19'
  const isForf = regime === 'RF19'
  // L'inversione contabile vale SOLO fra soggetti IVA: senza la P.IVA del
  // cliente la fattura sarebbe sbagliata (e l'IVA non l'avrebbe versata
  // nessuno). Meglio fermarsi qui che trasmetterla.
  if (!isForf
      && (doc as { reverse_charge?: boolean | null }).reverse_charge === true
      && !String(client.piva ?? '').replace(/\D/g, '')) {
    return { status: 422, body: { error: 'L’inversione contabile vale solo fra titolari di partita IVA, ma il cliente in rubrica non ne ha una. Aggiungila in rubrica, oppure togli la spunta e addebita l’IVA normalmente.' } }
  }

  // ⚠️ Inversione contabile: la dicitura di legge va SCRITTA nel documento —
  // è ciò che spiega al committente perché deve integrare lui l'imposta.
  const isReverse = !isForf && (doc as { reverse_charge?: boolean | null }).reverse_charge === true
  const causale = isForf
    ? forfettarioCausale()
    : isReverse ? 'Inversione contabile - art. 17, comma 6, lett. a-ter, DPR 633/1972 - IVA assolta dal committente' : null

  // ⚠️ `numeroFiscale` toglie solo i prefissi storici Prev/Fatt, NON «NC»:
  // la nota di credito ha una numerazione separata e «NC001/2026» non è
  // «001/2026» (che è una fattura diversa, già trasmessa).
  const numeroPulito = numeroFiscale(doc.doc_number)

  // ── Nota di credito: riferimento alla fattura stornata (DatiFattureCollegate) ──
  let fatturaCollegata: { numero: string; data: string } | null = null
  if (isNota) {
    const originId = (docX.origin_document_id as string | null) ?? null
    if (!originId) {
      return { status: 422, body: { error: `Questa ${nomeNota} non è collegata a nessuna fattura: senza il riferimento alla fattura ${isNotaDebito ? 'integrata' : 'stornata'} lo SdI non saprebbe cosa stai correggendo.` } }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 044 non ancora in types/database.ts
    const { data: orig } = await (supabase as any)
      .from('documents')
      .select('doc_number, created_at, sdi_status, total, bollo_amount')
      .eq('id', originId)
      .eq('workspace_id', workspace.id)
      .maybeSingle()
    // ⚖️ La fattura stornata dev'essere DAVVERO passata dallo SdI (decisione
    // Eli, 9 ago: *"se crea rischio non facciamolo"*).
    // Una nota di credito non corregge un documento: rettifica un'operazione
    // che l'Agenzia ha già registrato. Su una fattura mai trasmessa la TD04
    // chiederebbe indietro un'IVA mai dichiarata — un secondo buco al posto
    // del primo, e per giunta irreversibile (una nota trasmessa si compensa
    // solo con una nota di DEBITO).
    // Oggi il tasto «Crea nota di credito» compare già solo sulle fatture
    // trasmesse: questa è la rete sotto, non la porta.
    // ⚠️ Fallisce CHIUSO: se lo stato non si riesce a leggere, non si
    // trasmette — su una dichiarazione IVA il dubbio non è un via libera.
    const origSdi = (orig as { sdi_status?: string | null } | null)?.sdi_status ?? null
    if (!origSdi || origSdi === 'scartata') {
      return { status: 422, body: {
          error: isNotaDebito
            ? 'La fattura che questa nota vuole integrare non risulta trasmessa allo SdI: per l’Agenzia non è ancora stata emessa. Correggila direttamente e mandala di nuovo al cliente.'
            : 'La fattura che questa nota vuole stornare non risulta trasmessa allo SdI: per l’Agenzia non è ancora stata emessa, quindi non c’è nulla da stornare. Se la fattura è sbagliata, correggila e mandala di nuovo al cliente; se non va più fatta, annullala.',
        } }
    }
    if (!orig?.doc_number) {
      return { status: 422, body: { error: `La fattura collegata a questa ${nomeNota} non è più disponibile: senza il suo numero la nota non si può trasmettere.` } }
    }

    // ⚖️ IL TETTO (decisione Eli, 10 ago — è QUI che blocca): questa nota,
    // sommata alle sorelle GIÀ TRASMESSE, non deve superare il totale della
    // fattura — si stornerebbe più di quanto dichiarato all'Agenzia. Le bozze
    // non contano: non hanno ancora stornato niente, e ognuna verrà
    // ricontrollata alla SUA trasmissione. FAIL-CLOSED: se le sorelle o il
    // totale non si leggono, non si trasmette.
    const tettoOk = !isNotaCredito ? { supera: false, somma: 0, totFattura: 0 } : await (supabase as any) // eslint-disable-line @typescript-eslint/no-explicit-any -- colonne 044 non nei tipi
      .from('documents')
      .select('id, total, bollo_amount, sdi_status')
      .eq('workspace_id', workspace.id)
      .eq('doc_type', 'nota_credito')
      .eq('origin_document_id', originId)
      .is('deleted_at', null)
      .then(
        (r: { data: Array<{ id: string; total: number | null; bollo_amount?: number | null; sdi_status?: string | null }> | null; error: unknown }) => {
          if (r.error || !r.data) return null
          const sorelleTrasmesse = r.data.filter(
            (n) => n.id !== id && !!n.sdi_status && n.sdi_status !== 'scartata'
          )
          // Tutto in BASI (totale − bollo del rispettivo documento): il bollo
          // non è un'operazione stornabile, e da quando anche la nota porta
          // il suo (N4, 11 ago) va tolto pure dalle sorelle e da questa nota.
          const somma = sorelleTrasmesse.reduce(
            (s, n) => s + baseStornabile(Number(n.total ?? 0), Number(n.bollo_amount ?? 0)),
            0,
          )
          const o = orig as { total?: number | null; bollo_amount?: number | null } | null
          const totFattura = Number(o?.total ?? NaN)
          if (!Number.isFinite(totFattura)) return null
          const base = baseStornabile(totFattura, Number(o?.bollo_amount ?? 0))
          const baseNota = baseStornabile(
            Number(doc.total ?? 0),
            Number((doc as { bollo_amount?: number | null }).bollo_amount ?? 0),
          )
          return { supera: superaIlTetto(baseNota, somma, base), somma, totFattura: base }
        },
        () => null,
      )
    if (!tettoOk) {
      return { status: 422, body: { error: 'Non riesco a verificare quanto è già stato stornato su questa fattura: la nota non si trasmette finché il controllo non riesce. Riprova.' } }
    }
    if (tettoOk.supera) {
      const residuo = Math.max(0, Math.round((tettoOk.totFattura - tettoOk.somma) * 100) / 100)
      return { status: 422, body: { error: `Questa nota storna più di quanto resta da stornare: l'importo stornabile della fattura è ${tettoOk.totFattura.toFixed(2)} € (il bollo non si storna) e le note già trasmesse ne coprono ${tettoOk.somma.toFixed(2)} €. Riduci gli importi della nota entro ${residuo.toFixed(2)} € e riprova.` } }
    }

    fatturaCollegata = {
      numero: numeroFiscale(orig.doc_number),
      // doc_date della fattura stornata (080), con fallback legacy: lettura
      // tollerante a parte, come sopra.
      data: await supabase
        .from('documents')
        .select('doc_date')
        .eq('id', originId)
        .maybeSingle()
        .then(
          (r: { data: { doc_date?: string | null } | null; error: unknown }) =>
            (!r.error && r.data?.doc_date) ? String(r.data.doc_date) : String(orig.created_at ?? '').slice(0, 10),
          () => String(orig.created_at ?? '').slice(0, 10),
        ),
    }
  }

  // ── La DATA fiscale (080): doc_date nasce alla conferma della bozza.
  // Lettura tollerante (pre-080 la colonna non c'è): senza doc_date si usa
  // — e si fissa — OGGI, così l'XML e il conto dei 12 giorni coincidono.
  // Un documento legacy confermato prima della 080 ha doc_date dal backfill.
  let dataFiscale: string | null = await supabase
    .from('documents')
    .select('doc_date')
    .eq('id', id)
    .maybeSingle()
    .then(
      (r: { data: { doc_date?: string | null } | null; error: unknown }) =>
        r.error ? null : (r.data?.doc_date ?? null),
      () => null,
    )
  if (!dataFiscale) {
    dataFiscale = giornoItaliano(new Date())
    await supabase
      .from('documents')
      .update({ doc_date: dataFiscale })
      .eq('id', id)
      .then(() => {}, () => {})
  }

  const invoice: SdiInvoice = {
    numero: numeroPulito,
    data: dataFiscale,
    cedente: {
      denominazione: workspace.ragione_sociale ?? workspace.name,
      piva: workspace.piva!.replace(/\D/g, ''),
      codiceFiscale: null,
      indirizzo: workspace.indirizzo!,
      cap: workspace.cap!,
      citta: workspace.citta!,
      provincia: workspace.provincia!,
      regimeFiscale: regime,
      email: userEmail,
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
    ritenuta: ritenutaPerXml(
      Number((doc as { ritenuta_pct?: number | null }).ritenuta_pct ?? 0),
      Number(doc.subtotal ?? 0),
      (doc as { ritenuta_causale?: string | null }).ritenuta_causale,
      workspace.ragione_sociale ?? workspace.name,
    ),
    // Inversione contabile (081): righe e riepilogo escono a natura N6.7.
    reverseCharge: (doc as { reverse_charge?: boolean | null }).reverse_charge === true,
    causale,
    // ⚠️ Gli importi restano POSITIVI anche nella TD04: è il tipo di documento
    // a dire che si tratta di uno storno (istruzioni AdE alla compilazione).
    tipoDocumento: isNotaCredito ? 'TD04' : isNotaDebito ? 'TD05' : 'TD01',
    fatturaCollegata,
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
    if (!cfg.ok) return { status: 502, body: { error: cfg.error ?? 'Configurazione non riuscita.' } }
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
    return { status: 409, body: { error: 'Questa fattura risulta già in trasmissione allo SdI.' } }
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
    return { status: 502, body: { error: 'Problema tecnico momentaneo: la fattura NON è stata trasmessa. Riprova.' } }
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
    return { status: 502, body: { error: result.error } }
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
      // Anche in questo ramo il pilota non ha più niente da fare: la
      // trasmissione È avvenuta — senza questo azzeramento sdi_auto_at
      // resterebbe valorizzato per sempre (review 11 ago; innocuo per il
      // cron, che filtra su sdi_status, ma è stato sporco).
      await supabase
        .from('documents')
        .update({ sdi_auto_at: null })
        .eq('id', id)
        .then(() => {}, () => {})
      // ⚠️ `warning`, NON `error` (review 25 lug A1): con status 200 + campo
      // error il client entrava nel ramo successo e mostrava "Fattura inviata"
      // scartando l'avviso — il "NON reinviarla" non arrivava MAI all'utente.
      return { status: 200, body: {
        success: true,
        warning: 'La fattura È STATA trasmessa allo SdI, ma non sono riuscito a salvarne la conferma: NON reinviarla. Se tra qualche ora lo stato è ancora fermo, scrivici da Aiuto.',
      } }
    }
  }

  // Il pilota automatico non ha più niente da fare su questo documento
  // (best-effort, tollerante pre-080).
  await supabase
    .from('documents')
    .update({ sdi_auto_at: null })
    .eq('id', id)
    .then(() => {}, () => {})

  await recordSdiUse(workspace.id, workspace.plan, id)

  // Registro di sicurezza: una trasmissione fiscale è un evento che conta.
  // Solo etichette (regola 072): nessun numero di fattura, nessun importo.
  await logSecurityEvent({
    kind: 'sdi_sent',
    userId,
    workspaceId: workspace.id,
    meta: { mock: result.mock === true },
  })

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

  return { status: 200, body: { success: true, mock: result.mock } }
}
