'use server'

import { z } from 'zod/v4'
import { createElement } from 'react'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { calcolaDocumento } from '@/lib/fiscal/calcoli'
import { sendEmail } from '@/lib/email/send'
import { SollecitoClienteEmail } from '@/lib/email/templates/sollecito_cliente'
import type { FiscalOptions } from '@/types/index'
import type { Database } from '@/types/database'
import { checkFreeBlock } from '@/lib/free-trial'

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
  bonus_tipo: z.string().nullable().optional(),
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
  bonus_edilizio: z.string().optional(),
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
//
// Dalla migration 012: le sequenze sono separate per doc_type.
// I preventivi usano 'preventivo', le fatture usano 'fattura'.

export async function allocateDocNumber(workspaceId: string): Promise<string> {
  const supabase = await createClient()
  const year = new Date().getFullYear()
  const { data, error } = await supabase.rpc('next_invoice_number', {
    p_workspace: workspaceId,
    p_year: year,
    p_doc_type: 'preventivo',
  })
  if (error || data === null) {
    throw new Error('Impossibile generare il numero documento')
  }
  const n = (data as number).toString().padStart(3, '0')
  return `${n}/${year}`
}

// Alloca un numero fattura atomico dalla sequenza 'fattura' e lo formatta
// applicando il prefisso del workspace (es. "FT-001/2026").
export async function allocateInvoiceNumber(
  workspaceId: string,
  prefix: string
): Promise<string> {
  const supabase = await createClient()
  const year = new Date().getFullYear()
  const { data, error } = await supabase.rpc('next_invoice_number', {
    p_workspace: workspaceId,
    p_year: year,
    p_doc_type: 'fattura',
  })
  if (error || data === null) {
    throw new Error('Impossibile generare il numero fattura')
  }
  const n = (data as number).toString().padStart(3, '0')
  return `${prefix}${n}/${year}`
}

// Legge il prossimo numero preventivo disponibile SENZA incrementare.
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
    .eq('seq_type', 'preventivo')
    .maybeSingle()
  const next = ((data?.last_number ?? 0) + 1).toString().padStart(3, '0')
  return `${next}/${year}`
}

