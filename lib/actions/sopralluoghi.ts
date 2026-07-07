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
import { allocateDocNumber } from '@/lib/actions/documents'

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

  // Photo-first: in cantiere spesso si parte dalle foto, senza scrivere
  // nulla. Un sopralluogo vuoto si salva comunque con un titolo di default
  // datato — si completa dopo, con calma.
  const fallbackTitle = `Sopralluogo ${new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}`

  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabella 041 non ancora in types/database.ts
  const db = supabase as any

  const baseFields = {
    title: title || fallbackTitle,
    address: address || null,
    notes: notes || null,
    client_id: clientId,
  }

  if (id) {
    // Prima con scheduled_at (047); se la colonna non esiste ancora, senza.
    let { error } = await db
      .from('sopralluoghi')
      .update({ ...baseFields, scheduled_at: scheduledAt, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('workspace_id', workspace.id)
    if (error) {
      ;({ error } = await db
        .from('sopralluoghi')
        .update({ ...baseFields, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('workspace_id', workspace.id))
    }
    if (error) return { error: 'Salvataggio non riuscito. La migration 041 potrebbe non essere ancora applicata.' }
    revalidatePath('/sopralluoghi')
    return { success: 'Sopralluogo salvato', id }
  }

  let { data: created, error } = await db
    .from('sopralluoghi')
    .insert({ workspace_id: workspace.id, ...baseFields, scheduled_at: scheduledAt })
    .select('id')
    .single()
  if (error || !created) {
    ;({ data: created, error } = await db
      .from('sopralluoghi')
      .insert({ workspace_id: workspace.id, ...baseFields })
      .select('id')
      .single())
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
  return { success: 'Sopralluogo eliminato' }
}

/** Registra una foto caricata nel bucket work-photos (dal client). */
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
  const { error } = await (supabase as any)
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
    .select('id, storage_path')
    .eq('id', photoId)
    .eq('workspace_id', workspace.id)
    .maybeSingle()
  if (!photo) return { error: 'Foto non trovata.' }

  const { error } = await db.from('work_photos').delete().eq('id', photoId)
  if (error) return { error: 'Eliminazione non riuscita.' }

  // Best effort: rimuovi anche il file dal bucket
  try { await supabase.storage.from('work-photos').remove([photo.storage_path]) } catch { /* ignora */ }
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

  const { data: sop } = await db
    .from('sopralluoghi')
    .select('id, title, notes, client_id, document_id')
    .eq('id', sopralluogoId)
    .eq('workspace_id', workspace.id)
    .is('deleted_at', null)
    .maybeSingle()
  if (!sop) return { error: 'Sopralluogo non trovato.' }

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
      internal_notes: sop.notes || null,
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
