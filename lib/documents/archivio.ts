// ============================================================
// Archivio dei documenti e solleciti spenti (075, Eli 8 ago 2026)
//
// Due cose distinte, per scelta esplicita di Eli:
//
//   • «Non ricordarmelo più» (`reminders_off_at`) — il documento resta dov'è,
//     ma non compare più fra i promemoria.
//   • «Archivia» (`archived_at`) — il documento esce dalle liste attive e
//     finisce nella pillola «Archiviati».
//
// ⚠️ NESSUNA delle due è una cancellazione: il Bilancio, gli export, il registro
// fatture e la scheda del cliente NON filtrano su queste colonne, e non devono
// iniziare a farlo. Un archivio che toglie soldi dai conti è un archivio che fa
// sbagliare i conti senza dire perché.
//
// Qui dentro stanno le due funzioni condivise da Home, pagine delle scadenze,
// campanella e liste, così la regola è scritta una volta sola.
// ============================================================

import { cache } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type Client = SupabaseClient<Database>

/** Stati in cui un documento può ancora generare un promemoria. */
const STATI_CON_PROMEMORIA: Array<Database['public']['Tables']['documents']['Row']['status']> = ['sent', 'viewed', 'expired']

export interface DocumentoSenzaPromemoria {
  id: string
  doc_type: string
  status: string
  expiresAt: string | null
  /** Rinvio a tempo (074) ancora attivo, se c'è */
  snoozeUntil: string | null
  archiviato: boolean
  sollecitiSpenti: boolean
}

/**
 * I documenti che NON devono comparire fra i promemoria: rinviati a tempo (074),
 * con i solleciti spenti, oppure archiviati (075).
 *
 * ⚠️ Query a sé e TOLLERANTE (`.then(ok, ko)`): se le colonne non esistono
 * ancora, torna una lista vuota e l'app si comporta esattamente come prima.
 * Metterle nelle select principali farebbe fallire l'INTERA query e lascerebbe
 * la Home vuota — è la lezione della 073/074.
 *
 * Limitata agli stati che un promemoria può riguardare: senza quel filtro un
 * archivio pieno di documenti chiusi gonfierebbe la lista senza motivo, e i
 * conteggi che sottraggono queste righe sbaglierebbero per eccesso.
 */
export async function documentiSenzaPromemoria(
  supabase: Client,
  workspaceId: string,
  nowIso: string = new Date().toISOString(),
): Promise<DocumentoSenzaPromemoria[]> {
  type Riga = {
    id: string
    doc_type: string
    status: string
    expires_at: string | null
    snooze_until: string | null
    archived_at: string | null
    reminders_off_at: string | null
  }

  const righe = await supabase
    .from('documents')
    .select('id, doc_type, status, expires_at, snooze_until, archived_at, reminders_off_at')
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .in('status', STATI_CON_PROMEMORIA)
    .or(`snooze_until.gt.${nowIso},archived_at.not.is.null,reminders_off_at.not.is.null`)
    .limit(1000)
    .then(
      (r: { data: Riga[] | null }) => r.data ?? [],
      () => [] as Riga[],
    )

  return righe.map((r) => ({
    id: r.id,
    doc_type: r.doc_type,
    status: r.status,
    expiresAt: r.expires_at,
    snoozeUntil: r.snooze_until && r.snooze_until > nowIso ? r.snooze_until : null,
    archiviato: !!r.archived_at,
    sollecitiSpenti: !!r.reminders_off_at,
  }))
}

/**
 * `true` se il database conosce già la colonna `archived_at` (075 applicata).
 *
 * Serve alle LISTE, che devono filtrare in SQL (la paginazione conta le righe
 * lato database: un filtro fatto dopo darebbe pagine di lunghezza diversa e
 * conteggi sbagliati). Finché la migration non c'è, le liste si comportano
 * come prima invece di finire sull'errore "Non riesco a caricare i preventivi".
 */
export const archivioDisponibile = cache(async (supabase: Client): Promise<boolean> => {
  return supabase
    .from('documents')
    .select('archived_at')
    .limit(1)
    .then(
      (r: { error: unknown }) => !r.error,
      () => false,
    )
})