// Legge il prossimo numero fattura disponibile SENZA incrementare.
// Usata dalla pagina "fatture/nuovo" per mostrare il numero nel form.
export async function peekNextInvoiceNumber(
  workspaceId: string,
  prefix: string
): Promise<string> {
  const supabase = await createClient()
  const year = new Date().getFullYear()
  const { data } = await supabase
    .from('invoice_sequences')
    .select('last_number')
    .eq('workspace_id', workspaceId)
    .eq('year', year)
    .eq('seq_type', 'fattura')
    .maybeSingle()
  const next = ((data?.last_number ?? 0) + 1).toString().padStart(3, '0')
  return `${prefix}${next}/${year}`
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
    .select('id, fiscal_regime, bollo_auto, ritenuta_auto, plan, free_trial_expires_at, sent_quota_used')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!workspace) return { error: 'Workspace non trovato' }

  // Piano Free: blocco completo se trial scaduto o quota raggiunta
  if (workspace.plan === 'free') {
    const trial = checkFreeBlock(workspace)
    if (trial.blocked) {
      return { error: 'Piano Free terminato. Passa a Pro per creare nuovi preventivi illimitati.' }
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
    bonus_tipo: v.bonus_tipo ?? null,
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

  // FIX-22: per i preventivi, il numero viene assegnato al momento dell'invio
  // (o della generazione PDF). Solo gli override manuali vengono salvati subito.
  // Per le fatture il comportamento rimane invariato (numero assegnato alla creazione).
  const docNumberOverride = parsed.data.doc_number?.trim()
  const docNumber: string | null = (docNumberOverride && DOC_NUMBER_RE.test(docNumberOverride))
    ? docNumberOverride
    : null  // null → verrà assegnato all'invio

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
      client_id: parsed.data.client_id || undefined,
      template_snapshot: templateSnapshot,
      doc_type: 'preventivo',
      status: 'draft',
      doc_number: docNumber,
      title: parsed.data.title || undefined,
      notes: parsed.data.notes ?? null,
      internal_notes: parsed.data.internal_notes ?? null,
      validity_days: validityDays,
      payment_terms: parsed.data.payment_terms ?? '30 giorni',
      bonus_edilizio: parsed.data.bonus_edilizio || null,
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
    bonus_tipo: item.bonus_tipo ?? null,
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

  // Verifica documento appartiene al workspace e legge doc_number/doc_type correnti
  const { data: existingDoc } = await supabase
    .from('documents')
    .select('id, status, doc_number, doc_type')
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
    bonus_tipo: v.bonus_tipo ?? null,
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
      client_id: parsed.data.client_id || undefined,
      doc_number: docNumberNew,
      title: parsed.data.title || undefined,
      notes: parsed.data.notes ?? null,
      internal_notes: parsed.data.internal_notes ?? null,
      validity_days: validityDays,
      payment_terms: parsed.data.payment_terms ?? '30 giorni',
      bonus_edilizio: parsed.data.bonus_edilizio || null,
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
    bonus_tipo: item.bonus_tipo ?? null,
    total: item.total,
  }))

  const { error: itemsError } = await supabase
    .from('document_items')
    .insert(items)

  if (itemsError) return { error: 'Errore durante il salvataggio delle voci' }

  const baseRoute = existingDoc.doc_type === 'fattura' ? '/fatture' : '/preventivi'
  revalidatePath('/preventivi')
  revalidatePath(`/preventivi/${documentId}`)
  revalidatePath('/fatture')
  revalidatePath(`/fatture/${documentId}`)
  redirect(`${baseRoute}/${documentId}`)
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
    .select('id, status, doc_number, doc_type')
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

  let fiscal = {
    subtotal: 0, taxAmount: 0, bollo: 0, total: 0,
    itemTotals: [] as ReturnType<typeof calcolaDocumento>['itemTotals'],
  }
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
      bonus_tipo: v.bonus_tipo ?? null,
      total: 0,
      ai_generated: false,
      ai_confidence: null,
    }))
    const result = calcolaDocumento(itemsForCalc, fiscalOpts)
    // FIX: usa itemTotals calcolati (prima era [] — non salvava le voci)
    fiscal = { subtotal: result.subtotal, taxAmount: result.taxAmount, bollo: result.bollo, total: result.total, itemTotals: result.itemTotals }
  }

  const validityDays = parsed.data.validity_days ?? 30
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + validityDays)

  // Se il numero viene esplicitamente cancellato (stringa vuota):
  // - preventivi: salva null (le bozze non hanno un numero ufficiale)
  // - fatture: mantieni il numero esistente (obbligatorio)
  const submittedDocNumber = parsed.data.doc_number?.trim() ?? ''
  const docNumberNew = submittedDocNumber
    ? submittedDocNumber
    : existingDoc.doc_type === 'fattura'
      ? existingDoc.doc_number
      : null

  await supabase
    .from('documents')
    .update({
      client_id: parsed.data.client_id || undefined,
      doc_number: docNumberNew,
      title: parsed.data.title || undefined,
      notes: parsed.data.notes ?? null,
      internal_notes: parsed.data.internal_notes ?? null,
      validity_days: validityDays,
      payment_terms: parsed.data.payment_terms ?? '30 giorni',
      bonus_edilizio: parsed.data.bonus_edilizio || null,
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

  // Salva le voci se presenti.
  // Se le voci non sono valide (lista vuota), lascia invariate le voci esistenti (tollerante).
  if (fiscal.itemTotals.length > 0) {
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
      bonus_tipo: item.bonus_tipo ?? null,
      total: item.total,
    }))
    await supabase.from('document_items').insert(items)
  }

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

  // Leggi doc_type prima di eliminare per redirect corretto
  const { data: docMeta } = await supabase
    .from('documents')
    .select('doc_type')
    .eq('id', documentId)
    .eq('workspace_id', workspace.id)
    .maybeSingle()

  const { error } = await supabase
    .from('documents')
    .delete()
    .eq('id', documentId)
    .eq('workspace_id', workspace.id)

  if (error) return { error: 'Errore durante l\'eliminazione' }

  revalidatePath('/preventivi')
  revalidatePath('/fatture')
  redirect(docMeta?.doc_type === 'fattura' ? '/fatture' : '/preventivi')
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
    .select('id, plan, free_trial_expires_at, sent_quota_used')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!workspace) return { error: 'Workspace non trovato' }

  // Piano Free: blocco completo se trial scaduto o quota raggiunta
  if (workspace.plan === 'free') {
    const trial = checkFreeBlock(workspace)
    if (trial.blocked) {
      return { error: 'Piano Free terminato. Passa a Pro per inviare preventivi illimitati.' }
    }
  }

  const { data: doc } = await supabase
    .from('documents')
    .select('id, status, total, client_id, doc_number, validity_days, pdf_downloaded_at')
    .eq('id', documentId)
    .eq('workspace_id', workspace.id)
    .maybeSingle()

  if (!doc) return { error: 'Documento non trovato' }
  if (doc.status !== 'draft') return { error: 'Solo le bozze possono essere inviate' }
  if (!doc.client_id) return { error: 'Seleziona un cliente prima di inviare' }
  if ((doc.total ?? 0) === 0) return { error: 'Aggiungi almeno una voce con prezzo e quantità prima di inviare' }

  // Verifica che il cliente abbia un'email valida
  const { data: clientData } = await supabase
    .from('clients')
    .select('email')
    .eq('id', doc.client_id)
    .maybeSingle()
  if (!clientData?.email) {
    return { error: 'Il cliente non ha un\'email — aggiungila in Clienti prima di inviare' }
  }

  // Assegna numero documento se ancora null
  let finalDocNumber = doc.doc_number
  if (!finalDocNumber) {
    try {
      finalDocNumber = await allocateDocNumber(workspace.id)
    } catch {
      return { error: 'Impossibile generare il numero documento. Riprova.' }
    }
  }

  // Ricalcola expires_at dal momento dell'invio
  const sentAt = new Date()
  const validityDays = doc.validity_days ?? 30
  const expiresAt = new Date(sentAt)
  expiresAt.setDate(expiresAt.getDate() + validityDays)

  // Invalida la cache PDF (il documento passa da bozza a inviato — watermark rimosso)
  const { error } = await supabase
    .from('documents')
    .update({
      status: 'sent',
      sent_at: sentAt.toISOString(),
      doc_number: finalDocNumber,
      expires_at: expiresAt.toISOString(),
      pdf_url: null, // invalida cache PDF — verrà rigenerato senza watermark
    })
    .eq('id', documentId)
    .eq('workspace_id', workspace.id)

  if (error) return { error: 'Errore durante l\'invio' }

  // Incrementa il contatore storico degli invii Free.
  // Non decrementato mai: sopravvive alle delete del documento.
  if (workspace.plan === 'free') {
    await supabase
      .from('workspaces')
      .update({ sent_quota_used: workspace.sent_quota_used + 1 })
      .eq('id', workspace.id)
  }

  revalidatePath('/preventivi')
  revalidatePath(`/preventivi/${documentId}`)
  return { ok: true }
}

