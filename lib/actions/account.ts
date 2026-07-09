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
    .select('id, owner_id, logo_url')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!workspace) {
    return { error: 'Solo il titolare dell’account può eliminarlo. Per un account collaboratore scrivi a privacy@cartacanta.app.' }
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

    // Logo del workspace
    if (workspace.logo_url) {
      try {
        const marker = '/logos/'
        const idx = workspace.logo_url.indexOf(marker)
        if (idx !== -1) {
          const logoPath = workspace.logo_url.slice(idx + marker.length)
          if (logoPath) await admin.storage.from('logos').remove([logoPath])
        }
      } catch { /* ignora */ }
    }

    // ── 2. Tabelle non fiscali collegate al workspace ────────────────────
    for (const table of NON_FISCAL_WS_TABLES) {
      try {
        await db.from(table).delete().eq('workspace_id', wsId)
      } catch { /* tabella assente in questo ambiente — prosegui */ }
    }

    // ── 3. Preventivi (NON fiscali): tutto ciò che non è una fattura ─────
    //     document_items dei preventivi cascadono (ON DELETE CASCADE).
    await db.from('documents').delete().eq('workspace_id', wsId).neq('doc_type', 'fattura')

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
      await db.from('clients').delete().in('id', toDeleteClientIds)
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
