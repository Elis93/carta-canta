'use server'

// ============================================================
// Cancellazione account self-service (GDPR art. 17) — Opzione A.
// Cancella subito account + dati personali NON fiscali; CONSERVA le
// fatture (obbligo di legge, art. 2220 c.c. — 10 anni), congelando il
// workspace. L'obbligo di conservazione è del titolare P.IVA: teniamo la
// sua copia (identità fiscale + fatture + clienti fatturati). Tutto il
// resto viene eliminato definitivamente.
//
// ⚠️ Azione IRREVERSIBILE. Solo il PROPRIETARIO del workspace può eseguirla.
// Testare SEMPRE prima sull'account demo (npm run seed:demo lo ricrea).
// ============================================================

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe } from '@/lib/stripe/stripe'
import { logoPathFromUrl } from '@/lib/storage/orphans'

/** Errore "tabella assente" (ambienti pre-migration): si salta, non si abortisce */
function isMissingTableError(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false
  return err.code === '42P01' || /does not exist|schema cache/i.test(err.message ?? '')
}

type Result = { error?: string; success?: true } | null

// Tabelle NON fiscali legate al workspace: si cancellano tutte.
// (I preventivi e i document_items dei preventivi si gestiscono a parte;
//  le fatture e le loro voci NON sono qui — vanno conservate.)
const NON_FISCAL_WS_TABLES = [
  'ai_import_usage',
  'catalog_items',
  'document_views',
  'expenses',
  'lavori',
  'marketplace_profiles',
  'marketplace_requests',
  'notification_reads',
  'reviews',
  'sdi_usage',
  'sopralluoghi',
  'templates',
  'voice_usage',
  'work_photos',
  'workspace_members',
  'invoice_sequences',
] as const