// ── registerManualSendAction ──────────────────────────────────────────────
// Registra l'invio manuale di un preventivo (es. via WhatsApp o email esterna).
// Assegna il numero progressivo + cambia status a 'sent'.
// Non invia email — l'utente ha già inviato il documento fuori dall'app.

export async function registerManualSendAction(
  documentId: string
): Promise<{ error?: string; ok?: boolean; docNumber?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato' }

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, plan, free_trial_expires_at, sent_quota_used')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!workspace) return { error: 'Workspace non trovato' }

  // Piano Free: blocco completo se trial scaduto o quota raggiunta
  if (workspace.plan === 'free') {
    const trial = checkFreeBlock(workspace)
    if (trial.blocked) {
      return { error: 'Piano Free terminato. Passa a Pro per registrare preventivi illimitati.' }
    }
  }

  const { data: doc } = await supabase
    .from('documents')
    .select('id, status, total, pdf_downloaded_at, doc_number, validity_days')
    .eq('id', documentId)
    .eq('workspace_id', workspace.id)
    .maybeSingle()

  if (!doc) return { error: 'Documento non trovato' }
  if (doc.status !== 'draft') return { error: 'Solo le bozze possono essere registrate come inviate' }
  if ((doc.total ?? 0) === 0) return { error: 'Il preventivo non ha voci' }

  // Assegna numero progressivo se non ancora assegnato
  let finalDocNumber = doc.doc_number
  if (!finalDocNumber) {
    try {
      finalDocNumber = await allocateDocNumber(workspace.id)
    } catch {
      return { error: 'Impossibile generare il numero documento. Riprova.' }
    }
  }

  const sentAt = new Date()
  const validityDays = doc.validity_days ?? 30
  const expiresAt = new Date(sentAt)
  expiresAt.setDate(expiresAt.getDate() + validityDays)

  const { error } = await supabase
    .from('documents')
    .update({
      status: 'sent',
      sent_at: sentAt.toISOString(),
      doc_number: finalDocNumber,
      expires_at: expiresAt.toISOString(),
      pdf_url: null, // invalida cache PDF — verrà rigenerato senza watermark
    })
    .eq('id', documentId)
    .eq('workspace_id', workspace.id)

  if (error) return { error: 'Errore durante la registrazione' }

  // Incrementa il contatore storico degli invii Free.
  if (workspace.plan === 'free') {
    await supabase
      .from('workspaces')
      .update({ sent_quota_used: workspace.sent_quota_used + 1 })
      .eq('id', workspace.id)
  }

  revalidatePath('/preventivi')
  revalidatePath(`/preventivi/${documentId}`)
  return { ok: true, docNumber: finalDocNumber }
}

