// POST /api/preventivi/[id]/converti-fattura
// Converte un preventivo accettato in fattura (bozza).
// Richiede autenticazione — usa RLS-aware client.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isMissingColumnError } from '@/lib/supabase/errors'
import { isDocFreeLocked, DOC_LOCKED_MESSAGE } from '@/lib/plan/free-lock'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  // Leggi body opzionale
  let forceAccept = false
  try {
    const raw = await req.json()
    if (raw && typeof raw === 'object' && raw.forceAccept === true) {
      forceAccept = true
    }
  } catch { /* body assente o non JSON */ }

  // Verifica workspace — supporta sia owner che workspace_members
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
      .order('accepted_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (membership) {
      const { data: mw } = await supabase
        .from('workspaces').select('id, plan')
        .eq('id', membership.workspace_id)
        .maybeSingle()
      workspace = mw
    }
  }

  if (!workspace) return NextResponse.json({ error: 'Workspace non trovato' }, { status: 404 })

  // Verifica che il documento esista e sia un preventivo del workspace
  const { data: doc } = await supabase
    .from('documents')
    .select('id, status, doc_type')
    .eq('id', id)
    .eq('workspace_id', workspace.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!doc) return NextResponse.json({ error: 'Documento non trovato' }, { status: 404 })
  if (doc.doc_type !== 'preventivo') return NextResponse.json({ error: 'Non è un preventivo' }, { status: 400 })
  // Downgrade Pro→Free: un preventivo bloccato (oltre gli 8 inviati) non si converte.
  if (await isDocFreeLocked(supabase, { plan: (workspace as { plan?: string }).plan ?? 'free', id: workspace.id }, doc)) {
    return NextResponse.json({ error: DOC_LOCKED_MESSAGE }, { status: 403 })
  }

  // Se non accettato e forceAccept=false → blocca
  if (doc.status !== 'accepted' && !forceAccept) {
    return NextResponse.json(
      { error: 'Il preventivo deve essere accettato per convertirlo in fattura' },
      { status: 400 }
    )
  }

  // ── Opzioni a livelli (041): serve una proposta scelta ──────────────────
  // Un preventivo con più proposte e nessuna scelta (accettazione forzata
  // dall'app, non dal cliente) diventerebbe una fattura con le voci di
  // TUTTE le proposte sommate. Tollerante pre-migration.
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 041 non ancora in types/database.ts
    const db = supabase as any
    const { data: opt, error: optErr } = await db
      .from('documents')
      .select('options_enabled, accepted_tier')
      .eq('id', id)
      .maybeSingle()
    // Tollerante SOLO alla colonna mancante: un errore reale qui salterebbe
    // la guardia e la fattura nascerebbe con le voci di TUTTE le proposte.
    if (optErr && !isMissingColumnError(optErr)) {
      return NextResponse.json({ error: 'Errore di verifica delle proposte. Riprova tra qualche istante.' }, { status: 500 })
    }
    if (opt?.options_enabled && !opt?.accepted_tier) {
      const { data: tierRows, error: tierErr } = await db
        .from('document_items')
        .select('option_tier')
        .eq('document_id', id)
      if (tierErr && !isMissingColumnError(tierErr)) {
        return NextResponse.json({ error: 'Errore di verifica delle proposte. Riprova tra qualche istante.' }, { status: 500 })
      }
      const tiers = new Set(
        ((tierRows ?? []) as Array<{ option_tier: string | null }>).map((r) => r.option_tier ?? 'base')
      )
      if (tiers.size > 1) {
        return NextResponse.json(
          { error: 'Questo preventivo ha più proposte alternative: prima serve la scelta di una proposta (accettazione del cliente dal link pubblico).' },
          { status: 409 }
        )
      }
    }
  }

  // La funzione PG gestisce atomicamente il force_accept e la conversione
  const { data: newId, error } = await supabase.rpc('convert_preventivo_to_fattura', {
    p_doc_id: id,
    p_force_accept: forceAccept,
  })

  if (error) {
    console.error('[converti-fattura]', error)
    return NextResponse.json({ error: error.message ?? 'Errore nella conversione' }, { status: 500 })
  }

  // ── Una sola proposta nella FATTURA ─────────────────────────────────────
  // ⚠️ Il preventivo tiene le voci di TUTTE le proposte anche dopo la scelta
  // (così «Segna come non accettato» le ridà entrambe — Eli, 9 ago), e la funzione SQL
  // le copia tutte. Se non si sfoltisse qui, la fattura nascerebbe con Base +
  // Premium SOMMATE: un importo che non esiste in nessuno scenario.
  // Tollerante pre-041 e best-effort sul recupero: se qualcosa non torna si
  // lascia la fattura com'è e si logga, invece di lasciarla a metà.
  if (newId) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 041 non ancora in types/database.ts
      const db = supabase as any
      const { data: prev } = await db
        .from('documents')
        .select('accepted_tier, discount_pct, discount_fixed, vat_rate_default, workspace_id')
        .eq('id', id)
        .maybeSingle()
      const tier = (prev?.accepted_tier as string | null) ?? null
      if (tier) {
        const { data: righe } = await db.from('document_items').select('id, option_tier').eq('document_id', newId)
        const voci = (righe ?? []) as Array<Record<string, unknown>>
        const scelte = voci.filter((i) => ((i.option_tier as string | null) ?? 'base') === tier)
        const altre = voci.filter((i) => ((i.option_tier as string | null) ?? 'base') !== tier)
        if (altre.length > 0 && scelte.length > 0) {
          await db.from('document_items').delete().in('id', altre.map((i) => i.id as string))
        }
      }
      // ⚠️ RICALCOLO SEMPRE, non solo col tier (11 ago): il preventivo non
      // porta più la marca da bollo, quindi i totali copiati dalla funzione
      // SQL sono SENZA i 2 € — la fattura forfettaria sopra 77,47 € nascerebbe
      // col totale sbagliato. Il ricalcolo sulla fattura nuova (doc_type
      // 'fattura') lo aggiunge; su ordinario/sotto soglia non cambia nulla.
      const { data: righeFinali } = await db.from('document_items').select('*').eq('document_id', newId)
      if ((righeFinali ?? []).length > 0) {
        const { data: ws } = await db
          .from('workspaces').select('fiscal_regime')
          .eq('id', prev?.workspace_id).maybeSingle()
        const { calcolaDocumento } = await import('@/lib/fiscal/calcoli')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- voci lette con select('*')
        const fiscal = calcolaDocumento(righeFinali as any, {
          fiscal_regime: (ws?.fiscal_regime ?? 'forfettario') as 'forfettario' | 'ordinario' | 'minimi',
          currency: 'EUR',
          discount_pct: (prev?.discount_pct as number | null) ?? undefined,
          discount_fixed: (prev?.discount_fixed as number | null) ?? undefined,
          vat_rate_default: (prev?.vat_rate_default as number | null) ?? undefined,
          doc_type: 'fattura',
        })
        await db.from('documents').update({
          subtotal: fiscal.subtotal,
          tax_amount: fiscal.taxAmount,
          bollo_amount: fiscal.bollo,
          total: fiscal.total,
        }).eq('id', newId)
      }
    } catch (e) {
      console.error('[converti-fattura] sfoltimento della proposta non riuscito:', e)
    }
  }

  // ── Acconti: riporta l'acconto incassato sulla fattura ──────────────────
  // Se il preventivo aveva un acconto già ricevuto (payment_status 'partial'),
  // la fattura nasce con "Acconto già ricevuto −€X / Saldo €Y" e l'incasso
  // viene SPOSTATO sulla fattura (azzerato sul preventivo) per non contarlo
  // due volte nel Bilancio. Tollerante pre-migration 038.
  if (newId) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 038 non ancora in types/database.ts
      const db = supabase as any
      const { data: prevPay, error: prevPayErr } = await db
        .from('documents')
        .select('payment_status, paid_amount, paid_at')
        .eq('id', id)
        .maybeSingle()
      // Errore reale sulla lettura acconto: senza questo log lo spostamento
      // saltava in silenzio (acconto contato due volte nel Bilancio)
      if (prevPayErr && !isMissingColumnError(prevPayErr)) {
        console.error('[converti-fattura] lettura acconto fallita:', prevPayErr)
      }
      // Se la fattura (riconversione idempotente) ha GIÀ incassi registrati,
      // non sovrascriverli con i dati del preventivo
      const { data: fattPay } = await db
        .from('documents')
        .select('payment_status, document_log')
        .eq('id', newId)
        .maybeSingle()
      const fatturaVergine = !fattPay?.payment_status || fattPay.payment_status === 'unpaid'
      if (fatturaVergine && prevPay?.payment_status === 'partial' && Number(prevPay.paid_amount) > 0) {
        // L'acconto trasferito entra anche nel document_log della fattura
        // (review 4 ago, ALTA): senza questa voce, al saldo il Bilancio —
        // che legge la storia dal log — perderebbe l'acconto dal totale
        // (il saldo logga solo il residuo). Datata con la data VERA
        // dell'incasso, così resta nel suo mese.
        const fattLog = Array.isArray(fattPay?.document_log) ? fattPay.document_log : []
        const copyPatch = {
          payment_status: 'partial',
          paid_amount: prevPay.paid_amount,
          paid_at: prevPay.paid_at,
        }
        let { error: copyError } = await db
          .from('documents')
          .update({
            ...copyPatch,
            document_log: [...fattLog, {
              type: 'payment', kind: 'acconto',
              at: prevPay.paid_at ?? new Date().toISOString(),
              amount: Number(prevPay.paid_amount),
            }],
          })
          .eq('id', newId)
        // Pre-034 (document_log assente): il TRASFERIMENTO dell'acconto non
        // deve saltare per la voce di cronologia → retry senza log.
        if (copyError && isMissingColumnError(copyError)) {
          ;({ error: copyError } = await db.from('documents').update(copyPatch).eq('id', newId))
        }
        if (!copyError) {
          // Azzeramento sul preventivo con RETRY (review 25 lug A10): se
          // fallisse, ENTRAMBI i documenti resterebbero 'partial' e il
          // Bilancio conterebbe l'acconto due volte.
          const clearPatch = { payment_status: 'unpaid', paid_amount: null, paid_at: null }
          const { error: clearErr } = await db.from('documents').update(clearPatch).eq('id', id)
          if (clearErr) {
            const { error: clearRetryErr } = await db.from('documents').update(clearPatch).eq('id', id)
            if (clearRetryErr) console.error('[converti-fattura] CRITICO: acconto duplicato — azzeramento preventivo fallito due volte:', clearRetryErr, id)
          }
        }
      }
    } catch { /* colonne 038 mancanti */ }
  }

  return NextResponse.json({ success: true, fattura_id: newId })
}
