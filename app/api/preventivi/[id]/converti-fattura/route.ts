// POST /api/preventivi/[id]/converti-fattura
// Converte un preventivo accettato in fattura (bozza).
// Richiede autenticazione — usa RLS-aware client.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
    .select('id')
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
        .from('workspaces').select('id')
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
    .maybeSingle()

  if (!doc) return NextResponse.json({ error: 'Documento non trovato' }, { status: 404 })
  if (doc.doc_type !== 'preventivo') return NextResponse.json({ error: 'Non è un preventivo' }, { status: 400 })

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
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 041 non ancora in types/database.ts
    const db = supabase as any
    const { data: opt } = await db
      .from('documents')
      .select('options_enabled, accepted_tier')
      .eq('id', id)
      .maybeSingle()
    if (opt?.options_enabled && !opt?.accepted_tier) {
      const { data: tierRows } = await db
        .from('document_items')
        .select('option_tier')
        .eq('document_id', id)
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
  } catch { /* colonne 041 mancanti */ }

  // La funzione PG gestisce atomicamente il force_accept e la conversione
  const { data: newId, error } = await supabase.rpc('convert_preventivo_to_fattura', {
    p_doc_id: id,
    p_force_accept: forceAccept,
  })

  if (error) {
    console.error('[converti-fattura]', error)
    return NextResponse.json({ error: error.message ?? 'Errore nella conversione' }, { status: 500 })
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
      const { data: prevPay } = await db
        .from('documents')
        .select('payment_status, paid_amount, paid_at')
        .eq('id', id)
        .maybeSingle()
      if (prevPay?.payment_status === 'partial' && Number(prevPay.paid_amount) > 0) {
        const { error: copyError } = await db
          .from('documents')
          .update({
            payment_status: 'partial',
            paid_amount: prevPay.paid_amount,
            paid_at: prevPay.paid_at,
          })
          .eq('id', newId)
        if (!copyError) {
          await db
            .from('documents')
            .update({ payment_status: 'unpaid', paid_amount: null, paid_at: null })
            .eq('id', id)
        }
      }
    } catch { /* colonne 038 mancanti */ }
  }

  return NextResponse.json({ success: true, fattura_id: newId })
}
