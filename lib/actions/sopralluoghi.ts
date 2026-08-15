'use server'

// ============================================================
// Server Actions — Sopralluoghi (appunti di cantiere, migration 041)
// Mockup mockup_feature_cantiere.html §1 (approvato).
// Gli appunti restano PRIVATI dell'artigiano; "Trasforma in preventivo"
// crea una bozza con cliente agganciato, appunti nelle Note interne
// (non visibili al cliente) e foto già collegate al documento.
// ============================================================

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isMissingColumnError } from '@/lib/supabase/errors'
import { allocateDocNumber } from '@/lib/actions/documents'
import { parseMisure, misureToNotes } from '@/lib/calc/misure'

type ActionResult = { error?: string; success?: string; id?: string } | null

async function getWorkspace(): Promise<{ id: string; plan: string } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('workspaces')
    .select('id, plan')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (data) return data

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .not('accepted_at', 'is', null)
    .limit(1)
    .maybeSingle()
  if (!membership) return null
  const { data: mw } = await supabase
    .from('workspaces')
    .select('id, plan')
    .eq('id', membership.workspace_id)
    .maybeSingle()
  return mw
}

// Limite foto per documento sul piano Free (decisione Eli — illimitate su Pro).
// NB: niente export — un file 'use server' può esportare solo funzioni async.
const FREE_PHOTO_LIMIT = 6

// Converte il valore di un <input type="datetime-local"> ("YYYY-MM-DDTHH:MM",
// ora italiana) in ISO con l'offset corretto di Roma (CET/CEST): il server
// gira in UTC, senza offset l'orario slitterebbe di 1-2 ore.
function romeIso(naive: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(naive)) return null
  const probe = new Date(`${naive}:00Z`)
  if (Number.isNaN(probe.getTime())) return null
  const tzName = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Rome', timeZoneName: 'longOffset' })
    .formatToParts(probe)
    .find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+01:00'
  const m = tzName.match(/GMT([+-]\d{2}):?(\d{2})?/)
  const offset = m ? `${m[1]}:${m[2] ?? '00'}` : '+01:00'
  return `${naive}:00${offset}`
}

