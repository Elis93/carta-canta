'use server'

import { z } from 'zod/v4'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { calcolaDocumento } from '@/lib/fiscal/calcoli'
import type { FiscalOptions } from '@/types/index'
import type { Database } from '@/types/database'

type DocumentItemInsert = Database['public']['Tables']['document_items']['Insert']

// ── Formato numero documento: NNN/YYYY — es. 001/2026 ────────────────────────
// Accetta da 1 a 6 cifre (futuro-proof), slash, 4 cifre anno.
const DOC_NUMBER_RE = /^\d{1,6}\/\d{4}$/

// ── Zod Schemas ────────────────────────────────────────────────────────────

const VoceSchema = z.object({
  id: z.string().optional(),
  sort_order: z.number().int(),
  description: z.string().min(1, 'Descrizione obbligatoria'),
  unit: z.string().default('pz'),
  quantity: z.number({ error: 'Quantità non valida' }).positive(),
  unit_price: z.number({ error: 'Prezzo non valido' }).nonnegative(),
  discount_pct: z.number().min(0).max(100).nullable().optional(),
  vat_rate: z.number().nonnegative().nullable().optional(),
})

const DocumentFormSchema = z.object({
  // Titolo opzionale — il numero progressivo è ora l'identificatore principale
  title: z.string().optional().or(z.literal('')),
  // Numero documento: accetta override manuale nel formato NNN/YYYY oppure stringa vuota
  doc_number: z
    .string()
    .regex(DOC_NUMBER_RE, 'Formato non valido (es. 001/2026)')
    .optional()
    .or(z.literal('')),
  // Hidden input invia sempre "" quando non selezionato → .or(z.literal(''))
  // evita il default Zod "Too small: expected string to have >=1 characters"
  client_id: z.string().min(1).optional().or(z.literal('')),
  template_id: z.string().min(1).optional().or(z.literal('')),
  notes: z.string().nullable().optional(),
  internal_notes: z.string().nullable().optional(),
  validity_days: z.coerce.number().int().positive().default(30),
  payment_terms: z.string().default('30 giorni'),
  vat_rate_default: z.coerce.number().nonnegative().nullable().optional(),
  discount_pct: z.coerce.number().min(0).max(100).nullable().optional(),
  discount_fixed: z.coerce.number().nonnegative().nullable().optional(),
  items_json: z.string().min(2), // JSON array
})

// ── Generazione numero documento (atomica, no race condition) ─────────────────
// Chiama la funzione PL/pgSQL `next_invoice_number` che usa
// INSERT ... ON CONFLICT DO UPDATE RETURNING — serializzato da PostgreSQL.
// Sotto carico concorrente, due chiamate sullo stesso workspace/anno
// ricevono sempre numeri distinti.
async function allocateDocNumber(workspaceId: string): Promise<string> {
  const supabase = await createClient()
  const year = new Date().getFullYear()
  const { data, error } = await supabase.rpc('next_invoice_number', {
    p_workspace: workspaceId,
    p_year: year,
  })
  if (error || data === null) {
    throw new Error('Impossibile generare il numero documento')
  }
  const n = (data as number).toString().padStart(3, '0')
  return `${n}/${year}`
}

// Legge il prossimo numero disponibile SENZA incrementare la sequenza.
// Usata dalla pagina "nuovo preventivo" per mostrare il numero nel form
// prima del salvataggio — non garantisce esclusività (è solo un'anteprima).
export async function peekNextDocNumber(workspaceId: string): Promise<string> {
  const supabase = await createClient()
  const year = new Date().getFullYear()
  const { data } = await supabase
    .from('invoice_sequences')
    .select('last_number')
    .eq('workspace_id', workspaceId)
    .eq('year', year)
    .maybeSingle()
  const next = ((data?.last_number ?? 0) + 1).toString().padStart(3, '0')
  return `${next}/${year}`
}

// ── createDocumentAction ──────────────────────────────────────────────────

