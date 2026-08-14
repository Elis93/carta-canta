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

/** ID dei primi 8 documenti INVIATI (non-bozza) del tipo. null = piano a pagamento. */
export async function freeOpenSentIds(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  workspace: { plan: string; id: string },
  docType: 'preventivo' | 'fattura',
): Promise<Set<string> | null> {
  if (!isFreePlan(workspace.plan)) return null
  const { data } = await supabase
    .from('documents')
    .select('id')
    .eq('workspace_id', workspace.id)
    .eq('doc_type', docType)
    .neq('status', 'draft')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(FREE_OPEN_SENT)
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
  return docLockedDecision({ isFree: true, docType: doc.doc_type, status: doc.status, docId: doc.id, openSentIds: open ?? new Set() })
}

/** Messaggio unico per i documenti bloccati (sola lettura su Free). */
export const DOC_LOCKED_MESSAGE =
  'Documento bloccato: è oltre gli 8 del piano Free. Torna a Pro per modificarlo o inviarlo.'