// ── duplicateDocumentAction ───────────────────────────────────────────────

export async function duplicateDocumentAction(
  documentId: string,
  options?: { keepTitle?: boolean }
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato' }

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, plan, free_trial_expires_at, sent_quota_used')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!workspace) return { error: 'Workspace non trovato' }

  const { data: original } = await supabase
    .from('documents')
    .select('*, document_items(*)')
    .eq('id', documentId)
    .eq('workspace_id', workspace.id)
    .maybeSingle()

  if (!original) return { error: 'Documento non trovato' }

  // Piano Free: blocca la duplicazione di preventivi se trial scaduto o quota raggiunta
  if (workspace.plan === 'free' && original.doc_type === 'preventivo') {
    const trial = checkFreeBlock(workspace)
    if (trial.blocked) {
      return { error: 'Piano Free terminato. Passa a Pro per creare nuovi preventivi illimitati.' }
    }
  }

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
      title: (original.title
        ? (options?.keepTitle ? original.title : `${original.title} (copia)`)
        : null) as string | null,
      notes: original.notes,
      internal_notes: null,
      validity_days: original.validity_days,
      payment_terms: original.payment_terms,
      currency: original.currency,
      exchange_rate: original.exchange_rate,
      bonus_edilizio: original.bonus_edilizio,
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
    bonus_tipo: item.bonus_tipo,
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

// ── createInvoiceAction ───────────────────────────────────────────────────
// Crea una fattura da zero (non da conversione preventivo).
// Usa la sequenza 'fattura' separata, con prefisso workspace.

export async function createInvoiceAction(
  _prevState: { error?: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato' }

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, fiscal_regime, bollo_auto, ritenuta_auto, plan, invoice_prefix')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!workspace) return { error: 'Workspace non trovato' }

  // Valida form (stesso schema dei preventivi)
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
  if (voci.length === 0) return { error: 'Aggiungi almeno una voce alla fattura' }

  // Calcolo fiscale server-side
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
    bonus_tipo: v.bonus_tipo ?? null,
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

  // Numero fattura: override manuale o sequenza atomica con prefisso
  const prefix = (workspace.invoice_prefix as string | null) ?? ''
  // Regex per fatture: ammette prefisso opzionale + NNN/YYYY
  const FT_NUMBER_RE = /^.*\d{1,6}\/\d{4}$/

  let docNumber: string
  const docNumberOverride = parsed.data.doc_number?.trim()
  if (docNumberOverride && FT_NUMBER_RE.test(docNumberOverride)) {
    docNumber = docNumberOverride
  } else {
    try {
      docNumber = await allocateInvoiceNumber(workspace.id, prefix)
    } catch {
      return { error: 'Impossibile generare il numero fattura. Riprova.' }
    }
  }

  // Inserisci documento come fattura
  const { data: doc, error: docError } = await supabase
    .from('documents')
    .insert({
      workspace_id: workspace.id,
      created_by: user.id,
      client_id: parsed.data.client_id || undefined,
      template_snapshot: templateSnapshot,
      doc_type: 'fattura',
      status: 'draft',
      doc_number: docNumber,
      title: parsed.data.title || undefined,
      notes: parsed.data.notes ?? null,
      internal_notes: parsed.data.internal_notes ?? null,
      validity_days: parsed.data.validity_days ?? 30,
      payment_terms: parsed.data.payment_terms ?? '30 giorni',
      bonus_edilizio: parsed.data.bonus_edilizio || null,
      currency: 'EUR',
      exchange_rate: 1.0,
      vat_rate_default: parsed.data.vat_rate_default ?? null,
      discount_pct: parsed.data.discount_pct ?? null,
      discount_fixed: parsed.data.discount_fixed ?? null,
      subtotal: fiscal.subtotal,
      tax_amount: fiscal.taxAmount,
      bollo_amount: fiscal.bollo,
      total: fiscal.total,
    })
    .select('id')
    .single()

  if (docError || !doc) {
    if ((docError as { code?: string } | null)?.code === '23505') {
      return { error: `Il numero ${docNumber} è già in uso. Modificalo e riprova.` }
    }
    return { error: 'Errore durante il salvataggio della fattura' }
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
    bonus_tipo: item.bonus_tipo ?? null,
    total: item.total,
  }))

  const { error: itemsError } = await supabase
    .from('document_items')
    .insert(items)

  if (itemsError) {
    await supabase.from('documents').delete().eq('id', doc.id)
    return { error: 'Errore durante il salvataggio delle voci' }
  }

  revalidatePath('/fatture')
  redirect(`/fatture/${doc.id}`)
}

