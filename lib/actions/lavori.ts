'use server'

// ============================================================
// Server Actions — Lavori (commesse, migration 048)
// Decisione Eli 7 lug 2026 (opzione A): sezione dedicata.
// Dal preventivo ACCETTATO si apre un Lavoro con stati
// da_iniziare → in_corso → finito → fatturato; note e foto
// (le foto vivono sul preventivo di origine, via work_photos).
// ============================================================

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type ActionResult = { error?: string; success?: string; id?: string } | null

export type LavoroStatus = 'da_iniziare' | 'in_corso' | 'finito' | 'fatturato'
const STATUSES: LavoroStatus[] = ['da_iniziare', 'in_corso', 'finito', 'fatturato']

async function getWorkspace(): Promise<{ id: string } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('workspaces')
    .select('id')
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
    .select('id')
    .eq('id', membership.workspace_id)
    .maybeSingle()
  return mw
}

const MIGRATION_HINT = 'Salvataggio non riuscito. La migration 048 potrebbe non essere ancora applicata.'

// Converte "YYYY-MM-DDTHH:MM" (datetime-local, ora italiana) in ISO con
// offset di Roma (il server è UTC) — stesso helper dei sopralluoghi.
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

// ── Crea/aggiorna lavoro (form) ─────────────────────────────────────────────
export async function saveLavoroAction(formData: FormData): Promise<ActionResult> {
  const workspace = await getWorkspace()
  if (!workspace) return { error: 'Sessione scaduta. Ricarica la pagina.' }

  const id = String(formData.get('id') ?? '').trim() || null
  const title = String(formData.get('title') ?? '').trim().slice(0, 120)
  const address = String(formData.get('address') ?? '').trim().slice(0, 200)
  const notes = String(formData.get('notes') ?? '').trim().slice(0, 8000)
  const clientId = String(formData.get('client_id') ?? '').trim() || null
  const scheduledRaw = String(formData.get('scheduled_at') ?? '').trim()
  const scheduledAt = scheduledRaw ? romeIso(scheduledRaw) : null

  if (!title) return { error: 'Dai un titolo al lavoro (es. Bagno piano primo).' }

  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabella 048 non ancora in types/database.ts
  const db = supabase as any

  const fields = { title, address: address || null, notes: notes || null, client_id: clientId }

  if (id) {
    // Prima con scheduled_at (049); se la colonna manca, senza.
    let { error } = await db
      .from('lavori')
      .update({ ...fields, scheduled_at: scheduledAt, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('workspace_id', workspace.id)
    if (error) {
      ;({ error } = await db
        .from('lavori')
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('workspace_id', workspace.id))
    }
    if (error) return { error: MIGRATION_HINT }
    revalidatePath('/lavori')
    revalidatePath(`/lavori/${id}`)
    return { success: 'Lavoro salvato', id }
  }

  let { data: created, error } = await db
    .from('lavori')
    .insert({ workspace_id: workspace.id, ...fields, scheduled_at: scheduledAt })
    .select('id')
    .single()
  if (error || !created) {
    ;({ data: created, error } = await db
      .from('lavori')
      .insert({ workspace_id: workspace.id, ...fields })
      .select('id')
      .single())
  }
  if (error || !created) return { error: MIGRATION_HINT }
  revalidatePath('/lavori')
  return { success: 'Lavoro creato', id: created.id }
}

// ── Cambio stato (con timestamp di inizio/fine) ─────────────────────────────
export async function setLavoroStatusAction(id: string, status: LavoroStatus): Promise<ActionResult> {
  if (!STATUSES.includes(status)) return { error: 'Stato non valido' }
  const workspace = await getWorkspace()
  if (!workspace) return { error: 'Sessione scaduta. Ricarica la pagina.' }

  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabella 048 non ancora in types/database.ts
  const db = supabase as any

  const nowIso = new Date().toISOString()
  const patch: Record<string, unknown> = { status, updated_at: nowIso }
  if (status === 'in_corso') patch.started_at = nowIso
  if (status === 'finito') patch.finished_at = nowIso

  const { error } = await db
    .from('lavori')
    .update(patch)
    .eq('id', id)
    .eq('workspace_id', workspace.id)
    .is('deleted_at', null)
  if (error) return { error: MIGRATION_HINT }

  revalidatePath('/lavori')
  revalidatePath(`/lavori/${id}`)
  return { success: 'Stato aggiornato' }
}

// ── Soft delete ─────────────────────────────────────────────────────────────
export async function deleteLavoroAction(id: string): Promise<ActionResult> {
  const workspace = await getWorkspace()
  if (!workspace) return { error: 'Sessione scaduta.' }

  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabella 048 non ancora in types/database.ts
  const { error } = await (supabase as any)
    .from('lavori')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('workspace_id', workspace.id)
  if (error) return { error: 'Eliminazione non riuscita.' }
  revalidatePath('/lavori')
  redirect('/lavori')
}

// ── "Apri lavoro" dal preventivo accettato (idempotente) ────────────────────
export async function createLavoroFromPreventivoAction(documentId: string): Promise<ActionResult> {
  const workspace = await getWorkspace()
  if (!workspace) return { error: 'Sessione scaduta. Ricarica la pagina.' }

  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabella 048 non ancora in types/database.ts
  const db = supabase as any

  // Se esiste già un lavoro per questo preventivo → vai lì (idempotente)
  try {
    const { data: existing } = await db
      .from('lavori')
      .select('id')
      .eq('document_id', documentId)
      .eq('workspace_id', workspace.id)
      .is('deleted_at', null)
      .maybeSingle()
    if (existing?.id) redirect(`/lavori/${existing.id}`)
  } catch (e) {
    // redirect() lancia NEXT_REDIRECT: NON inghiottirlo
    if (e && typeof e === 'object' && 'digest' in e) throw e
    return { error: MIGRATION_HINT }
  }

  const { data: doc } = await supabase
    .from('documents')
    .select('id, title, doc_number, status, client_id')
    .eq('id', documentId)
    .eq('workspace_id', workspace.id)
    .is('deleted_at', null)
    .maybeSingle()
  if (!doc) return { error: 'Preventivo non trovato' }
  if (doc.status !== 'accepted') return { error: 'Puoi aprire un lavoro solo da un preventivo accettato.' }

  const title = (doc.title?.trim() || `Lavoro ${doc.doc_number ?? ''}`.trim()).slice(0, 120)

  const { data: created, error } = await db
    .from('lavori')
    .insert({
      workspace_id: workspace.id,
      client_id: doc.client_id,
      document_id: doc.id,
      title,
    })
    .select('id')
    .single()

  if (error || !created) {
    // Corsa sull'indice univoco: qualcun altro l'ha appena creato → riusa
    const { data: again } = await db
      .from('lavori')
      .select('id')
      .eq('document_id', documentId)
      .eq('workspace_id', workspace.id)
      .is('deleted_at', null)
      .maybeSingle()
    if (again?.id) redirect(`/lavori/${again.id}`)
    return { error: MIGRATION_HINT }
  }

  revalidatePath('/lavori')
  redirect(`/lavori/${created.id}`)
}
