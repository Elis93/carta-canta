// PATCH /api/fatture/[id]/status
// Cambia stato di una fattura manualmente.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v4'
import { createClient } from '@/lib/supabase/server'
import { isMissingColumnError } from '@/lib/supabase/errors'
import { revalidatePath } from 'next/cache'
import { spiegaTransizioneRifiutata } from '@/lib/documents/transizioni'
import { registraConfermaFiscale, azzeraConfermaFiscale, fermaPilotaSdi } from '@/lib/documents/conferma-fiscale'

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  draft:   ['accepted', 'rejected'],
  sent:    ['accepted', 'rejected'],
  viewed:  ['accepted', 'rejected'],
  // Una fattura SCADUTA è proprio quella da incassare (pagamento in ritardo)
  // o da annullare: senza questa riga l'incasso tardivo era impossibile.
  expired: ['accepted', 'rejected'],
  // Riattiva una fattura annullata (19 lug) → torna in BOZZA, modificabile e
  // reinviabile. Consentito SOLO finché la fattura NON è stata trasmessa allo
  // SdI (guardia più sotto): prassi dei gestionali — prima dello SdI la
  // fattura è una copia di cortesia senza valore fiscale; dopo la trasmissione
  // si corregge solo con nota di credito.
  rejected: ['draft'],
  // "Segna non pagata" (audit 25 lug #3): un tap sbagliato su "Segna pagata"
  // era IRREVERSIBILE (nessuna transizione da accepted → fattura inchiodata in
  // sola lettura, uscita solo via cestino). Il pagamento è un fatto gestionale
  // interno: annullarlo riporta la fattura a "inviata, da incassare" e azzera
  // i campi incasso (più sotto).
  accepted: ['sent'],
}

