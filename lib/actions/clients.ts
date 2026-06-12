'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// ── Tipi ──────────────────────────────────────────────────────

/** Cliente potenzialmente duplicato restituito prima di procedere alla creazione */
export type PotentialDuplicate = {
  id: string
  name: string
  surname: string | null
  email: string | null
  phone: string | null
  piva: string | null
  codice_fiscale: string | null
}

type ActionResult = {
  error?: string
  success?: string
  /** ID del cliente appena creato (solo createClientAction) */
  clientId?: string
  /** Campi opzionali con formato non valido — salvati come null */
  warnings?: string[]
  /**
   * Cliente già presente nel workspace molto simile a quello che si sta creando.
   * Se restituito, la creazione è sospesa: il client decide se usare quello esistente
   * o forzare la creazione tramite `forceDuplicate=true`.
   */
  potentialDuplicate?: PotentialDuplicate
  /**
   * Campo che ha scatenato il rilevamento del duplicato.
   * Usato dalla UI per mostrare un messaggio specifico (es. "Email già in uso").
   */
  duplicateField?: 'email' | 'phone' | 'piva' | 'codice_fiscale' | 'name'
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
  surname: string
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
  if (!out.name.trim()) {
    return { error: 'Il nome / ragione sociale è obbligatorio.', data: out, warnings: [] }
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
    surname:        (formData.get('surname')        as string ?? '').trim(),
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

  // Email o telefono obbligatori — il cliente deve avere almeno un recapito
  if (!raw.email && !raw.phone) {
    return { error: 'Inserisci almeno un contatto: email o telefono.' }
  }

  const { error: validationError, data, warnings } = softValidate(raw)
  if (validationError) return { error: validationError }

  // ── Rilevamento duplicati ──────────────────────────────────────
  // Salta il check se l'utente ha già confermato di voler creare comunque.
  const forceDuplicate = formData.get('forceDuplicate') === 'true'
  if (!forceDuplicate) {
    let dup: PotentialDuplicate | null = null
    let duplicateField: NonNullable<ActionResult>['duplicateField'] = undefined

    // 1. Email — identificatore più forte (e più visibile all'utente)
    if (!dup && data.email) {
      const { data: found } = await supabase
        .from('clients')
        .select('id, name, surname, email, phone, piva, codice_fiscale')
        .eq('workspace_id', workspaceId)
        .eq('email', data.email)
        .limit(1)
        .maybeSingle()
      if (found) { dup = found; duplicateField = 'email' }
    }

    // 2. Telefono
    if (!dup && data.phone) {
      const { data: found } = await supabase
        .from('clients')
        .select('id, name, surname, email, phone, piva, codice_fiscale')
        .eq('workspace_id', workspaceId)
        .eq('phone', data.phone)
        .limit(1)
        .maybeSingle()
      if (found) { dup = found; duplicateField = 'phone' }
    }

    // 3. P.IVA o Codice Fiscale
    if (!dup && (data.piva || data.codice_fiscale)) {
      const fiscalParts: string[] = []
      if (data.piva)           fiscalParts.push(`piva.eq.${data.piva}`)
      if (data.codice_fiscale) fiscalParts.push(`codice_fiscale.eq.${data.codice_fiscale}`)
      const { data: found } = await supabase
        .from('clients')
        .select('id, name, surname, email, phone, piva, codice_fiscale')
        .eq('workspace_id', workspaceId)
        .or(fiscalParts.join(','))
        .limit(1)
        .maybeSingle()
      if (found) { dup = found; duplicateField = data.piva ? 'piva' : 'codice_fiscale' }
    }

    // 4. Fallback: stesso nome (case-insensitive) + stesso cognome
    if (!dup) {
      const { data: found } = await supabase
        .from('clients')
        .select('id, name, surname, email, phone, piva, codice_fiscale')
        .eq('workspace_id', workspaceId)
        .ilike('name', data.name)
        .limit(10)
      if (found && found.length > 0) {
        const nameMatch = found.find(c => {
          const noSurname = !data.surname && !c.surname
          const sameSurname =
            data.surname &&
            c.surname &&
            c.surname.toLowerCase().trim() === data.surname.toLowerCase().trim()
          return noSurname || sameSurname
        }) ?? null
        if (nameMatch) { dup = nameMatch; duplicateField = 'name' }
      }
    }

    if (dup) return { potentialDuplicate: dup, duplicateField }
  }
  // ─────────────────────────────────────────────────────────────

  const { data: newClient, error } = await supabase
    .from('clients')
    .insert({
      workspace_id:   workspaceId,
      name:           data.name,
      surname:        data.surname         || null,
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
    surname:        (formData.get('surname')        as string ?? '').trim(),
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
      surname:        data.surname         || null,
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

// ── PRELOAD (carica tutti i clienti una volta per il filtro in-memory) ────────
// Usata da SendEmailDialog: carica fino a 200 clienti all'apertura del dialog
// per poi filtrare client-side senza ulteriori round-trip al server.
export async function preloadClientsAction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const workspaceId = await getWorkspaceId()
  if (!workspaceId) return []

  const { data } = await supabase
    .from('clients')
    .select('id, name, surname, email, phone, piva')
    .eq('workspace_id', workspaceId)
    .order('name', { ascending: true })
    .limit(200)

  return data ?? []
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
      .select('id, name, surname, email, phone, piva')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(10)
    return data ?? []
  }

  // FIX-17: textSearch (full-text) matcha solo PAROLE INTERE — digitando "Ma"
  // non trovava "Mario". Sostituito con ricerca "contiene" su più campi,
  // funziona già dalla prima lettera.
  const escaped = query.trim().replace(/[%,]/g, '\\$&')
  const pattern = `%${escaped}%`
  const { data } = await supabase
    .from('clients')
    .select('id, name, surname, email, phone, piva')
    .eq('workspace_id', workspaceId)
    .or(`name.ilike.${pattern},surname.ilike.${pattern},email.ilike.${pattern},piva.ilike.${pattern}`)
    .limit(10)

  return data ?? []
}
