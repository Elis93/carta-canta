// PATCH /api/preventivi/[id]/status
// Autenticato — cambia stato di un documento manualmente.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v4'
import { createClient } from '@/lib/supabase/server'
import { isMissingColumnError } from '@/lib/supabase/errors'
import { spiegaTransizioneRifiutata } from '@/lib/documents/transizioni'

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  sent:     ['accepted', 'rejected', 'expired'],
  viewed:   ['accepted', 'rejected', 'expired'],
  rejected: ['sent'],
  // "Riapri (torna a Inviato)" dal dropdown — senza questa chiave il bottone
  // esisteva ma la PATCH rispondeva sempre 409.
  expired:  ['sent'],
  // "Riporta in bozza" (22 lug 2026): SOLO per accettazioni MANUALI
  // ("Segna accettato" per errore) — guardie più sotto: mai se il cliente
  // ha accettato/firmato dalla pagina pubblica (signer_name/accepted_ip =
  // prova FES da non distruggere) e mai con una fattura collegata.
  accepted: ['draft'],
}

const BodySchema = z.object({
  status: z.enum(['draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired']),
})

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

  // Carica documento — RLS garantisce già che solo i workspace_members lo vedano
  const { data: doc } = await supabase
    .from('documents')
    .select('id, status, workspace_id, validity_days, doc_type, signer_name, accepted_ip, document_log')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!doc) return NextResponse.json({ error: 'Documento non trovato' }, { status: 404 })

  // Ogni transizione MANUALE lascia una voce nella cronologia (Eli 3 ago
  // sera: "deve contenere ogni minima azione, anche di ritorno indietro e
  // poi avanti"). Best-effort: un errore qui non annulla il cambio di stato.
  async function appendLog(type: string) {
    try {
      // RILETTURA fresca del log subito prima dell'append (review 4 ago):
      // usare la lettura di inizio richiesta lasciava una finestra di
      // secondi in cui una voce concorrente (es. 'modified' dall'auto-save)
      // veniva sovrascritta dall'array stantio. La finestra ora è di ms
      // (residuo accettato: append atomico via RPC = follow-up).
      const { data: fresh } = await supabase
        .from('documents')
        .select('document_log')
        .eq('id', id)
        .maybeSingle()
      const current = Array.isArray(fresh?.document_log)
        ? fresh.document_log
        : Array.isArray(doc!.document_log) ? doc!.document_log : []
      const { error: logErr } = await supabase
        .from('documents')
        .update({ document_log: [...current, { type, at: new Date().toISOString() }] })
        .eq('id', id)
      if (logErr && !isMissingColumnError(logErr)) {
        console.error('[preventivi/status] log cronologia non scritto:', logErr)
      }
    } catch (e) {
      console.error('[preventivi/status] log cronologia non scritto:', e)
    }
  }

  // Questa route serve SOLO i preventivi (26 lug). Senza questo filtro una
  // fattura poteva essere mossa da qui saltando le guardie della sua route:
  // annullare una fattura già TRASMESSA allo SdI (che invece esige una nota
  // di credito), segnarla "Pagata" senza registrare l'incasso, o riattivarla
  // su 'sent' invece che in bozza. Stessa classe del fix accept/decline del
  // 25 lug. L'interfaccia usa già /api/fatture/[id]/status per le fatture.
  if (doc.doc_type !== 'preventivo') {
    return NextResponse.json(
      { error: 'Questo documento è una fattura: lo stato si cambia dalla sua pagina.' },
      { status: 409 }
    )
  }

  // Verifica membership esplicita (coerente con RLS is_workspace_member)
  const { data: isMember } = await supabase
    .rpc('is_workspace_member', { p_workspace_id: doc.workspace_id })
  if (!isMember) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  }

  // Verifica transizione consentita
  const allowed = ALLOWED_TRANSITIONS[doc.status] ?? []
  if (!allowed.includes(body.status)) {
    return NextResponse.json(
      { error: spiegaTransizioneRifiutata(doc.status, body.status, 'preventivo') },
      { status: 409 }
    )
  }

  // ── "Riporta in bozza" da accettato: SOLO accettazioni manuali ──
  const unaccepting = doc.status === 'accepted' && body.status === 'draft'
  if (unaccepting) {
    // Questa route serve i PREVENTIVI: una fattura 'accepted' (= pagata)
    // non si riporta in bozza da qui (ha il suo flusso con azzeramento
    // dei dati di pagamento).
    if (doc.doc_type !== 'preventivo') {
      return NextResponse.json({ error: 'Operazione non disponibile per questo documento' }, { status: 409 })
    }
    // Accettato/firmato DAL CLIENTE dalla pagina pubblica → prova FES
    // (firma, IP): non si annulla da qui.
    if (doc.signer_name || doc.accepted_ip != null) {
      return NextResponse.json(
        { error: 'Questo preventivo è stato accettato dal cliente: l’accettazione registrata non si può annullare.' },
        { status: 409 }
      )
    }
    // Fattura collegata (anche in bozza): riportare il preventivo in bozza
    // lascerebbe una fattura che nasce da un documento non più accettato.
    // Guardia di coerenza → FAIL-CLOSED: se la verifica stessa fallisce
    // non si procede (review 22 lug B1).
    const { data: linkedFattura, error: linkErr } = await supabase
      .from('documents')
      .select('id')
      .eq('origin_document_id', id)
      .eq('doc_type', 'fattura')
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle()
    if (linkErr) {
      console.error('[preventivi/status] verifica fattura collegata fallita:', linkErr)
      return NextResponse.json({ error: 'Verifica non riuscita. Riprova.' }, { status: 500 })
    }
    if (linkedFattura) {
      return NextResponse.json(
        { error: 'C’è una fattura collegata a questo preventivo: eliminala (o scollegala) prima di riportarlo in bozza.' },
        { status: 409 }
      )
    }
    // Lavoro con rapportino FIRMATO collegato (review 25 lug M4): riportare in
    // bozza riaprirebbe voci e prezzi sotto un rapportino già firmato dal
    // cliente (che mostra foto e ore di questo documento). Tollerante pre-053.
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 049/053 non ancora in types/database.ts
      const { data: signedLavoro } = await (supabase as any)
        .from('lavori')
        .select('id')
        .eq('document_id', id)
        .not('report_signed_at', 'is', null)
        .is('deleted_at', null)
        .limit(1)
      if (Array.isArray(signedLavoro) && signedLavoro.length > 0) {
        return NextResponse.json(
          { error: 'Il lavoro aperto da questo preventivo ha un rapportino firmato dal cliente: il preventivo non si può più riportare in bozza.' },
          { status: 409 }
        )
      }
    } catch { /* pre-migration: nessun blocco */ }

    // Update DEDICATO e condizionato sullo stato (anti-race con un "Converti
    // in fattura" concorrente, review 22 lug B2): se un'altra richiesta ha
    // già mosso lo stato, qui 0 righe → 409.
    const { data: reverted, error: revErr } = await supabase
      .from('documents')
      .update({ status: 'draft', accepted_at: null })
      .eq('id', id)
      .eq('status', 'accepted')
      .select('id')
    if (revErr) {
      console.error('[preventivi/status] riporta in bozza fallito:', revErr)
      return NextResponse.json({ error: 'Errore nel salvataggio' }, { status: 500 })
    }
    if (!reverted || reverted.length === 0) {
      return NextResponse.json({ error: 'Lo stato del preventivo è cambiato nel frattempo: ricarica la pagina.' }, { status: 409 })
    }

    // Azzera l'eventuale ACCONTO registrato sull'accettazione (M1 review 22
    // lug, gemello del riattiva-fattura): senza, l'acconto resterebbe
    // invisibile in bozza ma contato nelle Entrate del Bilancio, e
    // riapparirebbe stantio alla ri-accettazione. Best-effort, tollerante
    // pre-migration 038.
    const resetPatch = {
      // 'unpaid', NON null: payment_status è NOT NULL DEFAULT 'unpaid' (038) —
      // con null il reset veniva rifiutato dal vincolo e non è mai avvenuto
      // (review 25 lug #1, gemello della route fatture).
      payment_status: 'unpaid',
      paid_amount: null,
      paid_at: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 038 non ancora in types/database.ts
    } as any
    const { error: resetErr } = await supabase.from('documents').update(resetPatch).eq('id', id)
    if (resetErr && !isMissingColumnError(resetErr)) {
      console.error('[preventivi/status] azzeramento acconto al riporta-in-bozza non riuscito:', resetErr)
    }

    await appendLog('unaccepted')
    return NextResponse.json({ success: true, status: 'draft' })
  }

  // "Segna come Accettato" MANUALE su un preventivo a più proposte (review 25
  // lug M5/#8): l'accettazione manuale non sceglie una proposta → il documento
  // pubblico mostrerebbe le voci di TUTTE le proposte col totale della sola
  // Base, e la conversione in fattura resterebbe bloccata per sempre. Meglio
  // fermarsi qui con la via d'uscita spiegata. Tollerante pre-041.
  let tierScelto: string | null = null
  if (body.status === 'accepted' && doc.doc_type === 'preventivo') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 041 non ancora in types/database.ts
      const { data: tierRows } = await (supabase as any)
        .from('document_items')
        .select('option_tier')
        .eq('document_id', id)
        .not('option_tier', 'is', null)
      const distinctTiers = [...new Set((tierRows ?? []).map((r: { option_tier: string }) => r.option_tier))] as string[]
      if (distinctTiers.length > 1) {
        // ⚠️ Prima qui ci si fermava e basta ("falla scegliere al cliente"):
        // ma il cliente può aver risposto a voce, e allora la scelta la fa
        // l'artigiano (Eli, 8 ago). Se la proposta non è indicata si chiede
        // QUALE, restituendo l'elenco vero delle proposte del documento.
        const tierRichiesto = (body as unknown as { tier?: unknown }).tier
        const scelta = typeof tierRichiesto === 'string' ? tierRichiesto : null
        if (!scelta || !distinctTiers.includes(scelta)) {
          return NextResponse.json(
            { error: 'Questo preventivo ha più proposte: scegli quale ha accettato il cliente.', tiers: distinctTiers },
            { status: 422 }
          )
        }
        tierScelto = scelta
      }
    } catch { /* pre-migration: nessun blocco */ }
  }

  // Riapertura di uno scaduto: senza rinnovare expires_at il cron lo
  // rimarcherebbe 'expired' la notte stessa (la scadenza è nel passato).
  const reopening = doc.status === 'expired' && body.status === 'sent'
  const renewDays = Number(doc.validity_days) > 0 ? Math.floor(Number(doc.validity_days)) : 30
  const renewedExpiry = new Date(Date.now() + renewDays * 24 * 60 * 60 * 1000).toISOString()

  // Update condizionato allo stato letto (review 25 lug #10): due tab che
  // cambiano stato in parallelo non si sovrascrivono in silenzio.
  const { data: statusRows, error } = await supabase
    .from('documents')
    .update(
      body.status === 'accepted'
        ? { status: body.status, accepted_at: new Date().toISOString() }
        : reopening
          ? { status: body.status, expires_at: renewedExpiry }
          : { status: body.status }
    )
    .eq('id', id)
    .eq('status', doc.status)
    .select('id')

  if (error) {
    console.error('[status] DB update error:', error)
    return NextResponse.json({ error: 'Errore nel salvataggio' }, { status: 500 })
  }
  if (!statusRows || statusRows.length === 0) {
    return NextResponse.json(
      { error: 'Lo stato del preventivo è appena cambiato da un’altra finestra: ricarica la pagina.' },
      { status: 409 }
    )
  }

  // ── Proposta scelta (041) ────────────────────────────────────────────────
  // ⚠️ Accettare una proposta vuol dire che IL PREVENTIVO DIVENTA QUELLA
  // PROPOSTA: si tengono solo le sue voci e i totali si ricalcolano su di lei.
  // È esattamente ciò che fa già l'accettazione dal link pubblico, e le due
  // strade devono lasciare il documento IDENTICO.
  //
  // Prima qui si salvava solo l'etichetta: il documento restava con le voci di
  // TUTTE le proposte e col totale della sola Base. Due conseguenze vere:
  //  · accettando la Premium, Home, liste e riepilogo continuavano a mostrare
  //    la cifra della Base — cioè l'app non dava mai atto della scelta;
  //  · convertendo in fattura, la conversione copia TUTTE le voci → la fattura
  //    nasceva con Base + Premium sommate, un importo che non esiste in
  //    nessuno scenario. Dal link pubblico non succedeva, perché lì le voci
  //    dell'altra proposta vengono rimosse.
  //
  // Tollerante pre-041: se le colonne non ci sono, l'accettazione resta valida
  // e il documento si comporta esattamente come prima.
  if (tierScelto) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 041 non ancora in types/database.ts
      const db = supabase as any
      const { data: allItems } = await db
        .from('document_items')
        .select('*')
        .eq('document_id', id)
      const voci = (allItems ?? []) as Array<Record<string, unknown>>
      const scelte = voci.filter((i) => ((i.option_tier as string | null) ?? 'base') === tierScelto)
      const altre = voci.filter((i) => ((i.option_tier as string | null) ?? 'base') !== tierScelto)

      const { data: opt } = await db
        .from('documents')
        .select('discount_pct, discount_fixed, vat_rate_default, workspace_id')
        .eq('id', id)
        .maybeSingle()
      const { data: ws } = await db
        .from('workspaces')
        .select('fiscal_regime')
        .eq('id', opt?.workspace_id ?? doc.workspace_id)
        .maybeSingle()

      const patch: Record<string, unknown> = { accepted_tier: tierScelto }
      if (scelte.length > 0) {
        const { calcolaDocumento } = await import('@/lib/fiscal/calcoli')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- voci lette con select('*')
        const fiscal = calcolaDocumento(scelte as any, {
          fiscal_regime: (ws?.fiscal_regime ?? 'forfettario') as 'forfettario' | 'ordinario' | 'minimi',
          currency: 'EUR',
          discount_pct: (opt?.discount_pct as number | null) ?? undefined,
          discount_fixed: (opt?.discount_fixed as number | null) ?? undefined,
          vat_rate_default: (opt?.vat_rate_default as number | null) ?? undefined,
        })
        patch.subtotal = fiscal.subtotal
        patch.tax_amount = fiscal.taxAmount
        patch.bollo_amount = fiscal.bollo
        patch.total = fiscal.total
      }

      const { error: tierErr } = await db.from('documents').update(patch).eq('id', id)
      if (tierErr) {
        if (!isMissingColumnError(tierErr)) {
          console.error('[preventivi/status] proposta scelta non salvata:', tierErr)
        }
      } else if (altre.length > 0) {
        // Le voci dell'altra proposta si rimuovono DOPO che i totali sono
        // stati scritti: se la cancellazione fallisse, il documento resta
        // coerente con la proposta scelta (voci in più, ma totale giusto).
        const { error: delErr } = await db
          .from('document_items')
          .delete()
          .in('id', altre.map((i) => i.id as string))
        if (delErr) console.error('[preventivi/status] voci dell’altra proposta non rimosse:', delErr)
      }
    } catch (e) {
      console.error('[preventivi/status] scelta della proposta non applicata:', e)
    }
  }

  if (body.status === 'accepted') await appendLog('marked_accepted')
  else if (body.status === 'rejected') await appendLog('marked_rejected')
  else if (body.status === 'expired') await appendLog('marked_expired')
  else if (body.status === 'sent' && (doc.status === 'rejected' || doc.status === 'expired')) await appendLog('reopened')

  return NextResponse.json({ success: true, status: body.status })
}