export async function saveSopralluogoAction(formData: FormData): Promise<ActionResult> {
  const workspace = await getWorkspace()
  if (!workspace) return { error: 'Sessione scaduta. Ricarica la pagina.' }

  const id = String(formData.get('id') ?? '').trim() || null
  const title = String(formData.get('title') ?? '').trim().slice(0, 120)
  const address = String(formData.get('address') ?? '').trim().slice(0, 200)
  const notes = String(formData.get('notes') ?? '').trim().slice(0, 8000)
  const clientId = String(formData.get('client_id') ?? '').trim() || null
  // Appuntamento (calendario sopralluoghi, migration 047). Stringa vuota = nessun appuntamento.
  const scheduledRaw = String(formData.get('scheduled_at') ?? '').trim()
  const scheduledAt = scheduledRaw ? romeIso(scheduledRaw) : null
  // Misure calcolate (054). Il campo viene toccato SOLO se il form lo invia:
  // un client con una build vecchia (senza calcolatrice) non deve azzerare
  // le misure già salvate.
  const measurementsRaw = formData.get('measurements')
  const misure = measurementsRaw !== null ? parseMisure(String(measurementsRaw)) : null

  // Photo-first: in cantiere spesso si parte dalle foto, senza scrivere
  // nulla. Un sopralluogo vuoto si salva comunque con un titolo di default
  // datato — si completa dopo, con calma.
  const fallbackTitle = `Sopralluogo ${new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'long' , timeZone: 'Europe/Rome' })}`

  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabella 041 non ancora in types/database.ts
  const db = supabase as any

  const baseFields = {
    title: title || fallbackTitle,
    address: address || null,
    notes: notes || null,
    client_id: clientId,
  }

  // Colonne opzionali a cascata: prima TUTTE (054+047), poi senza measurements
  // (solo 047), poi senza entrambe (pre-047). Il retry scatta SOLO su
  // "colonna mancante" — qualsiasi altro errore non va mascherato.
  const withMisure = misure !== null ? { measurements: misure } : {}
  const fieldTiers: Array<Record<string, unknown>> = [
    { ...baseFields, ...withMisure, scheduled_at: scheduledAt },
    { ...baseFields, scheduled_at: scheduledAt },
    { ...baseFields },
  ]

  type DbError = { code?: string; message?: string } | null

  if (id) {
    let error: DbError = null
    for (const tier of fieldTiers) {
      ;({ error } = await db
        .from('sopralluoghi')
        .update({ ...tier, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('workspace_id', workspace.id))
      if (!error || !isMissingColumnError(error)) break
    }
    if (error) return { error: 'Salvataggio non riuscito. La migration 041 potrebbe non essere ancora applicata.' }
    revalidatePath('/sopralluoghi')
    return { success: 'Sopralluogo salvato', id }
  }

  let created: { id: string } | null = null
  let error: DbError = null
  for (const tier of fieldTiers) {
    ;({ data: created, error } = await db
      .from('sopralluoghi')
      .insert({ workspace_id: workspace.id, ...tier })
      .select('id')
      .single())
    if ((!error && created) || !isMissingColumnError(error)) break
  }
  if (error || !created) return { error: 'Salvataggio non riuscito. La migration 041 potrebbe non essere ancora applicata.' }

  revalidatePath('/sopralluoghi')
  return { success: 'Sopralluogo salvato', id: created.id }
}

export async function deleteSopralluogoAction(id: string): Promise<ActionResult> {
  const workspace = await getWorkspace()
  if (!workspace) return { error: 'Sessione scaduta.' }

  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabella 041 non ancora in types/database.ts
  const { error } = await (supabase as any)
    .from('sopralluoghi')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('workspace_id', workspace.id)
  if (error) return { error: 'Eliminazione non riuscita.' }
  revalidatePath('/sopralluoghi')
  revalidatePath('/cestino')
  return { success: 'Sopralluogo eliminato' }
}

/** Ripristina un sopralluogo dal cestino (deleted_at → null). */
export async function restoreSopralluogoAction(id: string): Promise<{ error?: string; success?: string }> {
  const workspace = await getWorkspace()
  if (!workspace) return { error: 'Sessione scaduta.' }
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabella 041 non ancora in types/database.ts
  const { error } = await (supabase as any)
    .from('sopralluoghi')
    .update({ deleted_at: null })
    .eq('id', id)
    .eq('workspace_id', workspace.id)
    .not('deleted_at', 'is', null) // ripristina solo se è davvero nel cestino
  if (error) return { error: 'Ripristino non riuscito.' }
  revalidatePath('/sopralluoghi')
  revalidatePath('/cestino')
  return { success: 'Sopralluogo ripristinato' }
}

/** Elimina DEFINITIVAMENTE un sopralluogo già nel cestino (irreversibile). */
export async function purgeSopralluogoAction(id: string): Promise<{ error?: string; success?: string }> {
  const workspace = await getWorkspace()
  if (!workspace) return { error: 'Sessione scaduta.' }
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabella 041 non ancora in types/database.ts
  const db = supabase as any

  // Solo un sopralluogo del workspace e GIÀ nel cestino (difesa)
  const { data: row } = await db
    .from('sopralluoghi')
    .select('id')
    .eq('id', id)
    .eq('workspace_id', workspace.id)
    .not('deleted_at', 'is', null)
    .maybeSingle()
  if (!row) return { error: 'Sopralluogo non trovato nel cestino.' }

  // Foto collegate: prima i file dallo storage (admin → funziona anche per un
  // collaboratore), poi le righe. Senza, resterebbero orfane per sempre.
  const { data: photos } = await db
    .from('work_photos')
    .select('storage_path')
    .eq('sopralluogo_id', id)
  const paths = (photos ?? [])
    .map((p: { storage_path: string | null }) => p.storage_path)
    .filter((p: string | null): p is string => !!p)
  if (paths.length > 0) {
    await createAdminClient().storage.from('work-photos').remove(paths) // best-effort
    await db.from('work_photos').delete().eq('sopralluogo_id', id)
  }

  const { error } = await db
    .from('sopralluoghi')
    .delete()
    .eq('id', id)
    .eq('workspace_id', workspace.id)
  if (error) return { error: 'Eliminazione definitiva non riuscita.' }
  revalidatePath('/sopralluoghi')
  revalidatePath('/cestino')
  return { success: 'Sopralluogo eliminato definitivamente' }
}

/** Registra una foto caricata nel bucket work-photos (dal client). */
// Il rapportino (/r/[token]) mostra LIVE le foto del documento collegato al
// lavoro; una volta firmato, quelle foto sono contenuto firmato → congelate
// (gemello del congelamento ore, audit 24 lug #9). Tollerante pre-053.
async function documentHasSignedReport(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- client server o admin
  db: any,
  workspaceId: string,
  documentId: string | null | undefined,
): Promise<boolean> {
  if (!documentId) return false
  try {
    const { data } = await db
      .from('lavori')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('document_id', documentId)
      .not('report_signed_at', 'is', null)
      // Lavoro nel cestino → il rapportino pubblico è già irraggiungibile
      // (404): congelare non serve più e bloccherebbe le foto per sempre
      // senza che l'artigiano veda il perché (review 25 lug M2).
      .is('deleted_at', null)
      .limit(1)
    return Array.isArray(data) && data.length > 0
  } catch {
    return false // colonna report_signed_at assente (pre-053) → non bloccare
  }
}

// Stesso registro del gemello ore ("Il rapportino è firmato: le ore non si
// possono più modificare.") — su lavori/[id] il rapportino È quello che
// l'utente sta guardando, "collegato" suonerebbe di un'altra cosa.
const REPORT_SIGNED_PHOTO_ERR = 'Il rapportino è firmato: queste foto non si possono più modificare.'

export async function addWorkPhotoAction(input: {
  storagePath: string
  sopralluogoId?: string | null
  documentId?: string | null
  label?: 'prima' | 'dopo' | null
  visibleToClient?: boolean
}): Promise<ActionResult> {
  const workspace = await getWorkspace()
  if (!workspace) return { error: 'Sessione scaduta.' }
  const path = String(input.storagePath ?? '').trim()
  if (!path || path.includes('..')) return { error: 'Percorso foto non valido.' }

  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabella 041 non ancora in types/database.ts
  const db = supabase as any

  // Rapportino firmato → foto congelate (non si aggiungono al documento firmato)
  if (await documentHasSignedReport(db, workspace.id, input.documentId)) {
    return { error: REPORT_SIGNED_PHOTO_ERR }
  }

  // Limite Free: max 6 foto per documento (Pro illimitate)
  if (input.documentId && workspace.plan === 'free') {
    const { count } = await db
      .from('work_photos')
      .select('id', { count: 'exact', head: true })
      .eq('document_id', input.documentId)
    if ((count ?? 0) >= FREE_PHOTO_LIMIT) {
      return { error: `Con il piano Free puoi allegare fino a ${FREE_PHOTO_LIMIT} foto per documento. Con Pro sono illimitate.` }
    }
  }

  const { data, error } = await db
    .from('work_photos')
    .insert({
      workspace_id: workspace.id,
      storage_path: path,
      sopralluogo_id: input.sopralluogoId ?? null,
      document_id: input.documentId ?? null,
      label: input.label === 'prima' || input.label === 'dopo' ? input.label : null,
      visible_to_client: input.visibleToClient === true,
    })
    .select('id')
    .single()
  if (error || !data) return { error: 'Registrazione foto non riuscita.' }
  return { success: 'Foto aggiunta', id: data.id }
}

export async function updateWorkPhotoAction(
  photoId: string,
  patch: { label?: 'prima' | 'dopo' | null; visibleToClient?: boolean; detachFromDocument?: boolean }
): Promise<ActionResult> {
  const workspace = await getWorkspace()
  if (!workspace) return { error: 'Sessione scaduta.' }

  const update: Record<string, unknown> = {}
  if (patch.label !== undefined) update.label = patch.label
  if (patch.visibleToClient !== undefined) update.visible_to_client = patch.visibleToClient
  if (patch.detachFromDocument) {
    update.document_id = null
    update.visible_to_client = false
  }
  if (Object.keys(update).length === 0) return null

  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabella 041 non ancora in types/database.ts
  const db = supabase as any

  // Se la foto è su un documento con rapportino firmato, è contenuto firmato:
  // niente cambi di visibilità/etichetta/scollegamento (audit 24 lug #9).
  const { data: photo } = await db
    .from('work_photos')
    .select('document_id')
    .eq('id', photoId)
    .eq('workspace_id', workspace.id)
    .maybeSingle()
  if (photo && await documentHasSignedReport(db, workspace.id, photo.document_id)) {
    return { error: REPORT_SIGNED_PHOTO_ERR }
  }

  const { error } = await db
    .from('work_photos')
    .update(update)
    .eq('id', photoId)
    .eq('workspace_id', workspace.id)
  if (error) return { error: 'Aggiornamento foto non riuscito.' }
  return null
}

export async function deleteWorkPhotoAction(photoId: string): Promise<ActionResult> {
  const workspace = await getWorkspace()
  if (!workspace) return { error: 'Sessione scaduta.' }

  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabella 041 non ancora in types/database.ts
  const db = supabase as any
  const { data: photo } = await db
    .from('work_photos')
    .select('id, storage_path, document_id')
    .eq('id', photoId)
    .eq('workspace_id', workspace.id)
    .maybeSingle()
  if (!photo) return { error: 'Foto non trovata.' }

  // Rapportino firmato → foto congelate (audit 24 lug #9)
  if (await documentHasSignedReport(db, workspace.id, photo.document_id)) {
    return { error: REPORT_SIGNED_PHOTO_ERR }
  }

  const { error } = await db.from('work_photos').delete().eq('id', photoId)
  if (error) return { error: 'Eliminazione non riuscita.' }

  // Best effort: rimuovi anche il file dal bucket.
  // ⚠️ ADMIN, non il client di sessione: la policy DELETE (045) copre solo la
  // PROPRIA cartella, e in un team la foto può averla caricata un
  // collaboratore — con la sessione il file resterebbe nel bucket per sempre,
  // senza più nessuna riga che lo colleghi a qualcosa. Chi può cancellare è
  // già stato verificato sopra (foto del workspace, rapportino non firmato).
  try {
    const { error: rmErr } = await createAdminClient().storage.from('work-photos').remove([photo.storage_path])
    if (rmErr) console.error('[foto] file non rimosso dallo storage:', rmErr)
  } catch (err) { console.error('[foto] storage non raggiungibile:', err) }
  return { success: 'Foto eliminata' }
}

/**
 * Trasforma un sopralluogo in una bozza di preventivo:
 * cliente agganciato · appunti → Note interne · foto collegate al documento.
 */
export async function createPreventivoFromSopralluogoAction(sopralluogoId: string): Promise<ActionResult> {
  const workspace = await getWorkspace()
  if (!workspace) return { error: 'Sessione scaduta.' }

  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelle 041 non ancora in types/database.ts
  const db = supabase as any

  // Prima con measurements (054); se la colonna manca, retry senza.
  let { data: sop } = await db
    .from('sopralluoghi')
    .select('id, title, notes, measurements, client_id, document_id')
    .eq('id', sopralluogoId)
    .eq('workspace_id', workspace.id)
    .is('deleted_at', null)
    .maybeSingle()
  if (!sop) {
    ;({ data: sop } = await db
      .from('sopralluoghi')
      .select('id, title, notes, client_id, document_id')
      .eq('id', sopralluogoId)
      .eq('workspace_id', workspace.id)
      .is('deleted_at', null)
      .maybeSingle())
  }
  if (!sop) return { error: 'Sopralluogo non trovato.' }

  // Appunti + misure calcolate → Note interne del preventivo (richiesta Eli
  // 18 lug: il calcolo confermato viaggia col risultato).
  const misureText = misureToNotes(parseMisure(sop.measurements ?? null))
  const internalNotes = [sop.notes, misureText].filter(Boolean).join('\n\n') || null

  // Già trasformato → vai al preventivo esistente (se esiste ANCORA:
  // un preventivo cestinato/purgato non deve lasciare il sopralluogo
  // inchiodato su un link che dà "pagina non trovata")
  if (sop.document_id) {
    const { data: existingDoc } = await supabase
      .from('documents')
      .select('id')
      .eq('id', sop.document_id)
      .is('deleted_at', null)
      .maybeSingle()
    if (existingDoc) redirect(`/preventivi/${sop.document_id}?edit=1&da_sopralluogo=1`)
    // Il preventivo non c'è più: sgancia e prosegui con una nuova creazione
    await db
      .from('sopralluoghi')
      .update({ document_id: null })
      .eq('id', sopralluogoId)
  }

  // Stesso blocco Free della creazione manuale (trial scaduto/quota piena)
  if (workspace.plan === 'free') {
    const { data: wsFull } = await supabase
      .from('workspaces')
      .select('id, plan, free_trial_expires_at, sent_quota_used')
      .eq('id', workspace.id)
      .maybeSingle()
    if (wsFull) {
      const { checkFreeBlock } = await import('@/lib/free-trial')
      if (checkFreeBlock(wsFull).blocked) {
        return { error: 'Piano Free terminato. Passa a Pro per creare nuovi preventivi.' }
      }
    }
  }

  // Numero assegnato subito alla creazione (regola B.3)
  let docNumber: string | null = null
  try { docNumber = await allocateDocNumber(workspace.id) } catch { /* fallback: senza numero */ }

  const { data: doc, error } = await supabase
    .from('documents')
    .insert({
      workspace_id: workspace.id,
      doc_type: 'preventivo',
      status: 'draft',
      doc_number: docNumber,
      client_id: sop.client_id ?? undefined,
      title: sop.title || undefined,
      internal_notes: internalNotes,
      currency: 'EUR',
      exchange_rate: 1.0,
      subtotal: 0,
      tax_amount: 0,
      bollo_amount: 0,
      total: 0,
    })
    .select('id')
    .single()
  if (error || !doc) return { error: 'Creazione preventivo non riuscita.' }

  // Collega le foto del sopralluogo al preventivo (restano rimovibili con ✕).
  // Sul piano Free vale lo stesso tetto del caricamento diretto: max 6 foto
  // per documento (senza questo, il sopralluogo aggirava il limite).
  try {
    if (workspace.plan === 'free') {
      const { data: sopPhotos } = await db
        .from('work_photos')
        .select('id')
        .eq('sopralluogo_id', sopralluogoId)
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: true })
        .limit(FREE_PHOTO_LIMIT)
      const ids = ((sopPhotos ?? []) as Array<{ id: string }>).map((r) => r.id)
      if (ids.length > 0) {
        await db.from('work_photos').update({ document_id: doc.id }).in('id', ids)
      }
    } else {
      await db
        .from('work_photos')
        .update({ document_id: doc.id })
        .eq('sopralluogo_id', sopralluogoId)
        .eq('workspace_id', workspace.id)
    }
  } catch { /* foto non collegate: non bloccare */ }

  // Segna il sopralluogo come trasformato
  await db
    .from('sopralluoghi')
    .update({ document_id: doc.id, updated_at: new Date().toISOString() })
    .eq('id', sopralluogoId)

  revalidatePath('/sopralluoghi')
  revalidatePath('/preventivi')
  redirect(`/preventivi/${doc.id}?edit=1&da_sopralluogo=1`)
}