export async function deleteAccountAction(confirmText: string): Promise<Result> {
  // Doppia sicurezza: l'utente deve digitare ELIMINA nel dialog.
  if (confirmText.trim().toUpperCase() !== 'ELIMINA') {
    return { error: 'Scrivi ELIMINA per confermare.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sessione scaduta. Ricarica la pagina.' }

  // Solo il PROPRIETARIO può cancellare il workspace (i collaboratori no).
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, owner_id, logo_url, stripe_subscription_id')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!workspace) {
    return { error: 'Solo il titolare dell’account può eliminarlo. Per un account collaboratore scrivi a privacy@cartacanta.app.' }
  }

  // ── 0. Abbonamento Stripe: va DISDETTO prima di eliminare l'account ─────
  //    (altrimenti l'utente continuerebbe a pagare senza poter più accedere
  //    al portale per disdire). Se la disdetta fallisce, si ABORTISCE.
  if (workspace.stripe_subscription_id) {
    try {
      await getStripe().subscriptions.cancel(workspace.stripe_subscription_id)
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      // Se la subscription risulta già cancellata su Stripe, si prosegue.
      if (!/No such subscription|already.*(canceled|cancelled)/i.test(msg)) {
        console.error('[deleteAccount] disdetta Stripe fallita:', msg)
        return { error: 'Non sono riuscito a disdire l’abbonamento. Riprova, o disdici prima da Abbonamento › Gestisci, poi elimina l’account.' }
      }
    }
  }

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- alcune tabelle non sono in types/database.ts
  const db = admin as any
  const wsId = workspace.id

  try {
    // ── 1. File nello storage (foto lavoro) ──────────────────────────────
    try {
      const { data: photos } = await db
        .from('work_photos')
        .select('storage_path')
        .eq('workspace_id', wsId)
      const paths = ((photos ?? []) as Array<{ storage_path: string | null }>)
        .map((p) => p.storage_path)
        .filter((p): p is string => Boolean(p))
      if (paths.length > 0) {
        await admin.storage.from('work-photos').remove(paths)
      }
    } catch { /* bucket/tabella assente — prosegui */ }

    // Logo del workspace.
    // ⚠️ logoPathFromUrl e non un indexOf a mano: logo_url porta il
    // cache-buster `?v=` — il vecchio slice passava a remove() un nome con la
    // query attaccata, che non rimuoveva NULLA, in silenzio. Il file restava
    // nel bucket dopo una cancellazione account (trovato in revisione, 5 ago).
    if (workspace.logo_url) {
      try {
        const logoPath = logoPathFromUrl(workspace.logo_url)
        if (logoPath) await admin.storage.from('logos').remove([logoPath])
      } catch { /* ignora */ }
    }

    // ── 2. Tabelle non fiscali collegate al workspace ────────────────────
    //    supabase-js NON lancia: gli errori vanno controllati sul risultato.
    //    Tabella assente (pre-migration) → si salta; altri errori → ABORT
    //    (mai dichiarare "dati eliminati" se una delete è fallita).
    for (const table of NON_FISCAL_WS_TABLES) {
      const { error: delErr } = await db.from(table).delete().eq('workspace_id', wsId)
      if (delErr && !isMissingTableError(delErr)) {
        console.error(`[deleteAccount] delete ${table} fallita:`, delErr.message)
        return { error: 'Errore durante la cancellazione dei dati. Nessun account è stato eliminato: riprova o scrivi a privacy@cartacanta.app.' }
      }
    }

    // ── 3. Preventivi (NON fiscali): tutto ciò che non è una fattura ─────
    //     document_items dei preventivi cascadono (ON DELETE CASCADE).
    const { error: docsErr } = await db.from('documents').delete().eq('workspace_id', wsId).neq('doc_type', 'fattura')
    if (docsErr) {
      console.error('[deleteAccount] delete preventivi fallita:', docsErr.message)
      return { error: 'Errore durante la cancellazione dei preventivi. Nessun account è stato eliminato: riprova o scrivi a privacy@cartacanta.app.' }
    }

    // ── 4. Clienti: elimina quelli NON referenziati da una fattura ───────
    const { data: retainedFatture } = await db
      .from('documents')
      .select('client_id')
      .eq('workspace_id', wsId)
      .eq('doc_type', 'fattura')
    const keepClientIds = new Set(
      ((retainedFatture ?? []) as Array<{ client_id: string | null }>)
        .map((d) => d.client_id)
        .filter((id): id is string => Boolean(id))
    )
    const { data: allClients } = await db
      .from('clients')
      .select('id')
      .eq('workspace_id', wsId)
    const toDeleteClientIds = ((allClients ?? []) as Array<{ id: string }>)
      .map((c) => c.id)
      .filter((id) => !keepClientIds.has(id))
    if (toDeleteClientIds.length > 0) {
      const { error: cliErr } = await db.from('clients').delete().in('id', toDeleteClientIds)
      if (cliErr) {
        console.error('[deleteAccount] delete clienti fallita:', cliErr.message)
        return { error: 'Errore durante la cancellazione dei clienti. Nessun account è stato eliminato: riprova o scrivi a privacy@cartacanta.app.' }
      }
    }

    // ── 5. Congela il workspace: marcatori + rimozione dati personali ────
    //     Si CONSERVA l'identità fiscale (ragione_sociale, piva) perché serve
    //     sulle fatture trattenute. Si azzerano i dati non necessari.
    const nowIso = new Date().toISOString()
    // Prima con i marcatori 050; se la migration non è ancora applicata,
    // retry senza (la cancellazione NON deve bloccarsi a metà per questo).
    const scrub = { logo_url: null, phone: null, notification_prefs: {} }
    let { error: wsUpdErr } = await db
      .from('workspaces')
      .update({ ...scrub, deleted_at: nowIso, anonymized_at: nowIso })
      .eq('id', wsId)
    if (wsUpdErr) {
      ;({ error: wsUpdErr } = await db.from('workspaces').update(scrub).eq('id', wsId))
    }

    // ── 6. Elimina l'utente di autenticazione (login impossibile) ────────
    const { error: delUserErr } = await admin.auth.admin.deleteUser(user.id)
    if (delUserErr) {
      console.error('[deleteAccount] deleteUser fallito:', delUserErr.message)
      return { error: 'Errore durante la cancellazione. Riprova o scrivi a privacy@cartacanta.app.' }
    }

    // Chiudi la sessione lato server (best-effort)
    try { await supabase.auth.signOut() } catch { /* ignora */ }

    return { success: true }
  } catch (e) {
    console.error('[deleteAccount] errore:', e)
    return { error: 'Errore durante la cancellazione. Nessun dato fiscale è stato toccato. Riprova o scrivi a privacy@cartacanta.app.' }
  }
}
