// ============================================================
// Documenti fiscali nati da un preventivo (Eli, 26 set 2026).
//
// Un preventivo da cui è nata una FATTURA o una FATTURA DI ACCONTO non si
// elimina: è il documento d'origine di quella fattura (origin_document_id) e,
// per l'acconto, è anche dove vive l'incasso contato nelle Entrate del
// Bilancio. Eliminarlo lascerebbe una fattura senza il suo preventivo e un
// acconto fatturato che sparisce dai conti.
//
// ⚠️ Nessun tempo di sblocco: la fattura va conservata dieci anni e il suo
// preventivo resta la sua origine per tutto quel tempo. Per toglierlo dalla
// lista c'è «Archivia» (non tocca conti né collegamenti).
// Le NOTE (credito/debito) non contano qui: nascono dalla fattura, non dal
// preventivo. NON 'use server': il client Supabase è un argomento.
// ============================================================

import { formatDocNumber } from '@/lib/utils'

export interface FatturaCollegata {
  doc_type: string
  doc_number: string | null
}

/** Tipi di documento che, se nati dal preventivo, ne impediscono l'eliminazione. */
export const TIPI_CHE_BLOCCANO = ['fattura', 'fattura_acconto'] as const

/** Etichetta leggibile della prima fattura collegata («la fattura 003/2026»). */
function etichetta(f: FatturaCollegata): string {
  const num = f.doc_number ? ` ${formatDocNumber(f.doc_number)}` : ''
  if (f.doc_type === 'fattura_acconto') return `la fattura di acconto${num}`
  return f.doc_number ? `la fattura${num}` : 'una bozza di fattura'
}

/**
 * Messaggio del divieto (schema §B.2: cosa non si può · perché · cosa fare).
 * `null` se non ci sono fatture collegate.
 */
export function messaggioPreventivoCollegato(fatture: FatturaCollegata[]): string | null {
  if (fatture.length === 0) return null
  const prima = etichetta(fatture[0])
  const n = fatture.length - 1
  const altre = n === 1 ? ' (e un’altra fattura)' : n > 1 ? ` (e altre ${n} fatture)` : ''
  return (
    `Preventivo non eliminabile: da qui è nata ${prima}${altre}, che resta legata a questo preventivo. ` +
    'Per toglierlo dalla lista, usa «Archivia».'
  )
}

/**
 * Fatture e fatture di acconto ATTIVE (fuori dal cestino) nate dal preventivo.
 * Su errore di lettura torna `null`: il chiamante decide (fail-closed lato
 * server — nel dubbio non si elimina).
 */
export async function fattureCollegateAttive(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- client server o admin
  supabase: any,
  workspaceId: string,
  preventivoId: string,
): Promise<FatturaCollegata[] | null> {
  const { data, error } = await supabase
    .from('documents')
    .select('doc_type, doc_number')
    .eq('workspace_id', workspaceId)
    .eq('origin_document_id', preventivoId)
    .in('doc_type', TIPI_CHE_BLOCCANO as unknown as string[])
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
  if (error) return null
  return (data ?? []) as FatturaCollegata[]
}
