// lib/plan/free-lock.ts
// Downgrade Pro→Free — documenti INVIATI oltre i primi 8 in SOLA LETTURA
// (decisione Eli 12 ago). Gli 8 si contano sui documenti NON-bozza (inviati),
// per tipo, ordinati per created_at ASC. Le BOZZE restano sempre aperte
// (inviarne una 9ª è già bloccato dal contatore). Le note di credito/debito
// non si bloccano. La trasmissione SdI di una fattura già emessa resta sempre
// possibile (obbligo fiscale) → questa regola NON tocca la route SdI.

import { isFreePlan } from './gate'

export const FREE_OPEN_SENT = 8

/** Decisione PURA: un documento è bloccato su Free? (testabile senza DB) */
export function docLockedDecision(params: {
  isFree: boolean
  docType: string
  status: string
  docId: string
  /** ID dei primi 8 documenti INVIATI (non-bozza) del suo tipo */
  openSentIds: Set<string>
}): boolean {
  const { isFree, docType, status, docId, openSentIds } = params
  if (!isFree) return false
  if (docType !== 'preventivo' && docType !== 'fattura') return false
  if (status === 'draft') return false
  return !openSentIds.has(docId)
}

/**
 * ID dei primi 8 documenti INVIATI (non-bozza) del tipo.
 * `null` = insieme NON determinabile → i chiamanti NON devono bloccare:
 *   ① piano a pagamento (mai bloccato); ② errore della query (fail-OPEN, scelta
 *   deliberata: questo è un limite di piano, non una barriera di sicurezza —
 *   meglio lasciar passare una modifica su un #9 durante un blip del DB che
 *   bloccare per errore i documenti #1-8 legittimamente aperti dell'utente).
 * ⚠️ Chi usa questo Set direttamente (badge in lista) deve trattare `null`
 *   come «niente da bloccare»; `isDocFreeLocked` lo fa già qui sotto.
 */
export async function freeOpenSentIds(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  workspace: { plan: string; id: string },
  docType: 'preventivo' | 'fattura',
): Promise<Set<string> | null> {
  if (!isFreePlan(workspace.plan)) return null
  const { data, error } = await supabase
    .from('documents')
    .select('id')
    .eq('workspace_id', workspace.id)
    .eq('doc_type', docType)
    .neq('status', 'draft')
    .is('deleted_at', null)
    // created_at ASC + id ASC come spareggio STABILE: senza il secondo criterio,
    // due documenti con lo stesso created_at a cavallo dell'8°/9° potrebbero
    // uscire in ordine diverso fra la query del badge e quella della guardia.
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(FREE_OPEN_SENT)
  // Errore della query → insieme non determinabile: null (fail-open), NON un
  // Set vuoto (che bloccherebbe TUTTO, primi 8 compresi).
  if (error) return null
  return new Set(((data ?? []) as Array<{ id: string }>).map((d) => d.id))
}

/** true se il documento è bloccato su Free (oltre i primi 8 inviati del tipo). */
export async function isDocFreeLocked(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  workspace: { plan: string; id: string },
  doc: { id: string; doc_type: string; status: string },
): Promise<boolean> {
  if (!isFreePlan(workspace.plan)) return false
  if (doc.doc_type !== 'preventivo' && doc.doc_type !== 'fattura') return false
  if (doc.status === 'draft') return false
  const open = await freeOpenSentIds(supabase, workspace, doc.doc_type)
  // null qui = errore della query (il piano è già Free): non bloccare (fail-open).
  if (open === null) return false
  return docLockedDecision({ isFree: true, docType: doc.doc_type, status: doc.status, docId: doc.id, openSentIds: open })
}

/** Messaggio unico per i documenti bloccati (sola lettura su Free). */
export const DOC_LOCKED_MESSAGE =
  'Documento bloccato: è oltre gli 8 del piano gratuito. Torna a Pro per modificarlo o inviarlo.'