export async function createDocumentAction(
  _prevState: { error?: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato' }

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, fiscal_regime, bollo_auto, ritenuta_auto, plan')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!workspace) return { error: 'Workspace non trovato' }

  // Piano Free: max 10 documenti
  if (workspace.plan === 'free') {
    const { count } = await supabase
      .from('documents')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspace.id)
    if ((count ?? 0) >= 10) {
      return { error: 'Hai raggiunto il limite di 10 preventivi del piano Free. Passa a Pro per preventivi illimitati.' }
    }
  }

  // Valida form
  const raw = Object.fromEntries(formData)
  const parsed = DocumentFormSchema.safeParse(raw)
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? 'Dati non validi'
    return { error: firstError }
  }

  // Valida voci
  let voci: z.infer<typeof VoceSchema>[]
  try {
    const rawItems = JSON.parse(parsed.data.items_json)
    const voceList = z.array(VoceSchema).safeParse(rawItems)
    if (!voceList.success) return { error: 'Voci non valide' }
    voci = voceList.data
  } catch {
    return { error: 'Formato voci non valido' }
  }

  if (voci.length === 0) return { error: 'Aggiungi almeno una voce al preventivo' }

  // Calcolo fiscale server-side (autorità)
  const fiscalOpts: FiscalOptions = {
    fiscal_regime: workspace.fiscal_regime,
    currency: 'EUR',
    discount_pct: parsed.data.discount_pct ?? undefined,
    discount_fixed: parsed.data.discount_fixed ?? undefined,
    vat_rate_default: parsed.data.vat_rate_default ?? undefined,
  }

  const itemsForCalc = voci.map((v) => ({
    id: v.id ?? '',
    document_id: '',
    sort_order: v.sort_order,
    description: v.description,
    unit: v.unit ?? 'pz',
    quantity: v.quantity,
    unit_price: v.unit_price,
    discount_pct: v.discount_pct ?? null,
    vat_rate: v.vat_rate ?? null,
    total: 0,
    ai_generated: false,
    ai_confidence: null,
  }))

  const fiscal = calcolaDocumento(itemsForCalc, fiscalOpts)

  // Snapshot template
  let templateSnapshot = null
  if (parsed.data.template_id) {
    const { data: tmpl } = await supabase
      .from('templates')
      .select('*')
      .eq('id', parsed.data.template_id)
      .eq('workspace_id', workspace.id)
      .maybeSingle()
    if (tmpl) templateSnapshot = tmpl
  }

  // Numero documento: override manuale o generazione atomica dalla sequenza
  let docNumber: string
  const docNumberOverride = parsed.data.doc_number?.trim()
  if (docNumberOverride && DOC_NUMBER_RE.test(docNumberOverride)) {
    // L'utente ha specificato un numero manuale — l'unique index sul DB
    // rileverà eventuali conflitti con errore 23505.
    docNumber = docNumberOverride
  } else {
    try {
      docNumber = await allocateDocNumber(workspace.id)
    } catch {
      return { error: 'Impossibile generare il numero documento. Riprova.' }
    }
  }

  // Calcola scadenza
  const validityDays = parsed.data.validity_days ?? 30
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + validityDays)

  // Inserisci documento
  const { data: doc, error: docError } = await supabase
    .from('documents')
    .insert({
      workspace_id: workspace.id,
      created_by: user.id,
      client_id: parsed.data.client_id || null,
      template_snapshot: templateSnapshot,
      doc_type: 'preventivo',
      status: 'draft',
      doc_number: docNumber,
      // TODO: rimuovere il cast quando i tipi Supabase saranno rigenerati
      // dopo la migration 002 (title è ora nullable nel DB).
      title: (parsed.data.title || null) as string | null,
      notes: parsed.data.notes ?? null,
      internal_notes: parsed.data.internal_notes ?? null,
      validity_days: validityDays,
      payment_terms: parsed.data.payment_terms ?? '30 giorni',
      currency: 'EUR',
      exchange_rate: 1.0,
      vat_rate_default: parsed.data.vat_rate_default ?? null,
      discount_pct: parsed.data.discount_pct ?? null,
      discount_fixed: parsed.data.discount_fixed ?? null,
      subtotal: fiscal.subtotal,
      tax_amount: fiscal.taxAmount,
      bollo_amount: fiscal.bollo,
      total: fiscal.total,
      expires_at: expiresAt.toISOString(),
    })
    .select('id')
    .single()

  if (docError || !doc) {
    // 23505 = unique_violation: numero documento già esistente per questo workspace
    if ((docError as { code?: string } | null)?.code === '23505') {
      return { error: `Il numero ${docNumber} è già in uso. Modificalo e riprova.` }
    }
    return { error: 'Errore durante il salvataggio del preventivo' }
  }

  // Inserisci voci
  const items: DocumentItemInsert[] = fiscal.itemTotals.map((item, i) => ({
    document_id: doc.id,
    sort_order: i,
    description: item.description,
    unit: item.unit ?? 'pz',
    quantity: item.quantity,
    unit_price: item.unit_price,
    discount_pct: item.discount_pct ?? null,
    vat_rate: item.vat_rate ?? null,
    total: item.total,
  }))

  const { error: itemsError } = await supabase
    .from('document_items')
    .insert(items)

  if (itemsError) {
    // Rollback documento
    await supabase.from('documents').delete().eq('id', doc.id)
    return { error: 'Errore durante il salvataggio delle voci' }
  }

  revalidatePath('/preventivi')
  redirect(`/preventivi/${doc.id}`)
}