const BodySchema = z.union([
  // Azzera un ACCONTO registrato per errore (feedback Eli 27 lug: "se un
  // artigiano avesse sbagliato a inserire l'acconto come fa a cambiarlo?").
  // Prima l'unica uscita era "Segna come non pagata", che esiste solo sulle
  // fatture SALDATE: un acconto sbagliato su una fattura ancora da incassare
  // era inchiodato. Lo stato NON cambia; l'azzeramento resta in cronologia.
  z.object({ reset_payment: z.literal(true) }),
  z.object({
    status: z.enum(['accepted', 'rejected', 'draft', 'sent']),
    // Pagamenti F1: importo ricevuto e data incasso (dialog "Segna come pagata").
    // Importo più basso del totale = acconto → payment_status 'partial',
    // lo stato della fattura NON cambia (resta da incassare per il saldo).
    paid_amount: z.number().positive().optional(),
    paid_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }),
])

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  let body: z.infer<typeof BodySchema>
  try {
    body = BodySchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: 'Stato non valido' }, { status: 400 })
  }

  // RLS garantisce già che solo i workspace_members vedano il documento.
  // sdi_status incluso in modo TOLLERANTE: se la migration 044 non è applicata
  // la colonna non esiste → riproviamo senza (nessuna guardia SdI, coerente
  // con lo SdI spento oggi).
  type LogEntry = { type: string; at: string; amount?: number; kind?: string; reason?: string }
  type FatturaRow = { id: string; status: string; doc_type: string; workspace_id: string; total: number | null; sent_at?: string | null; sdi_status?: string | null; document_log?: unknown }
  let doc: FatturaRow | null = null
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- select dinamico + colonna 044 tollerante
    const db = supabase as any
    // ⚠️ ANCHE le note di credito: questa è la route che serve «Annulla la
    // nota» e «Riattiva». Col filtro `doc_type = 'fattura'` una NC prendeva
    // 404 «Fattura non trovata» — l'unico comando di stato offerto sulla
    // nota falliva SEMPRE (revisione 10 ago). I preventivi restano fuori:
    // hanno la loro route.
    const runSelect = (cols: string) => db
      .from('documents')
      .select(cols)
      .eq('id', id)
      .in('doc_type', ['fattura', 'nota_credito', 'nota_debito'])
      .is('deleted_at', null)
      .maybeSingle()
    let res = await runSelect('id, status, doc_type, workspace_id, total, sent_at, sdi_status, document_log')
    if (res.error && isMissingColumnError(res.error)) {
      res = await runSelect('id, status, doc_type, workspace_id, total, sent_at, document_log')
    }
    doc = (res.data as FatturaRow | null)
  }

  if (!doc) return NextResponse.json({ error: 'Fattura non trovata' }, { status: 404 })

  // ⚠️ Una NOTA DI CREDITO non si incassa: è denaro che TORNA al cliente.
  // «Pagata» la farebbe entrare nel Bilancio come ENTRATA (segno opposto), e
  // gli acconti non esistono. La UI questi comandi non li offre; la guardia
  // c'è per chi chiama la route direttamente.
  if (doc.doc_type === 'nota_credito' && ('reset_payment' in body || body.status === 'accepted')) {
    return NextResponse.json(
      { error: 'Una nota di credito non si incassa: è denaro che torna al cliente, non che arriva.' },
      { status: 422 }
    )
  }

  // ── Cronologia degli incassi (feedback Eli 26 lug) ──────────────────────
  // Gli incassi non comparivano da nessuna parte: registrare un acconto non
  // lasciava traccia, e annullare/riattivare azzerava i campi facendo
  // sparire anche la memoria di quanto era stato ricevuto. Ora ogni
  // movimento di denaro finisce nel `document_log`, che è append-only e
  // NON viene mai ripulito: la cronologia resta anche dopo l'azzeramento.
  // NB: il log è una MEMORIA, non la fonte dei calcoli — importi e Bilancio
  // continuano a leggere payment_status/paid_amount, invariati.
  // ⚠️ CUMULATIVO: nella stessa richiesta possono scrivere il log DUE update
  // in sequenza (cambio stato → poi azzeramento incassi). Se entrambi
  // partissero dalla lettura iniziale, il secondo cancellerebbe la voce del
  // primo: ogni withLog() aggiorna la base per il successivo.
  let currentLog: LogEntry[] = Array.isArray(doc.document_log) ? (doc.document_log as LogEntry[]) : []
  const withLog = (entry: LogEntry) => {
    currentLog = [...currentLog, entry]
    return currentLog
  }

  // ⚖️ Guardia fiscale: una fattura già TRASMESSA allo SdI (stato diverso da
  // "scartata") non si può più annullare né riattivare — è emessa. Si corregge
  // solo con una nota di credito (funzione della fase SdI). Oggi lo SdI è
  // spento → sdi_status resta null → nessun blocco.
  const sdiTransmitted = !!doc.sdi_status && doc.sdi_status !== 'scartata'
  if (!('reset_payment' in body) && sdiTransmitted && (body.status === 'rejected' || body.status === 'draft')) {
    return NextResponse.json(
      {
        error: doc.doc_type === 'nota_credito'
          ? 'Questa nota di credito è già stata trasmessa allo SdI: non si può più annullare né riattivare. Per compensarla serve una nota di debito — parlane col commercialista.'
          : 'Questa fattura è già stata trasmessa allo SdI: non si può annullare né riattivare. Per correggerla serve una nota di credito.',
      },
      { status: 409 }
    )
  }

  // Verifica membership esplicita (coerente con RLS is_workspace_member)
  const { data: isMember } = await supabase
    .rpc('is_workspace_member', { p_workspace_id: doc.workspace_id })
  if (!isMember) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  }

  // ── Azzera un acconto sbagliato (feedback Eli 27 lug) ──────────────────
  // Fatture NON saldate con payment_status 'partial': l'importo si azzera
  // (resta in cronologia) e l'artigiano lo registra di nuovo giusto. Sulle
  // saldate c'è già "Segna come non pagata". Il pagamento è un fatto
  // gestionale interno: nessuna guardia SdI (non tocca il documento fiscale).
  if ('reset_payment' in body) {
    if (doc.status === 'accepted') {
      return NextResponse.json(
        { error: 'La fattura risulta saldata: usa "Segna come non pagata".' },
        { status: 409 }
      )
    }
    let registered = 0
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 038 non ancora in types/database.ts
      const { data: payRow } = await (supabase as any)
        .from('documents')
        .select('paid_amount, payment_status')
        .eq('id', id)
        .maybeSingle()
      if (payRow?.payment_status === 'partial') registered = Number(payRow.paid_amount ?? 0)
    } catch { /* colonne mancanti pre-migration */ }
    if (registered <= 0) {
      return NextResponse.json(
        { error: 'Non c’è nessun acconto registrato da azzerare.' },
        { status: 409 }
      )
    }
    // Lock ottimistico: l'azzeramento passa solo se l'acconto è ancora
    // quello appena letto — un incasso registrato nel frattempo non
    // viene cancellato in silenzio.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 038 non ancora in types/database.ts
    const { data: resetRows, error: resetError } = await (supabase as any)
      .from('documents')
      .update({
        payment_status: 'unpaid',
        paid_amount: null,
        paid_at: null,
        // `reason` distingue in cronologia PERCHÉ l'incasso è stato azzerato
        // (feedback Eli 27 lug: "ogni minima modifica tracciata con data e ora").
        document_log: withLog({ type: 'payment_reset', at: new Date().toISOString(), amount: registered, reason: 'correzione' }),
      })
      .eq('id', id)
      .eq('payment_status', 'partial')
      .eq('paid_amount', registered)
      .select('id')
    if (resetError) {
      console.error('[fatture/status] azzeramento acconto non riuscito:', resetError)
      return NextResponse.json({ error: 'Azzeramento non riuscito. Riprova.' }, { status: 500 })
    }
    if (!resetRows || resetRows.length === 0) {
      return NextResponse.json(
        { error: 'L’incasso di questa fattura è appena cambiato da un’altra finestra: ricarica la pagina.' },
        { status: 409 }
      )
    }
    revalidatePath('/fatture')
    revalidatePath(`/fatture/${id}`)
    return NextResponse.json({ success: true, status: doc.status, reset: true })
  }

  const allowed = ALLOWED_TRANSITIONS[doc.status] ?? []
  if (!allowed.includes(body.status)) {
    return NextResponse.json(
      { error: spiegaTransizioneRifiutata(doc.status, body.status, 'fattura') },
      { status: 409 }
    )
  }

  // Downgrade Pro→Free: NIENTE guardia freeLock sulla riattivazione delle
  // fatture. Una «rejected → draft» qui è spesso il recupero di una fattura
  // SCARTATA dallo SdI (correzione fiscale, sdi_status='scartata'), che deve
  // restare sempre possibile — la stessa regola per cui la trasmissione SdI
  // non si tocca mai. La UI nasconde già «Riattiva» sui documenti bloccati; e
  // anche riportandola in bozza, il reinvio resta fermato dal contatore Free.

  // "Segna non pagata" su una fattura MAI inviata (bozza pagata per errore,
  // review 25 lug A8): atterrare su 'sent' creerebbe una fattura "Inviata"
  // senza alcun invio (timeline bugiarda, tab sbagliata) → si torna in BOZZA.
  //
  // ⚠️ MA una fattura TRASMESSA ALLO SdI non torna mai in bozza (Eli, 8 ago:
  // *"la segno come non pagata e scompare il riquadro SdI, ma intanto l'ha
  // inviata"*). `sent_at` è l'invio EMAIL al cliente: una fattura trasmessa
  // allo SdI senza email aveva `sent_at` nullo e retrocedeva a bozza — cioè
  // l'app dichiarava "non ancora emessa" un documento che per l'Agenzia è
  // emesso, e la card SdI (nascosta sulle bozze) spariva con tutta la storia
  // della trasmissione. Lo scarto non conta: lì la fattura è NON emessa.
  const trasmessaSdi = (() => {
    const st = (doc as { sdi_status?: string | null }).sdi_status
    return !!st && st !== 'scartata'
  })()
  const targetStatus =
    body.status === 'sent' && !doc.sent_at && !trasmessaSdi ? 'draft' : body.status

  // ── Incasso (Pagamenti F1) ────────────────────────────────────────────
  // Un acconto precedente si SOMMA al nuovo incasso (prima veniva
  // sovrascritto: due acconti da 500 € risultavano 500 € invece di 1000 €).
  let alreadyPaid = 0
  // Quanto c'è REGISTRATO adesso (acconto O pagamento pieno): è ciò che un
  // azzeramento cancella e che va scritto in cronologia (feedback Eli 27
  // lug: "Incasso azzerato" senza importo quando la fattura era pagata per
  // intero — leggevo solo il caso 'partial').
  let registeredNow = 0
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 038 non ancora in types/database.ts
    const { data: payRow } = await (supabase as any)
      .from('documents')
      .select('paid_amount, payment_status')
      .eq('id', id)
      .maybeSingle()
    if (payRow?.payment_status === 'partial') alreadyPaid = Number(payRow.paid_amount ?? 0)
    if (payRow?.payment_status === 'partial' || payRow?.payment_status === 'paid') {
      registeredNow = Number(payRow.paid_amount ?? 0)
    }
  } catch { /* colonne mancanti pre-migration */ }

  const total = Number(doc.total ?? 0)
  const received = body.status === 'accepted'
    ? (body.paid_amount ?? Math.max(total - alreadyPaid, 0))
    : null
  const paidAmount = received !== null
    ? Math.round((alreadyPaid + received) * 100) / 100
    : null
  if (paidAmount !== null && total > 0 && paidAmount > total + 0.005) {
    const residuo = Math.round((total - alreadyPaid) * 100) / 100
    return NextResponse.json(
      {
        error: alreadyPaid > 0
          ? `L'importo supera quanto resta da incassare (${residuo.toLocaleString('it-IT', { minimumFractionDigits: 2 })}\u00A0€ dopo l'acconto già registrato).`
          : 'L\'importo supera il totale della fattura.',
      },
      { status: 422 }
    )
  }
  const isPartial =
    body.status === 'accepted' && paidAmount !== null && total > 0 && paidAmount < total - 0.005
  // Orario VERO (feedback Eli 27 lug: gli incassi comparivano alle "14:00"
  // — era il mezzogiorno tecnico T12:00 reso nell'ora di Roma — e la
  // cronologia finiva fuori sequenza). Il T12:00 serve SOLO per gli incassi
  // retrodatati, dove del giorno scelto non conosciamo l'ora: se la data è
  // oggi (o non è indicata), si usa l'ora reale del click.
  const todayRome = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' })
  // Un incasso è denaro GIÀ arrivato: una data futura non ha senso e creava
  // solo ambiguità (feedback Eli 27 lug: "acconto del 30 lug" registrato il
  // 27 — cosa deve succedere se poi annullo?). Meglio impedirla alla fonte.
  if (body.status === 'accepted' && body.paid_date && body.paid_date > todayRome) {
    return NextResponse.json(
      { error: 'La data dell’incasso non può essere nel futuro: si registra quando i soldi sono arrivati.' },
      { status: 422 }
    )
  }
  const paidAtIso = body.paid_date && body.paid_date !== todayRome
    ? new Date(`${body.paid_date}T12:00:00`).toISOString()
    : new Date().toISOString()

  if (isPartial) {
    // Acconto: registra l'incasso parziale SENZA cambiare lo stato —
    // la fattura resta da incassare per il saldo.
    // Lock ottimistico anti doppio-submit (review 25 lug #11): l'update passa
    // solo se lo stato pagamento è ancora quello letto sopra — un secondo
    // submit dello stesso dialog troverebbe 'partial' con importo diverso
    // e NON sommerebbe due volte lo stesso acconto.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 038 non ancora in types/database.ts
    let partialQuery = (supabase as any)
      .from('documents')
      .update({
        payment_status: 'partial',
        paid_amount: paidAmount,
        paid_at: paidAtIso,
        document_log: withLog({
          type: 'payment', at: paidAtIso, kind: 'acconto',
          // `received` è l'importo di QUESTO incasso; `paidAmount` è il
          // cumulato che finisce in paid_amount. In cronologia va il primo.
          amount: Number(received ?? 0),
        }),
      })
      .eq('id', id)
    partialQuery = alreadyPaid > 0
      ? partialQuery.eq('payment_status', 'partial').eq('paid_amount', alreadyPaid)
      : partialQuery.neq('payment_status', 'partial')
    const { data: partialRows, error: partialError } = await partialQuery.select('id')

    if (partialError) {
      console.error('[fatture/status] partial payment error:', partialError)
      return NextResponse.json(
        { error: 'Registrazione acconto non riuscita. La migration 038 potrebbe non essere ancora applicata.' },
        { status: 500 }
      )
    }
    if (!partialRows || partialRows.length === 0) {
      return NextResponse.json(
        { error: 'Un altro incasso è appena stato registrato su questa fattura: ricontrolla il totale e riprova.' },
        { status: 409 }
      )
    }

    revalidatePath('/fatture')
    revalidatePath(`/fatture/${id}`)
    return NextResponse.json({ success: true, status: doc.status, partial: true })
  }

  // Update condizionato allo stato letto (review 25 lug #10): due tab che
  // cambiano stato in parallelo non si sovrascrivono in silenzio — la seconda
  // trova 0 righe e riceve un 409 onesto invece di un falso successo.
  const { data: statusRows, error } = await supabase
    .from('documents')
    .update({
      status: targetStatus,
      // Imposta accepted_at quando la fattura viene marcata come pagata,
      // così il KPI "valore fatturato" nella dashboard funziona correttamente.
      ...(body.status === 'accepted' ? { accepted_at: new Date().toISOString() } : {}),
      // "Segna non pagata" (accepted → sent/draft): l'accettazione va azzerata.
      ...(body.status === 'sent' ? { accepted_at: null } : {}),
      // Annullata / riattivata restano scritte in cronologia (feedback Eli
      // 27 lug: dopo annulla+riattiva non c'era traccia di nessuno dei due).
      // NB: qui c'è già la riga dell'eventuale azzeramento incassi — questa
      // racconta il CAMBIO DI STATO, quella i SOLDI.
      ...(body.status === 'rejected'
        ? { document_log: withLog({ type: 'cancelled', at: new Date().toISOString() }) }
        : {}),
      ...(doc.status === 'rejected' && body.status === 'draft'
        ? { document_log: withLog({ type: 'reactivated', at: new Date().toISOString() }) }
        : {}),
    })
    .eq('id', id)
    .eq('status', doc.status as 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired')
    .select('id')

  if (error) {
    console.error('[fatture/status] DB update error:', error)
    return NextResponse.json({ error: 'Errore nel salvataggio' }, { status: 500 })
  }
  // Conferma/azzeramento fiscale (080), a stato ormai scritto:
  //  · bozza → pagata («Segna pagata» su una bozza): è una CONFERMA — la
  //    data fiscale nasce qui (e per una fattura parte il pilota);
  //  · qualsiasi → bozza («Riporta in bozza», «Riattiva»): la bozza non ha
  //    data né trasmissioni in programma — rinascono alla prossima conferma.
  if (statusRows && statusRows.length > 0) {
    if (doc.status === 'draft' && body.status === 'accepted') {
      await registraConfermaFiscale(supabase, doc.workspace_id, id, doc.doc_type)
    } else if (targetStatus === 'draft') {
      await azzeraConfermaFiscale(supabase, doc.workspace_id, id)
    } else if (targetStatus === 'rejected') {
      // ANNULLAMENTO: la data fiscale resta (annullata ≠ bozza), ma il
      // pilota si ferma — il cron già non trasmette le annullate, e la card
      // non deve promettere «parte da sola» su un documento annullato.
      await fermaPilotaSdi(supabase, doc.workspace_id, id)
    }
  }

  if (!statusRows || statusRows.length === 0) {
    return NextResponse.json(
      { error: 'Lo stato della fattura è appena cambiato da un’altra finestra: ricarica la pagina.' },
      { status: 409 }
    )
  }

  // Azzera i dati di pagamento (038) su RIATTIVAZIONE (rejected → draft) e su
  // ANNULLAMENTO (→ rejected). Senza questo:
  //  · in bozza riattivata resterebbe l'acconto stantio e "Segna pagata" andrebbe in 422;
  //  · una fattura ANNULLATA con acconto continuerebbe a contare nelle Entrate del
  //    Bilancio, che seleziona anche `payment_status in (partial,paid)` a prescindere
  //    dallo stato → incasso fantasma di un documento annullato.
  // Best-effort e tollerante pre-migration (colonne 038 assenti → nessun errore bloccante).
  // ⚠️ 'unpaid', NON null (review 25 lug #1): payment_status è NOT NULL DEFAULT
  // 'unpaid' (038) — scrivere null violava il vincolo e il reset NON è mai
  // avvenuto (acconto fantasma nel Bilancio su fatture annullate, 422 sulla
  // bozza riattivata). Vale anche per "Segna non pagata" (accepted → sent).
  if (body.status === 'draft' || body.status === 'rejected' || body.status === 'sent') {
    const resetPatch = {
      payment_status: 'unpaid',
      paid_amount: null,
      paid_at: null,
      // La riga resta nella cronologia (l'artigiano deve poter ricostruire
      // che un incasso c'era stato) ma si scrive SOLO se c'era davvero
      // qualcosa da azzerare: annulla+riattiva senza soldi registrati
      // riempiva la cronologia di "Incasso azzerato" a vuoto (screenshot
      // Eli 27 lug).
      ...(registeredNow > 0
        ? { document_log: withLog({
            type: 'payment_reset', at: new Date().toISOString(), amount: registeredNow,
            // Il motivo dell'azzeramento resta leggibile in cronologia.
            reason: body.status === 'rejected' ? 'annullamento'
              : body.status === 'draft' ? 'riattivazione'
              : 'non_pagata',
          }) }
        : {}),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 038 non ancora in types/database.ts
    } as any
    const { error: resetErr } = await supabase.from('documents').update(resetPatch).eq('id', id)
    if (resetErr && !isMissingColumnError(resetErr)) {
      console.error('[fatture/status] azzeramento pagamento in riattivazione non riuscito:', resetErr)
    }
  }

  // Riattivazione di una SCARTATA (rejected → draft): lo scarto SdI appartiene
  // al tentativo precedente — azzerarlo evita che la bozza riattivata resti
  // marchiata (la card SdI non monta sulle bozze e il motivo non sarebbe più
  // né visibile né superabile). Best-effort, tollerante pre-044.
  if (body.status === 'draft' && doc.sdi_status === 'scartata') {
    // Azzera TUTTE le tracce del tentativo rifiutato (review 25 lug A4):
    // provider_id e sent_at appartengono alla trasmissione scartata; lasciarli
    // renderebbe ambigui esiti/snapshot futuri.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 044 non ancora in types/database.ts
    const { error: sdiResetErr } = await (supabase as any)
      .from('documents')
      .update({ sdi_status: null, sdi_error: null, sdi_provider_id: null, sdi_sent_at: null, sdi_updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('sdi_status', 'scartata')
    if (sdiResetErr && !isMissingColumnError(sdiResetErr)) {
      console.error('[fatture/status] azzeramento stato SdI scartata non riuscito:', sdiResetErr)
    }
    // Snapshot del tentativo rifiutato: via anche quello (058, best-effort).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('documents').update({ sdi_xml_snapshot: null }).eq('id', id).then(() => {}, () => {})
  }

  // Pagamento pieno: registra anche i campi incasso. Senza payment_status
  // 'paid' la recensione non si sblocca e il Bilancio ripiega su accepted_at:
  // un errore REALE qui va riprovato subito (un solo retry), non inghiottito.
  if (body.status === 'accepted') {
    const paidPatch = {
      payment_status: 'paid',
      paid_amount: paidAmount,
      paid_at: paidAtIso,
      document_log: withLog({
        type: 'payment', at: paidAtIso, kind: 'saldo',
        amount: Number(received ?? 0),
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 038 non ancora in types/database.ts
    } as any
    const { error: payErr } = await supabase.from('documents').update(paidPatch).eq('id', id)
    if (payErr && !isMissingColumnError(payErr)) {
      const { error: retryErr } = await supabase.from('documents').update(paidPatch).eq('id', id)
      if (retryErr) console.error('[fatture/status] incasso non registrato dopo retry:', retryErr)
    }
  }

  revalidatePath('/fatture')
  revalidatePath(`/fatture/${id}`)

  return NextResponse.json({ success: true, status: targetStatus })
}
