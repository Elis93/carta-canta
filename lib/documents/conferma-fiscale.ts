// ── La CONFERMA FISCALE della bozza (080 — 11 ago 2026) ─────────────────────
//
// «La data di creazione documento parte da quando la bozza viene confermata»
// (Eli): al primo passaggio fuori bozza nasce doc_date — la data che finisce
// nel campo <Data> dell'XML e da cui corrono i 12 giorni — e, per le fatture
// col pilota acceso, viene programmata la trasmissione automatica (+24h).
//
// ⚠️ Questo modulo NON è 'use server': i tre helper prendono il client
// Supabase come argomento e non devono diventare server action richiamabili
// dal browser (un file 'use server' espone OGNI export async come endpoint).
// Li chiamano le action di documents.ts, la route email e le route di stato.
//
// Tutte le scritture sono TOLLERANTI pre-080: colonne assenti → no-op.

import { giornoItaliano } from '@/lib/sdi/termini'
import { getSdiQuota } from '@/lib/sdi/quota'

/**
 * Registra la PRIMA conferma di una fattura o nota di credito: scrive
 * doc_date = oggi (guardia `.is('doc_date', null)`: le conferme successive
 * non toccano niente) e programma il pilota SdI dove ha senso.
 *
 * Il pilota NON parte se:
 *  · non è una fattura (le note di credito si trasmettono sempre a mano);
 *  · lo SdI è spento o l'interruttore del workspace è spento;
 *  · la QUOTA e-fatture non lo consente (Free esaurito, tetto, pausa):
 *    programmare un invio che il cron rifiuterebbe è una promessa falsa —
 *    il caso resta manuale e la card mostra il paywall/avviso giusto;
 *  · il documento ha già un esito SdI (es. scartata riconfermata: il
 *    reinvio di una scartata è un gesto manuale col tasto «Reinvia»).
 */
export async function registraConfermaFiscale(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 080 non nei tipi generati al momento della scrittura
  supabase: any,
  workspaceId: string,
  docId: string,
  docType: string | null | undefined,
): Promise<void> {
  if (docType !== 'fattura' && docType !== 'nota_credito') return
  try {
    let autoAt: string | null = null
    if (docType === 'fattura' && process.env.NEXT_PUBLIC_SDI_ENABLED === 'true') {
      const ws = await supabase
        .from('workspaces')
        .select('sdi_auto_enabled, plan')
        .eq('id', workspaceId)
        .maybeSingle()
        .then(
          (r: { data: { sdi_auto_enabled?: boolean | null; plan?: string | null } | null; error: unknown }) =>
            r.error ? null : r.data,
          () => null,
        )
      const acceso = !!ws && ws.sdi_auto_enabled !== false
      if (acceso) {
        // La quota PRIMA di promettere: un pilota programmato su un Free a
        // quota esaurita fallirebbe al primo giro del cron, in silenzio.
        const quota = await getSdiQuota(workspaceId, ws?.plan ?? 'free').then(
          (q) => q,
          () => ({ allowed: false }) as { allowed: boolean },
        )
        if (quota.allowed) autoAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString()
      }
      // Un documento con un esito SdI (scartata) non si riprogramma: il
      // cron lo escluderebbe comunque (.is sdi_status null) e la card non
      // mostrerebbe il riquadro — sarebbe una promessa scritta solo a DB.
      if (autoAt) {
        const esito = await supabase
          .from('documents')
          .select('sdi_status')
          .eq('id', docId)
          .maybeSingle()
          .then(
            (r: { data: { sdi_status?: string | null } | null; error: unknown }) =>
              r.error ? null : (r.data?.sdi_status ?? null),
            () => null,
          )
        if (esito) autoAt = null
      }
    }
    await supabase
      .from('documents')
      .update({ doc_date: giornoItaliano(new Date()), ...(autoAt ? { sdi_auto_at: autoAt } : {}) })
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
