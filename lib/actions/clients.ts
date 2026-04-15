'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod/v4'

// ── SCHEMA ────────────────────────────────────────────────────
const ClientSchema = z.object({
  name: z.string().min(2, 'Il nome deve essere di almeno 2 caratteri'),
  email: z.email('Email non valida').optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  piva: z
    .string()
    .regex(/^\d{11}$/, 'P.IVA: 11 cifre senza prefisso IT')
    .optional()
    .or(z.literal('')),
  codice_fiscale: z
    .string()
    .regex(/^[A-Z0-9]{16}$/, 'Codice fiscale non valido')
    .optional()
    .or(z.literal('')),
  indirizzo: z.string().optional().or(z.literal('')),
  cap: z
    .string()
    .regex(/^\d{5}$/, 'CAP: 5 cifre')
    .optional()
    .or(z.literal('')),
  citta: z.string().optional().or(z.literal('')),
  provincia: z
    .string()
    .length(2, 'Sigla provincia: 2 lettere')
    .toUpperCase()
    .optional()
    .or(z.literal('')),
  paese: z.string().length(2).default('IT'),
  notes: z.string().optional().or(z.literal('')),
})

type ActionResult = { error?: string; success?: string } | null

// ── HELPER: workspace dell'utente corrente ─────────────────────
async function getWorkspaceId(): Promise<string | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()
  return data?.id ?? null
}

// ── CREATE ─────────────────────────────────────────────────────
export async function createClientAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato.' }

  const workspaceId = await getWorkspaceId()
  if (!workspaceId) return { error: 'Workspace non trovato.' }

  const raw = {
    name: formData.get('name') as string,
    email: (formData.get('email') as string) || '',
    phone: (formData.get('phone') as string) || '',
    piva: (formData.get('piva') as string) || '',
    codice_fiscale: ((formData.get('codice_fiscale') as string) || '').toUpperCase(),
    indirizzo: (formData.get('indirizzo') as string) || '',
    cap: (formData.get('cap') as string) || '',
    citta: (formData.get('citta') as string) || '',
    provincia: (formData.get('provincia') as string) || '',
    paese: (formData.get('paese') as string) || 'IT',
    notes: (formData.get('notes') as string) || '',
  }

  const parsed = ClientSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dati non validi.' }
  }

  const { data: newClient, error } = await supabase
    .from('clients')
    .insert({
      workspace_id: workspaceId,
      name: parsed.data.name,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      piva: parsed.data.piva || null,
      codice_fiscale: parsed.data.codice_fiscale || null,
      indirizzo: parsed.data.indirizzo || null,
      cap: parsed.data.cap || null,
      citta: parsed.data.citta || null,
      provincia: parsed.data.provincia || null,
      paese: parsed.data.paese,
      notes: parsed.data.notes || null,
    })
    .select('id')
    .single()

  if (error) return { error: 'Errore nel salvataggio del cliente. Riprova.' }

  revalidatePath('/(app)/clienti', 'page')
  redirect(`/clienti/${newClient.id}`)
}

// ── UPDATE ─────────────────────────────────────────────────────
export async function updateClientAction(
  clientId: string,
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato.' }

  const workspaceId = await getWorkspaceId()
  if (!workspaceId) return { error: 'Workspace non trovato.' }

  const raw = {
    name: formData.get('name') as string,
    email: (formData.get('email') as string) || '',
    phone: (formData.get('phone') as string) || '',
    piva: (formData.get('piva') as string) || '',
    codice_fiscale: ((formData.get('codice_fiscale') as string) || '').toUpperCase(),
    indirizzo: (formData.get('indirizzo') as string) || '',
    cap: (formData.get('cap') as string) || '',
    citta: (formData.get('citta') as string) || '',
    provincia: (formData.get('provincia') as string) || '',
    paese: (formData.get('paese') as string) || 'IT',
    notes: (formData.get('notes') as string) || '',
  }

  const parsed = ClientSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dati non validi.' }
  }

  const { error } = await supabase
    .from('clients')
    .update({
      name: parsed.data.name,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      piva: parsed.data.piva || null,
      codice_fiscale: parsed.data.codice_fiscale || null,
      indirizzo: parsed.data.indirizzo || null,
      cap: parsed.data.cap || null,
      citta: parsed.data.citta || null,
      provincia: parsed.data.provincia || null,
      paese: parsed.data.paese,
      notes: parsed.data.notes || null,
    })
    .eq('id', clientId)
    .eq('workspace_id', workspaceId)

  if (error) return { error: 'Errore nel salvataggio. Riprova.' }

  revalidatePath(`/clienti/${clientId}`)
  revalidatePath('/(app)/clienti', 'page')
  return { success: 'Cliente aggiornato.' }
}

// ── DELETE (soft delete via archivio — semplicemente rimuoviamo) ──
export async function deleteClientAction(clientId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato.' }

  const workspaceId = await getWorkspaceId()
  if (!workspaceId) return { error: 'Workspace non trovato.' }

  // I documenti restano (client_id → SET NULL per RLS, o lasciamo il riferimento)
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
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const workspaceId = await getWorkspaceId()
  if (!workspaceId) return []

  if (!query.trim()) {
    // Ultimi 10 clienti senza filtro
    const { data } = await supabase
      .from('clients')
      .select('id, name, email, phone, piva')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(10)
    return data ?? []
  }

  // Full-text search via tsvector
  const { data } = await supabase
    .from('clients')
    .select('id, name, email, phone, piva')
    .eq('workspace_id', workspaceId)
    .textSearch('search_vector', query, { type: 'websearch', config: 'italian' })
    .limit(10)

  return data ?? []
}