// ── updateDocumentAction ──────────────────────────────────────────────────

export async function updateDocumentAction(
  documentId: string,
  _prevState: { error?: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato' }

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, fiscal_regime, bollo_auto, ritenuta_auto')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!workspace) return { error: 'Workspace non trovato' }

  // Verifica documento appartiene al workspace e legge doc_number corrente
  const { data: existingDoc } = await supabase
    .from('documents')
    .select('id, status, doc_number')
    .eq('id', documentId)
    .eq('workspace_id', workspace.id)
    .maybeSingle()
  if (!existingDoc) return { error: 'Documento non trovato' }
  if (existingDoc.status === 'accepted') return { error: 'Non è possibile modificare un documento già accettato' }

  const raw = Object.fromEntries(formData)
  const parsed = DocumentFormSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dati non validi' }
  }

  let voci: z.infer<typeof VoceSchema>[]
  try {
    const rawItems = JSON.parse(parsed.data.items_json)
    const voceList = z.array(VoceSchema).safeParse(rawItems)
    if (!voceList.success) return { error: 'Voci non valide' }
    voci = voceList.data
  } catch {
    return { error: 'Formato voci non valido' }
  }
  if (voci.length === 0) return { error: 'Aggiungi almeno una voce al preventivo' }

  const fiscalOpts: FiscalOptions = {
    fiscal_regime: workspace.fiscal_regime,
    currency: 'EUR',
    discount_pct: parsed.data.discount_pct ?? undefined,
    discount_fixed: parsed.data.discount_fixed ?? undefined,
    vat_rate_default: parsed.data.vat_rate_default ?? undefined,
  }

  const itemsForCalc = voci.map((v) => ({
    id: v.id ?? '',
    document_id: documentId,
    sort_order: v.sort_order,
    description: v.description,
    unit: v.unit ?? 'pz',
    quantity: v.quantity,
    unit_price: v.unit_price,
    discount_pct: v.discount_pct ?? null,
    vat_rate: v.vat_rate ?? null,
    total: 0,
    ai_generated: false,
    ai_confidence: null,
  }))

  const fiscal = calcolaDocumento(itemsForCalc, fiscalOpts)

  const validityDays = parsed.data.validity_days ?? 30
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + validityDays)

  // Numero: usa quello dal form (eventuale modifica manuale) oppure mantieni l'esistente
  const docNumberNew = parsed.data.doc_number?.trim() || existingDoc.doc_number

  const { error: docError } = await supabase
    .from('documents')
    .update({
      client_id: parsed.data.client_id || null,
      doc_number: docNumberNew,
      title: (parsed.data.title || null) as string | null,
      notes: parsed.data.notes ?? null,
      internal_notes: parsed.data.internal_notes ?? null,
      validity_days: validityDays,
      payment_terms: parsed.data.payment_terms ?? '30 giorni',
      vat_rate_default: parsed.data.vat_rate_default ?? null,
      discount_pct: parsed.data.discount_pct ?? null,
      discount_fixed: parsed.data.discount_fixed ?? null,
      subtotal: fiscal.subtotal,
      tax_amount: fiscal.taxAmount,
      bollo_amount: fiscal.bollo,
      total: fiscal.total,
      expires_at: expiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', documentId)
    .eq('workspace_id', workspace.id)

  if (docError) {
    if ((docError as { code?: string }).code === '23505') {
      return { error: `Il numero ${docNumberNew} è già in uso. Modificalo e riprova.` }
    }
    return { error: 'Errore durante l\'aggiornamento' }
  }

  // Sostituisci tutte le voci
  await supabase.from('document_items').delete().eq('document_id', documentId)

  const items: DocumentItemInsert[] = fiscal.itemTotals.map((item, i) => ({
    document_id: documentId,
    sort_order: i,
    description: item.description,
    unit: item.unit ?? 'pz',
    quantity: item.quantity,
    unit_price: item.unit_price,
    discount_pct: item.discount_pct ?? null,
    vat_rate: item.vat_rate ?? null,
    total: item.total,
  }))

  const { error: itemsError } = await supabase
    .from('document_items')
    .insert(items)

  if (itemsError) return { error: 'Errore durante il salvataggio delle voci' }

  revalidatePath('/preventivi')
  revalidatePath(`/preventivi/${documentId}`)
  redirect(`/preventivi/${documentId}`)
}

// ── saveDraftAction (auto-save) ───────────────────────────────────────────
// Usata dall'auto-save ogni 30s — non fa redirect

export async function saveDraftAction(
  documentId: string,
  formData: FormData
): Promise<{ error?: string; ok?: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato' }

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, fiscal_regime')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!workspace) return { error: 'Workspace non trovato' }

  const { data: existingDoc } = await supabase
    .from('documents')
    .select('id, status, doc_number')
    .eq('id', documentId)
    .eq('workspace_id', workspace.id)
    .maybeSingle()
  if (!existingDoc || existingDoc.status === 'accepted') return { error: 'Documento non modificabile' }

  const raw = Object.fromEntries(formData)
  const parsed = DocumentFormSchema.safeParse(raw)
  if (!parsed.success) return { error: 'Dati non validi' }

  let voci: z.infer<typeof VoceSchema>[] = []
  try {
    const rawItems = JSON.parse(parsed.data.items_json)
    const voceList = z.array(VoceSchema).safeParse(rawItems)
    if (voceList.success) voci = voceList.data
  } catch { /* ignora — salva comunque gli altri campi */ }

  const fiscalOpts: FiscalOptions = {
    fiscal_regime: workspace.fiscal_regime,
    currency: 'EUR',
    discount_pct: parsed.data.discount_pct ?? undefined,
    discount_fixed: parsed.data.discount_fixed ?? undefined,
    vat_rate_default: parsed.data.vat_rate_default ?? undefined,
  }

  let fiscal = { subtotal: 0, taxAmount: 0, bollo: 0, total: 0, itemTotals: [] as typeof voci }
  if (voci.length > 0) {
    const itemsForCalc = voci.map((v) => ({
      id: v.id ?? '',
      document_id: documentId,
      sort_order: v.sort_order,
      description: v.description,
      unit: v.unit ?? 'pz',
      quantity: v.quantity,
      unit_price: v.unit_price,
      discount_pct: v.discount_pct ?? null,
      vat_rate: v.vat_rate ?? null,
      total: 0,
      ai_generated: false,
      ai_confidence: null,
    }))
    const result = calcolaDocumento(itemsForCalc, fiscalOpts)
    fiscal = { subtotal: result.subtotal, taxAmount: result.taxAmount, bollo: result.bollo, total: result.total, itemTotals: [] }
  }

  const validityDays = parsed.data.validity_days ?? 30
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + validityDays)

  const docNumberNew = parsed.data.doc_number?.trim() || existingDoc.doc_number

  await supabase
    .from('documents')
    .update({
      client_id: parsed.data.client_id || null,
      doc_number: docNumberNew,
      title: (parsed.data.title || null) as string | null,
      notes: parsed.data.notes ?? null,
      internal_notes: parsed.data.internal_notes ?? null,
      validity_days: validityDays,
      payment_terms: parsed.data.payment_terms ?? '30 giorni',
      vat_rate_default: parsed.data.vat_rate_default ?? null,
      discount_pct: parsed.data.discount_pct ?? null,
      discount_fixed: parsed.data.discount_fixed ?? null,
      subtotal: fiscal.subtotal,
      tax_amount: fiscal.taxAmount,
      bollo_amount: fiscal.bollo,
      total: fiscal.total,
      expires_at: expiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', documentId)
    .eq('workspace_id', workspace.id)

  revalidatePath(`/preventivi/${documentId}`)
  return { ok: true }
}

// ── deleteDocumentAction ──────────────────────────────────────────────────

export async function deleteDocumentAction(
  documentId: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato' }

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!workspace) return { error: 'Workspace non trovato' }

  const { error } = await supabase
    .from('documents')
    .delete()
    .eq('id', documentId)
    .eq('workspace_id', workspace.id)

  if (error) return { error: 'Errore durante l\'eliminazione' }

  revalidatePath('/preventivi')
  redirect('/preventivi')
}

// ── sendDocumentAction ────────────────────────────────────────────────────

export async function sendDocumentAction(
  documentId: string
): Promise<{ error?: string; ok?: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato' }

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!workspace) return { error: 'Workspace non trovato' }

  const { data: doc } = await supabase
    .from('documents')
    .select('id, status, total')
    .eq('id', documentId)
    .eq('workspace_id', workspace.id)
    .maybeSingle()

  if (!doc) return { error: 'Documento non trovato' }
  if (doc.status !== 'draft') return { error: 'Solo le bozze possono essere inviate' }
  if ((doc.total ?? 0) === 0) return { error: 'Il preventivo non ha voci' }

  const { error } = await supabase
    .from('documents')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('id', documentId)
    .eq('workspace_id', workspace.id)

  if (error) return { error: 'Errore durante l\'invio' }

  revalidatePath('/preventivi')
  revalidatePath(`/preventivi/${documentId}`)
  return { ok: true }
}

