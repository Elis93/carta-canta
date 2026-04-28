'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// ── Tipi ──────────────────────────────────────────────────────
type ActionResult = {
  error?: string
  success?: string
  /** ID del cliente appena creato (solo createClientAction) */
  clientId?: string
  /** Campi opzionali con formato non valido — salvati come null */
  warnings?: string[]
} | null

// ── HELPER: workspace dell'utente corrente ─────────────────────
// Supporta sia owner che workspace_members (invitati).
async function getWorkspaceId(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (data?.id) return data.id

  // Fallback: utente membro di un workspace
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .not('accepted_at', 'is', null)
    .limit(1)
    .maybeSingle()
  return membership?.workspace_id ?? null
}

// ── VALIDAZIONE SOFT ───────────────────────────────────────────
// Non blocca il salvataggio: se un campo opzionale ha formato errato
// lo azzera e aggiunge un avviso. Solo `name` è strettamente obbligatorio.

function softValidate(raw: {
  name: string
  email: string
  phone: string
  piva: string
  codice_fiscale: string
  indirizzo: string
  cap: string
  citta: string
  provincia: string
  paese: string
  notes: string
}): { error: string | null; data: typeof raw; warnings: string[] } {
  const warnings: string[] = []
  const out = { ...raw }

  // ── name: unico campo bloccante ──────────────────────────────
  if (!out.name.trim() || out.name.trim().length < 2) {
    return { error: 'Il nome / ragione sociale è obbligatorio (min. 2 caratteri).', data: out, warnings: [] }
  }

  // ── email: formato RFC base ───────────────────────────────────
  if (out.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out.email)) {
    warnings.push('Email non valida — campo non salvato')
    out.email = ''
  }

  // ── P.IVA: 11 cifre ──────────────────────────────────────────
  const cleanPiva = out.piva.replace(/\s/g, '')
  if (cleanPiva && !/^\d{11}$/.test(cleanPiva)) {
    warnings.push('P.IVA non valida (11 cifre, es. 12345678901) — campo non salvato')
    out.piva = ''
  } else {
    out.piva = cleanPiva
  }

  // ── Codice fiscale: 16 caratteri alfanumerici ─────────────────
  const cleanCf = out.codice_fiscale.toUpperCase().replace(/\s/g, '')
  if (cleanCf && !/^[A-Z0-9]{16}$/.test(cleanCf)) {
    warnings.push('Codice fiscale non valido (16 caratteri) — campo non salvato')
    out.codice_fiscale = ''
  } else {
    out.codice_fiscale = cleanCf
  }

  // ── CAP: 5 cifre ─────────────────────────────────────────────
  if (out.cap && !/^\d{5}$/.test(out.cap)) {
    warnings.push('CAP non valido (5 cifre, es. 20100) — campo non salvato')
    out.cap = ''
  }

  // ── Provincia: 2 lettere ──────────────────────────────────────
  const cleanProv = out.provincia.toUpperCase().replace(/\s/g, '')
  if (cleanProv && !/^[A-Z]{2}$/.test(cleanProv)) {
    warnings.push('Sigla provincia non valida (2 lettere, es. MI) — campo non salvato')
    out.provincia = ''
  } else {
    out.provincia = cleanProv
  }

  return { error: null, data: out, warnings }
}

