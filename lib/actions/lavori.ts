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
import { isMissingColumnError } from '@/lib/supabase/errors'

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
// Il MIGRATION_HINT è fuorviante per errori reali (RLS, rete): usalo solo
// quando l'errore è davvero "colonna/tabella mancante".
function saveErrorMessage(e: { code?: string; message?: string } | null | undefined): string {
  return isMissingColumnError(e) || e?.code === '42P01' ? MIGRATION_HINT : 'Salvataggio non riuscito. Riprova tra qualche istante.'
}

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
    // Prima con scheduled_at (049); se la COLONNA manca (e solo allora), senza —
    // un retry su qualsiasi errore maschererebbe errori reali (RLS, constraint).
    let { error } = await db
      .from('lavori')
      .update({ ...fields, scheduled_at: scheduledAt, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('workspace_id', workspace.id)
    if (error && isMissingColumnError(error)) {
      ;({ error } = await db
        .from('lavori')
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('workspace_id', workspace.id))
    }
    if (error) return { error: saveErrorMessage(error) }
    revalidatePath('/lavori')
    revalidatePath(`/lavori/${id}`)
    return { success: 'Lavoro salvato', id }
  }

  let { data: created, error } = await db
    .from('lavori')
    .insert({ workspace_id: workspace.id, ...fields, scheduled_at: scheduledAt })
    .select('id')
    .single()
  if ((error || !created) && isMissingColumnError(error)) {
    ;({ data: created, error } = await db
      .from('lavori')
      .insert({ workspace_id: workspace.id, ...fields })
      .select('id')
      .single())
  }
  if (error || !created) return { error: saveErrorMessage(error) }
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

  // «Fatturato» non è un'etichetta libera (scelta Eli 3 ago, opzione A):
  // senza una fattura VERA collegata non se ne terrebbe traccia da nessuna
  // parte — lo stato si applica solo quando la fattura esiste davvero.
  if (status === 'fatturato') {
    const { data: lav, error: lavErr } = await db
      .from('lavori')
      .select('document_id')
      .eq('id', id)
      .eq('workspace_id', workspace.id)
      .is('deleted_at', null)
      .maybeSingle()
    if (lavErr || !lav) return { error: 'Lavoro non trovato. Ricarica la pagina.' }
    if (!lav.document_id) {
      return { error: 'Per segnare «Fatturato» serve una fattura collegata. Questo lavoro non è collegato a nessun documento: crea il preventivo, convertilo in fattura e riprova.' }
    }
    // Basta che ESISTA la fattura: o il documento collegato è già una
    // fattura (non nel cestino), o dal preventivo collegato ne è nata una
    // (origin_document_id).
    const [linkedRes, fattRes] = await Promise.all([
      supabase
        .from('documents')
        .select('doc_type')
        .eq('id', lav.document_id)
        .is('deleted_at', null)
        .maybeSingle(),
      supabase
        .from('documents')
        .select('id')
        .eq('origin_document_id', lav.document_id)
        .eq('doc_type', 'fattura')
        .is('deleted_at', null)
        .limit(1)
        .maybeSingle(),
    ])
    // Un errore di lettura NON è "fattura assente": dirlo sarebbe una bugia
    // (l'artigiano con la fattura regolare leggerebbe "prima la fattura").
    if (linkedRes.error || fattRes.error) {
      return { error: 'Non riesco a verificare la fattura collegata in questo momento. Riprova tra qualche istante.' }
    }
    // Documento collegato sparito o nel cestino: dire "apri il preventivo
    // in cima alla pagina" sarebbe un'istruzione ineseguibile (review 3 ago).
    if (!linkedRes.data && !fattRes.data) {
      return { error: 'Il documento collegato a questo lavoro non esiste più o è nel cestino. Ripristinalo dal Cestino, oppure crea la fattura e riprova.' }
    }
    if (linkedRes.data?.doc_type !== 'fattura' && !fattRes.data) {
      return { error: 'Prima la fattura: apri il preventivo collegato in cima alla pagina e usa «Converti in fattura». Appena la fattura esiste, torna qui e segna Fatturato.' }
    }
  }

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
  if (error) return { error: saveErrorMessage(error) }

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

// ── Rapportino di fine lavoro (colonne report_* — migration 049) ───────────
// Genera (una sola volta) il token del link pubblico e salva il testo.
// La firma del cliente avviene su /r/[token] (stessa logica FES dei preventivi).
export async function saveRapportoAction(formData: FormData): Promise<{ error?: string; url?: string } | null> {
  const workspace = await getWorkspace()
  if (!workspace) return { error: 'Sessione scaduta. Ricarica la pagina.' }

  const id = String(formData.get('id') ?? '').trim()
  const text = String(formData.get('report_text') ?? '').trim().slice(0, 4000)
  if (!id) return { error: 'Lavoro non trovato' }
  if (!text) return { error: 'Scrivi cosa è stato fatto (anche due righe).' }

  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 049 non ancora in types/database.ts
  const db = supabase as any

  const { data: lav, error: loadErr } = await db
    .from('lavori')
    .select('id, report_token, report_signed_at')
    .eq('id', id)
    .eq('workspace_id', workspace.id)
    .is('deleted_at', null)
    .maybeSingle()
  if (loadErr) return { error: 'La migration 049 potrebbe non essere ancora applicata.' }
  if (!lav) return { error: 'Lavoro non trovato' }
  if (lav.report_signed_at) return { error: 'Il rapportino è già stato firmato: non si può più modificare.' }

  const token = lav.report_token ?? crypto.randomUUID()
  // .is('report_signed_at', null): il check sopra non è atomico — se il
  // cliente firma tra la lettura e l'update, il testo FIRMATO (valore
  // probatorio) non deve essere sovrascritto.
  const { data: updated, error } = await db
    .from('lavori')
    .update({ report_token: token, report_text: text, report_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('workspace_id', workspace.id)
    .is('report_signed_at', null)
    .select('id')
  if (error) return { error: 'Salvataggio non riuscito.' }
  if (!updated || updated.length === 0) {
    return { error: 'Il rapportino è appena stato firmato dal cliente: non si può più modificare.' }
  }

  // «Mostra le ore al cliente» (086) — update SEPARATO e tollerante: le ore
  // sono un dato interno, di default nascoste al cliente; senza la migration il
  // salvataggio del rapportino non deve fallire. Guardia sul non-firmato come sopra.
  const showLabor = formData.get('show_labor_to_client') === 'on'
  const { error: laborErr } = await db
    .from('lavori')
    .update({ show_labor_to_client: showLabor })
    .eq('id', id)
    .eq('workspace_id', workspace.id)
    .is('report_signed_at', null)
  if (laborErr && !isMissingColumnError(laborErr)) return { error: 'Salvataggio non riuscito.' }

  revalidatePath(`/lavori/${id}`)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://cartacanta.app'
  return { url: `${appUrl}/r/${token}` }
}

// ── Promemoria manutenzione ("richiama il cliente") — migration 052 ─────────
// Un solo richiamo per lavoro: data (+ nota facoltativa). La campanella
// mostra la notifica quando la data è arrivata (lib/notifications.ts).
export async function setRecallAction(
  id: string,
  dateStr: string | null, // 'YYYY-MM-DD' o null per rimuovere
  note?: string
): Promise<ActionResult> {
  const workspace = await getWorkspace()
  if (!workspace) return { error: 'Sessione scaduta. Ricarica la pagina.' }

  let recallAt: string | null = null
  if (dateStr) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return { error: 'Data non valida.' }
    // Ore 08:00 italiane del giorno scelto (il promemoria "scatta" al mattino)
    recallAt = romeIso(`${dateStr}T08:00`)
    if (!recallAt) return { error: 'Data non valida.' }
  }

  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 052 non ancora in types/database.ts
  const { data: updated, error } = await (supabase as any)
    .from('lavori')
    .update({
      recall_at: recallAt,
      recall_note: dateStr ? (note ?? '').trim().slice(0, 300) || null : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('workspace_id', workspace.id)
    .is('deleted_at', null)
    .select('id')
  if (error) {
    return {
      error: isMissingColumnError(error)
        ? 'Promemoria non disponibile: la migration 052 non è ancora applicata.'
        : 'Salvataggio non riuscito. Riprova tra qualche istante.',
    }
  }
  // Nessuna riga aggiornata → il lavoro non c'è più (eliminato altrove): non
  // dichiarare "impostato" un salvataggio che non ha toccato nulla.
  if (!updated || updated.length === 0) {
    return { error: 'Lavoro non trovato: potrebbe essere stato eliminato. Ricarica la pagina.' }
  }

  revalidatePath(`/lavori/${id}`)
  revalidatePath('/lavori')
  return { success: dateStr ? 'Promemoria impostato' : 'Promemoria rimosso' }
}

// ── Ore di lavoro (timer + inserimento manuale) — migration 052 ─────────────
// labor_minutes = totale cumulato; timer_started_at = timer in corso.
export async function startTimerAction(id: string): Promise<ActionResult> {
  const workspace = await getWorkspace()
  if (!workspace) return { error: 'Sessione scaduta. Ricarica la pagina.' }

  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 052 non ancora in types/database.ts
  const { data, error } = await (supabase as any)
    .from('lavori')
    .update({ timer_started_at: new Date().toISOString() })
    .eq('id', id)
    .eq('workspace_id', workspace.id)
    .is('deleted_at', null)
    .is('timer_started_at', null) // anti doppio start (due tab aperte)
    .is('report_signed_at', null) // ore congelate dopo la firma del rapportino (audit 24 lug)
    .select('id')
  if (error) {
    return {
      error: isMissingColumnError(error)
        ? 'Timer non disponibile: la migration 052 non è ancora applicata.'
        : 'Avvio non riuscito. Riprova.',
    }
  }
  if (!data || data.length === 0) return { error: 'Timer non avviabile: è già in corso o il rapportino è già firmato.' }
  revalidatePath(`/lavori/${id}`)
  return { success: 'Timer avviato' }
}

export async function stopTimerAction(id: string): Promise<ActionResult> {
  const workspace = await getWorkspace()
  if (!workspace) return { error: 'Sessione scaduta. Ricarica la pagina.' }

  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 052 non ancora in types/database.ts
  const db = supabase as any
  const { data: lav, error: loadErr } = await db
    .from('lavori')
    .select('timer_started_at, labor_minutes, report_signed_at')
    .eq('id', id)
    .eq('workspace_id', workspace.id)
    .is('deleted_at', null)
    .maybeSingle()
  if (loadErr || !lav) return { error: 'Lavoro non trovato.' }
  if (lav.report_signed_at) return { error: 'Il rapportino è firmato: le ore non si possono più modificare.' }
  if (!lav.timer_started_at) return { error: 'Nessun timer in corso.' }

  // Minimo 1 minuto: uno start/stop immediato non deve "sparire"
  const elapsedMin = Math.max(1, Math.round((Date.now() - new Date(lav.timer_started_at).getTime()) / 60000))
  const { error } = await db
    .from('lavori')
    .update({
      labor_minutes: Number(lav.labor_minutes ?? 0) + elapsedMin,
      timer_started_at: null,
    })
    .eq('id', id)
    .eq('workspace_id', workspace.id)
    .not('timer_started_at', 'is', null) // anti doppio stop
  if (error) return { error: 'Salvataggio non riuscito. Riprova.' }

  revalidatePath(`/lavori/${id}`)
  return { success: 'Timer fermato' }
}

/** Aggiunta manuale di ore (può essere negativa per correggere, mai sotto zero). */
export async function addLaborMinutesAction(id: string, minutes: number): Promise<ActionResult> {
  if (!Number.isFinite(minutes) || minutes === 0 || Math.abs(minutes) > 24 * 60 * 30) {
    return { error: 'Inserisci un numero di ore valido.' }
  }
  const workspace = await getWorkspace()
  if (!workspace) return { error: 'Sessione scaduta. Ricarica la pagina.' }

  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 052 non ancora in types/database.ts
  const db = supabase as any
  const { data: lav, error: loadErr } = await db
    .from('lavori')
    .select('labor_minutes, timer_started_at, report_signed_at')
    .eq('id', id)
    .eq('workspace_id', workspace.id)
    .is('deleted_at', null)
    .maybeSingle()
  if (loadErr) {
    return {
      error: isMissingColumnError(loadErr)
        ? 'Ore di lavoro non disponibili: la migration 052 non è ancora applicata.'
        : 'Salvataggio non riuscito. Riprova.',
    }
  }
  if (!lav) return { error: 'Lavoro non trovato.' }
  if (lav.report_signed_at) return { error: 'Il rapportino è firmato: le ore non si possono più modificare.' }

  // Con un timer in corso i minuti mostrati (persistiti + timer) non coincidono
  // con quelli persistiti: una correzione manuale (specie negativa) verrebbe
  // clampata sul solo valore persistito, togliendo meno del previsto ma dicendo
  // "aggiornato". Meglio chiedere di fermare prima il timer.
  if (lav.timer_started_at) {
    return { error: 'Ferma il timer prima di correggere le ore a mano.' }
  }

  const next = Math.max(0, Number(lav.labor_minutes ?? 0) + Math.round(minutes))
  const { error } = await db
    .from('lavori')
    .update({ labor_minutes: next })
    .eq('id', id)
    .eq('workspace_id', workspace.id)
  if (error) return { error: 'Salvataggio non riuscito. Riprova.' }

  revalidatePath(`/lavori/${id}`)
  return { success: 'Ore aggiornate' }
}

// Imposta il TOTALE delle ore (valore assoluto), non un delta: usato dal
// "correggi il totale a mano". Stesse protezioni di addLaborMinutesAction.
export async function setLaborMinutesAction(id: string, totalMinutes: number): Promise<ActionResult> {
  if (!Number.isFinite(totalMinutes) || totalMinutes < 0 || totalMinutes > 24 * 60 * 30) {
    return { error: 'Inserisci un totale di ore valido.' }
  }
  const workspace = await getWorkspace()
  if (!workspace) return { error: 'Sessione scaduta. Ricarica la pagina.' }

  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 052 non ancora in types/database.ts
  const db = supabase as any
  const { data: lav, error: loadErr } = await db
    .from('lavori')
    .select('timer_started_at, report_signed_at')
    .eq('id', id)
    .eq('workspace_id', workspace.id)
    .is('deleted_at', null)
    .maybeSingle()
  if (loadErr) {
    return {
      error: isMissingColumnError(loadErr)
        ? 'Ore di lavoro non disponibili: la migration 052 non è ancora applicata.'
        : 'Salvataggio non riuscito. Riprova.',
    }
  }
  if (!lav) return { error: 'Lavoro non trovato.' }
  // Ore congelate dopo la firma del rapportino — come addLaborMinutes/stopTimer
  // (review 25 lug A1: questa azione era l'unica senza la guardia).
  if (lav.report_signed_at) {
    return { error: 'Il rapportino è firmato: le ore non si possono più modificare.' }
  }
  // Col timer in corso il totale mostrato include i minuti che scorrono:
  // sovrascrivere il valore persistito sballerebbe il conto → chiedi di fermarlo.
  if (lav.timer_started_at) {
    return { error: 'Ferma il timer prima di correggere le ore a mano.' }
  }

  const next = Math.max(0, Math.round(totalMinutes))
  const { error } = await db
    .from('lavori')
    .update({ labor_minutes: next })
    .eq('id', id)
    .eq('workspace_id', workspace.id)
  if (error) return { error: 'Salvataggio non riuscito. Riprova.' }

  revalidatePath(`/lavori/${id}`)
  return { success: 'Totale ore aggiornato' }
}