// ── duplicateDocumentAction ───────────────────────────────────────────────

export async function duplicateDocumentAction(
  documentId: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato' }

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, plan')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!workspace) return { error: 'Workspace non trovato' }

  // Piano Free: max 10 documenti
  if (workspace.plan === 'free') {
    const { count } = await supabase
      .from('documents')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspace.id)
    if ((count ?? 0) >= 10) {
      return { error: 'Limite piano Free raggiunto.' }
    }
  }

  const { data: original } = await supabase
    .from('documents')
    .select('*, document_items(*)')
    .eq('id', documentId)
    .eq('workspace_id', workspace.id)
    .maybeSingle()

  if (!original) return { error: 'Documento non trovato' }

  // Genera nuovo numero atomico per la copia
  let docNumber: string
  try {
    docNumber = await allocateDocNumber(workspace.id)
  } catch {
    return { error: 'Impossibile generare il numero documento. Riprova.' }
  }

  const { data: newDoc, error: insertErr } = await supabase
    .from('documents')
    .insert({
      workspace_id: workspace.id,
      created_by: user.id,
      client_id: original.client_id,
      template_snapshot: original.template_snapshot,
      doc_type: original.doc_type,
      status: 'draft',
      doc_number: docNumber,
      title: (original.title ? `${original.title} (copia)` : null) as string | null,
      notes: original.notes,
      internal_notes: null,
      validity_days: original.validity_days,
      payment_terms: original.payment_terms,
      currency: original.currency,
      exchange_rate: original.exchange_rate,
      vat_rate_default: original.vat_rate_default,
      discount_pct: original.discount_pct,
      discount_fixed: original.discount_fixed,
      subtotal: original.subtotal,
      tax_amount: original.tax_amount,
      bollo_amount: original.bollo_amount,
      total: original.total,
    })
    .select('id')
    .single()

  if (insertErr || !newDoc) return { error: 'Errore durante la duplicazione' }

  // Duplica le voci
  const items = (original.document_items as DocumentItemInsert[]).map((item) => ({
    document_id: newDoc.id,
    sort_order: item.sort_order,
    description: item.description,
    unit: item.unit,
    quantity: item.quantity,
    unit_price: item.unit_price,
    discount_pct: item.discount_pct,
    vat_rate: item.vat_rate,
    total: item.total,
  }))

  if (items.length > 0) {
    await supabase.from('document_items').insert(items)
  }

  revalidatePath('/preventivi')
  redirect(`/preventivi/${newDoc.id}`)
}

// ── searchDocumentsAction ─────────────────────────────────────────────────

export async function searchDocumentsAction(query: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!workspace) return []

  if (!query.trim()) {
    const { data } = await supabase
      .from('documents')
      .select('id, title, doc_number, status, total, created_at, clients(name)')
      .eq('workspace_id', workspace.id)
      .order('doc_year', { ascending: false, nullsFirst: false })
      .order('doc_seq', { ascending: false, nullsFirst: false })
      .limit(10)
    return data ?? []
  }

  const { data } = await supabase
    .from('documents')
    .select('id, title, doc_number, status, total, created_at, clients(name)')
    .eq('workspace_id', workspace.id)
    .textSearch('search_vector', query, { type: 'websearch', config: 'italian' })
    .limit(10)
  return data ?? []
}
