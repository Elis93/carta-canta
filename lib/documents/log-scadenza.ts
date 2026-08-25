// ── Ogni NUOVA scadenza finisce in cronologia (Eli, 25 ago 2026) ────────────
//
// «Se un cliente ha fatto scadere i termini e rinvio impostando un nuovo
// termine, ogni volta che una nuova scadenza è impostata deve comparire come
// nuova voce nella cronologia»: la storia del documento deve dire QUANDO ogni
// termine è stato dato, non solo l'ultimo in vigore.
//
// La voce è `{ type: 'expiry_set', at, expires }` nel document_log — stessa
// forma delle altre voci (034). La scrive chi imposta una scadenza NUOVA su
// un documento già fuori bozza (primo invio, rinvio di uno scaduto, proroga
// del termine, cambio esplicito della validità, «Riapri»); le bozze no: la
// validità di una bozza cambia a ogni ritocco e sarebbe solo rumore.
//
// ⚠️ NON è 'use server' (stessa regola di conferma-fiscale.ts): prende il
// client come argomento, best-effort, non lancia mai — la scadenza è già
// stata scritta, un log mancato non deve far fallire l'azione.

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

export async function logNuovaScadenza(
  supabase: unknown,
  documentId: string,
  expiresIso: string,
): Promise<void> {
  try {
    const sb = supabase as SupabaseishClient
    // Rilettura fresca del log subito prima dell'append (schema della status
    // route, review 4 ago): riduce a millisecondi la finestra in cui una
    // voce concorrente verrebbe sovrascritta dall'array stantio.
    const { data: fresh } = await sb
      .from('documents')
      .select('document_log')
      .eq('id', documentId)
      .maybeSingle()
    const current = Array.isArray(fresh?.document_log) ? fresh.document_log : []
    const { error } = await sb
      .from('documents')
      .update({
        document_log: [
          ...current,
          { type: 'expiry_set', at: new Date().toISOString(), expires: expiresIso },
        ],
      })
      .eq('id', documentId)
    if (error && !isMissingColumnError(error)) {
      console.error('[log-scadenza] voce non scritta:', error)
    }
  } catch (e) {
    console.error('[log-scadenza] voce non scritta:', e)
  }
}
