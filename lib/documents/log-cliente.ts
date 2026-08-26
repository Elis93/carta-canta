// ── L'esito del CLIENTE resta scritto in cronologia (Eli, 26 ago 2026) ──────
//
// «Ho rinviato un documento rifiutato ma nella cronologia non c'è traccia del
// fatto che era stato rifiutato: deve rimanere.» Aveva ragione: le route
// pubbliche accept/decline scrivevano solo lo STATO, e la voce «Rifiutato»
// della cronologia era DERIVATA da quello — riaprendo il preventivo lo stato
// non è più rejected e la storia spariva. La cronologia è la storia del
// documento: nulla si cancella (regola del 3 ago).
//
// Voci: `{ type: 'client_rejected', at, reason }` e
//       `{ type: 'client_accepted', at, tier?, signer? }` nel document_log.
//
// ⚠️ NON è 'use server' (stessa regola di log-scadenza.ts): prende il client
// come argomento, best-effort, non lancia mai — lo stato è già stato scritto,
// un log mancato non deve far fallire l'esito del cliente.

import { isMissingColumnError } from '@/lib/supabase/errors'

interface SupabaseishClient {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        maybeSingle: () => Promise<{ data: { document_log?: unknown } | null }>
      }
    }
    update: (values: Record<string, unknown>) => {
      eq: (col: string, val: string) => Promise<{ error: { code?: string; message?: string } | null }>
    }
  }
}

async function appendVoce(
  supabase: unknown,
  documentId: string,
  voce: Record<string, unknown>,
): Promise<void> {
  try {
    const sb = supabase as SupabaseishClient
    // Rilettura fresca del log subito prima dell'append (schema della status
    // route): riduce a millisecondi la finestra di una scrittura concorrente.
    const { data: fresh } = await sb
      .from('documents')
      .select('document_log')
      .eq('id', documentId)
      .maybeSingle()
    const current = Array.isArray(fresh?.document_log) ? fresh.document_log : []
    const { error } = await sb
      .from('documents')
      .update({ document_log: [...current, { ...voce, at: new Date().toISOString() }] })
      .eq('id', documentId)
    if (error && !isMissingColumnError(error)) {
      console.error('[log-cliente] voce non scritta:', error)
    }
  } catch (e) {
    console.error('[log-cliente] voce non scritta:', e)
  }
}

/** Rifiuto dal link pubblico: resta in cronologia anche dopo la riapertura. */
export async function logRifiutoCliente(
  supabase: unknown,
  documentId: string,
  reason: string | null,
): Promise<void> {
  await appendVoce(supabase, documentId, { type: 'client_rejected', reason: reason ?? null })
}

/** Accettazione dal link pubblico: resta anche dopo un «Riporta in bozza». */
export async function logAccettazioneCliente(
  supabase: unknown,
  documentId: string,
  opts: { tier?: string | null; signer?: string | null } = {},
): Promise<void> {
  await appendVoce(supabase, documentId, {
    type: 'client_accepted',
    ...(opts.tier ? { tier: opts.tier } : {}),
    ...(opts.signer ? { signer: opts.signer } : {}),
  })
}