// ── CREATE ─────────────────────────────────────────────────────
export async function createClientAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato.' }

  const workspaceId = await getWorkspaceId()
  if (!workspaceId) return { error: 'Workspace non trovato.' }

  const raw = {
    name:           (formData.get('name')           as string ?? '').trim(),
    email:          (formData.get('email')          as string ?? '').trim(),
    phone:          (formData.get('phone')          as string ?? '').trim(),
    piva:           (formData.get('piva')           as string ?? '').trim(),
    codice_fiscale: (formData.get('codice_fiscale') as string ?? '').trim(),
    indirizzo:      (formData.get('indirizzo')      as string ?? '').trim(),
    cap:            (formData.get('cap')            as string ?? '').trim(),
    citta:          (formData.get('citta')          as string ?? '').trim(),
    provincia:      (formData.get('provincia')      as string ?? '').trim(),
    paese:          (formData.get('paese')          as string ?? 'IT').trim() || 'IT',
    notes:          (formData.get('notes')          as string ?? '').trim(),
  }

  const { error: validationError, data, warnings } = softValidate(raw)
  if (validationError) return { error: validationError }

  const { data: newClient, error } = await supabase
    .from('clients')
    .insert({
      workspace_id:   workspaceId,
      name:           data.name,
      email:          data.email           || null,
      phone:          data.phone           || null,
      piva:           data.piva            || null,
      codice_fiscale: data.codice_fiscale  || null,
      indirizzo:      data.indirizzo       || null,
      cap:            data.cap             || null,
      citta:          data.citta           || null,
      provincia:      data.provincia       || null,
      paese:          data.paese,
      notes:          data.notes           || null,
    })
    .select('id')
    .single()

  if (error) return { error: 'Errore nel salvataggio del cliente. Riprova.' }

  revalidatePath('/(app)/clienti', 'page')

  // Non usiamo redirect() qui: lo gestiamo lato client così possiamo
  // mostrare eventuali avvisi prima di navigare.
  return {
    success:  'created',
    clientId: newClient.id,
    warnings: warnings.length ? warnings : undefined,
  }
}

// ── UPDATE ─────────────────────────────────────────────────────
export async function updateClientAction(
  clientId: string,
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato.' }

  const workspaceId = await getWorkspaceId()
  if (!workspaceId) return { error: 'Workspace non trovato.' }

  const raw = {
    name:           (formData.get('name')           as string ?? '').trim(),
    email:          (formData.get('email')          as string ?? '').trim(),
    phone:          (formData.get('phone')          as string ?? '').trim(),
    piva:           (formData.get('piva')           as string ?? '').trim(),
    codice_fiscale: (formData.get('codice_fiscale') as string ?? '').trim(),
    indirizzo:      (formData.get('indirizzo')      as string ?? '').trim(),
    cap:            (formData.get('cap')            as string ?? '').trim(),
    citta:          (formData.get('citta')          as string ?? '').trim(),
    provincia:      (formData.get('provincia')      as string ?? '').trim(),
    paese:          (formData.get('paese')          as string ?? 'IT').trim() || 'IT',
    notes:          (formData.get('notes')          as string ?? '').trim(),
  }

  const { error: validationError, data, warnings } = softValidate(raw)
  if (validationError) return { error: validationError }

  const { error } = await supabase
    .from('clients')
    .update({
      name:           data.name,
      email:          data.email           || null,
      phone:          data.phone           || null,
      piva:           data.piva            || null,
      codice_fiscale: data.codice_fiscale  || null,
      indirizzo:      data.indirizzo       || null,
      cap:            data.cap             || null,
      citta:          data.citta           || null,
      provincia:      data.provincia       || null,
      paese:          data.paese,
      notes:          data.notes           || null,
    })
    .eq('id', clientId)
    .eq('workspace_id', workspaceId)

  if (error) return { error: 'Errore nel salvataggio. Riprova.' }

  revalidatePath(`/clienti/${clientId}`)
  revalidatePath('/(app)/clienti', 'page')

  return {
    success:  'updated',
    warnings: warnings.length ? warnings : undefined,
  }
}

// ── DELETE ────────────────────────────────────────────────────
export async function deleteClientAction(clientId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato.' }

  const workspaceId = await getWorkspaceId()
  if (!workspaceId) return { error: 'Workspace non trovato.' }

  const { error } = await supabase
    .from('clients')
    .delete()
    .eq('id', clientId)
    .eq('workspace_id', workspaceId)

  if (error) return { error: 'Errore nella rimozione del cliente.' }

  revalidatePath('/(app)/clienti', 'page')
  redirect('/clienti')
}

// ── SEARCH (usata dall'autocomplete) ──────────────────────────
export async function searchClientsAction(query: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const workspaceId = await getWorkspaceId()
  if (!workspaceId) return []

  if (!query.trim()) {
    const { data } = await supabase
      .from('clients')
      .select('id, name, email, phone, piva')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(10)
    return data ?? []
  }

  const { data } = await supabase
    .from('clients')
    .select('id, name, email, phone, piva')
    .eq('workspace_id', workspaceId)
    .textSearch('search_vector', query, { type: 'websearch', config: 'italian' })
    .limit(10)

  return data ?? []
}