// ── sendReminderAction ────────────────────────────────────────────────────
// Invia un'email di sollecito al cliente per un preventivo in attesa.

export async function sendReminderAction(
  documentId: string
): Promise<{ error?: string; ok?: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato' }

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, ragione_sociale, name')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!workspace) return { error: 'Workspace non trovato' }

  const { data: doc } = await supabase
    .from('documents')
    .select('id, doc_number, title, status, public_token, client_id')
    .eq('id', documentId)
    .eq('workspace_id', workspace.id)
    .maybeSingle()

  if (!doc) return { error: 'Documento non trovato' }
  if (doc.status !== 'sent') return { error: 'Solo i preventivi inviati possono essere sollecitati' }
  if (!doc.client_id) return { error: 'Nessun cliente associato al documento' }

  const { data: client } = await supabase
    .from('clients')
    .select('name, email')
    .eq('id', doc.client_id)
    .maybeSingle()

  if (!client?.email) return { error: "Il cliente non ha un'email — aggiornalo prima di sollecitare" }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://cartacanta.app'
  const publicUrl = doc.public_token
    ? `${appUrl}/p/${doc.public_token}`
    : `${appUrl}/preventivi/${doc.id}`

  const result = await sendEmail({
    to: client.email,
    subject: `Promemoria: preventivo${doc.doc_number ? ` #${doc.doc_number}` : ''} in attesa di risposta`,
    react: createElement(SollecitoClienteEmail, {
      clientName: client.name,
      documentTitle: doc.title ?? 'Preventivo',
      documentNumber: doc.doc_number ?? undefined,
      workspaceName: workspace.ragione_sociale ?? workspace.name,
      publicUrl,
    }),
  })

  if (!result.success) return { error: result.error ?? 'Errore invio email' }
  return { ok: true }
}
