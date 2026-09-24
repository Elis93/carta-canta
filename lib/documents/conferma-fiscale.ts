// ── La CONFERMA FISCALE della bozza (080 — 11 ago 2026) ─────────────────────
//
// «La data di creazione documento parte da quando la bozza viene confermata»
// (Eli): al primo passaggio fuori bozza nasce doc_date — la data che finisce
// nel campo <Data> dell'XML e da cui corrono i 12 giorni.
//
// ⚠️ Il PILOTA +24h (sdi_auto_at + cron sdi-auto) è stato RITIRATO con la
// Fase 1 della copia di cortesia (Eli, 20-21 set: «nessun concorrente ha un
// timer di ripensamento»): la trasmissione è un gesto ESPLICITO — «Invia allo
// SdI» — e il ripensamento è la bozza, prima del tasto. La colonna
// sdi_auto_at resta a DB, dormiente; azzeraConfermaFiscale e fermaPilotaSdi
// continuano a pulirla sulle righe legacy.
//
// ⚠️ Questo modulo NON è 'use server': i tre helper prendono il client
// Supabase come argomento e non devono diventare server action richiamabili
// dal browser (un file 'use server' espone OGNI export async come endpoint).
// Li chiamano le action di documents.ts, la route email e le route di stato.
//
// Tutte le scritture sono TOLLERANTI pre-080: colonne assenti → no-op.

import { giornoItaliano } from '@/lib/sdi/termini'

/**
 * Registra la PRIMA conferma di una fattura o nota di credito: scrive
 * doc_date = oggi (guardia `.is('doc_date', null)`: le conferme successive
 * non toccano niente).
 */
export async function registraConfermaFiscale(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 080 non nei tipi generati al momento della scrittura
  supabase: any,
  workspaceId: string,
  docId: string,
  docType: string | null | undefined,
): Promise<void> {
  // Tutti i documenti FISCALI: fatture, note di credito/debito e fatture di
  // acconto. (La nota di debito mancava — chiusa col censimento della Fase 2
  // acconti, 24 set. La TD02 nasce già con doc_date = giorno dell'incasso:
  // la guardia `.is('doc_date', null)` qui sotto la lascia intatta.)
  if (docType === 'preventivo' || !docType) return
  try {
    await supabase
      .from('documents')
      .update({ doc_date: giornoItaliano(new Date()) })
      .eq('id', docId)
      .eq('workspace_id', workspaceId)
      .is('doc_date', null)
      .then(() => {}, () => {})
  } catch { /* pre-080 */ }
}

/**
 * Il ritorno in bozza azzera la conferma: la bozza non ha data fiscale né
 * trasmissioni in programma — rinascono alla prossima conferma.
 *
 * ⚠️ ECCEZIONE: se il documento ha GIÀ un esito SdI la data NON si tocca.
 * Una SCARTATA va corretta e ritrasmessa entro 5 giorni con lo STESSO
 * numero e la STESSA data — azzerarla qui farebbe nascere una data nuova
 * alla riconferma. (Una trasmessa vera in bozza non ci arriva: guardie.)
 */
export async function azzeraConfermaFiscale(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 080 non nei tipi generati al momento della scrittura
  supabase: any,
  workspaceId: string,
  docId: string,
): Promise<void> {
  try {
    const esitoSdi = await supabase
      .from('documents')
      .select('sdi_status')
      .eq('id', docId)
      .maybeSingle()
      .then(
        (r: { data: { sdi_status?: string | null } | null; error: unknown }) =>
          r.error ? null : (r.data?.sdi_status ?? null),
        () => null,
      )
    await supabase
      .from('documents')
      .update(esitoSdi ? { sdi_auto_at: null } : { doc_date: null, sdi_auto_at: null })
      .eq('id', docId)
      .eq('workspace_id', workspaceId)
      .then(() => {}, () => {})
  } catch { /* pre-080 */ }
}

/** Ferma SOLO il pilota (sdi_auto_at), lasciando intatta la data fiscale.
 *  Serve all'ANNULLAMENTO di una fattura e al RIPRISTINO dal cestino:
 *  in entrambi i casi il documento non è una bozza (la data resta), ma una
 *  trasmissione programmata in un altro momento non deve più partire da
 *  sola — se serve, rinasce con una nuova conferma o si trasmette a mano. */
export async function fermaPilotaSdi(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonna 080 non nei tipi generati al momento della scrittura
  supabase: any,
  workspaceId: string,
  docId: string,
): Promise<void> {
  try {
    await supabase
      .from('documents')
      .update({ sdi_auto_at: null })
      .eq('id', docId)
      .eq('workspace_id', workspaceId)
      .then(() => {}, () => {})
  } catch { /* pre-080 */ }
}
