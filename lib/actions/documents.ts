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
import type { Database, Json } from '@/types/database'
import { checkFreeBlock } from '@/lib/free-trial'
import { parseImportoIt } from '@/lib/utils'

type DocumentItemInsert = Database['public']['Tables']['document_items']['Insert']

// ── Formato numero documento: NNN/YYYY — es. 001/2026 ────────────────────────
// Accetta da 1 a 6 cifre (futuro-proof), slash, 4 cifre anno.
// Accetta numeri con o senza prefisso letterale: "001/2026", "Prev001/2026", "Fatt001/2026"
const DOC_NUMBER_RE = /^[A-Za-z]*\d{1,6}\/\d{4}$/

// ── Helper: controlla combinazioni di campi mancanti sulle voci (dati raw pre-Zod) ──
// Stessa logica del client (getVociError in PreventivoForm.tsx) — mantenerle allineate.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function vociCombinationMessage(items: any[]): string | null {
  const noDesc  = items.some((v) => String(v.description ?? '').trim() === '')
  const noPrice = items.some((v) => Number(v.unit_price ?? 0) === 0)
  const noQty   = items.some((v) => Number(v.quantity ?? 0) === 0)
  if (noDesc && noPrice) return 'La descrizione e il prezzo in una o più voci preventivo devono essere diversi da zero per salvare o inviare.'
  if (noDesc && noQty)   return 'La descrizione e la quantità in una o più voci preventivo devono essere diversi da zero per salvare o inviare.'
  if (noPrice && noQty)  return 'Il prezzo e la quantità in una o più voci preventivo devono essere diversi da zero per salvare o inviare.'
  if (noDesc)  return 'La descrizione in una o più voci preventivo deve essere inserita per poter salvare o inviare il preventivo.'
  if (noPrice) return 'Il prezzo in una o più voci preventivo deve essere diversa da zero per salvare o inviare.'
  if (noQty)   return 'La quantità in una o più voci preventivo deve essere diversa da zero per salvare o inviare.'
  return null
}

// ── Helper: mappa il primo issue Zod delle voci (errori di tipo/formato) ──────
// Fallback per casi non coperti da vociCombinationMessage (es. valore non numerico).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function voceZodMessage(issues: { path: PropertyKey[]; message: string }[]): string {
  const issue = issues[0]
  const field = issue?.path[1] as string | undefined
  if (field === 'description') return 'La descrizione in una o più voci preventivo deve essere inserita per poter salvare o inviare il preventivo.'
  if (field === 'quantity')    return 'La quantità in una o più voci preventivo deve essere diversa da zero per salvare o inviare.'
  if (field === 'unit_price')  return 'Il prezzo in una o più voci preventivo deve essere diversa da zero per salvare o inviare.'
  return issue?.message ?? 'Dati voce non validi.'
}

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
  // Opzioni a livelli (041): a quale proposta appartiene la voce
  option_tier: z.enum(['base', 'consigliata', 'premium']).nullable().optional(),
})

// ── Opzioni a livelli: normalizza i campi del form ─────────────────────────
const OPTION_TIERS = ['base', 'consigliata', 'premium'] as const
type OptionTier = (typeof OPTION_TIERS)[number]
// isPro: gate server-side — le opzioni a livelli sono una funzione Pro,
// un POST manipolato da un piano Free non deve poterle attivare.
function parseOptionsFields(
  data: { options_enabled?: string; recommended_tier?: string },
  isPro: boolean
): {
  enabled: boolean
  recommended: OptionTier | null
} {
  const enabled = isPro && data.options_enabled === 'true'
  const recommended = OPTION_TIERS.includes(data.recommended_tier as OptionTier)
    ? (data.recommended_tier as OptionTier)
    : null
  return { enabled, recommended }
}

// ── Acconti: normalizza i campi del form (formato it-IT) ──────────────────
function parseDepositFields(data: { deposit_type?: string; deposit_value?: string }): {
  deposit_type: 'percent' | 'amount' | null
  deposit_value: number | null
} {
  const type = data.deposit_type === 'percent' || data.deposit_type === 'amount' ? data.deposit_type : null
  const val = parseImportoIt(data.deposit_value)
  if (!type || !Number.isFinite(val) || val <= 0) {
    return { deposit_type: null, deposit_value: null }
  }
  if (type === 'percent' && val > 100) return { deposit_type: null, deposit_value: null }
  return { deposit_type: type, deposit_value: val }
}

// ── Update tollerante dei campi 038 (acconto) e 041 (opzioni) ─────────────
// DUE update separati: se una sola delle due migration è applicata, il
// fallimento sulle colonne mancanti dell'una non deve perdere anche l'altra.
async function applyDepositAndOptions(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 038/041 non ancora in types/database.ts
  supabase: any,
  documentId: string,
  dep: { deposit_type: 'percent' | 'amount' | null; deposit_value: number | null },
  optionsCfg: { enabled: boolean; recommended: OptionTier | null },
  { alwaysWriteDeposit = true, workspaceId }: { alwaysWriteDeposit?: boolean; workspaceId?: string } = {}
): Promise<void> {
  const apply = async (payload: Record<string, unknown>) => {
    let q = supabase.from('documents').update(payload).eq('id', documentId)
    if (workspaceId) q = q.eq('workspace_id', workspaceId)
    await q
  }
  if (alwaysWriteDeposit || dep.deposit_type) {
    await apply({ deposit_type: dep.deposit_type, deposit_value: dep.deposit_value })
  }
  await apply({
    options_enabled: optionsCfg.enabled,
    recommended_tier: optionsCfg.enabled ? optionsCfg.recommended : null,
  })
}

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
  // Acconti (migration 038): richiesta acconto alla conferma.
  // deposit_type: 'percent' | 'amount' | '' (vuoto = disattivo)
  deposit_type: z.string().optional(),
  deposit_value: z.string().optional(),
  // Opzioni a livelli (migration 041, solo Pro): 'true' quando attive
  options_enabled: z.string().optional(),
  recommended_tier: z.string().optional(),
  vat_rate_default: z.coerce.number().nonnegative().nullable().optional(),
  discount_pct: z.coerce.number().min(0).max(100).nullable().optional(),
  discount_fixed: z.coerce.number().nonnegative().nullable().optional(),
  items_json: z.string().min(2), // JSON array
  // intent: 'save_draft' | 'send' | 'save' | 'create' a seconda del form (preventivo/fattura).
  // Stringa libera: ogni action interpreta i valori che le servono.
  intent: z.string().optional(),
})

// ── Helper: risolve template_id → snapshot da salvare sul documento ──────────
// "" (vuoto) o null → DEFAULT_CLASSICO_SNAPSHOT (garantisce Classico anche se
//   il workspace ha template personalizzati con is_default=true)
// "uuid" → fetch del template dal DB, fallback Classico se non trovato
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveTemplateSnapshot(supabase: any, workspaceId: string, templateId: string | null | undefined) {
  const classico = {
    preset_key: 'classico', color_primary: '#374151', font_family: 'Inter',
    show_logo: true, show_watermark: true, legal_notice: null, logo_position: 'left',
  }
  // "__classico__" è il sentinel usato dai form per "Default (Classico)"
  // SelectItem non accetta value="" in Radix UI v2 → usiamo un valore non-vuoto
  if (!templateId || templateId === '__classico__') return classico
  const { data } = await supabase
    .from('templates').select('*')
    .eq('id', templateId).eq('workspace_id', workspaceId).maybeSingle()
  return (data as Record<string, unknown>) ?? classico
}

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
// senza prefisso (es. "001/2026").
export async function allocateInvoiceNumber(workspaceId: string): Promise<string> {
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
  return `${n}/${year}`
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
    .eq('doc_type', 'preventivo')
    .maybeSingle()
  const next = ((data?.last_number ?? 0) + 1).toString().padStart(3, '0')
  return `${next}/${year}`
}

// Legge il prossimo numero fattura disponibile SENZA incrementare.
// Usata dalla pagina "fatture/nuovo" per mostrare il numero nel form.
export async function peekNextInvoiceNumber(workspaceId: string): Promise<string> {
  const supabase = await createClient()
  const year = new Date().getFullYear()
  const { data } = await supabase
    .from('invoice_sequences')
    .select('last_number')
    .eq('workspace_id', workspaceId)
    .eq('year', year)
    .eq('doc_type', 'fattura')
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

  // Valida voci — filtra prima le righe completamente vuote (descrizione='', prezzo=0, qtà=0)
  // che il form genera di default, così il messaggio "nessuna voce" è sempre corretto.
  let voci: z.infer<typeof VoceSchema>[]
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allItems: any[] = JSON.parse(parsed.data.items_json)
    const meaningfulItems = allItems.filter(v =>
      String(v.description ?? '').trim() !== '' ||
      Number(v.unit_price ?? 0) > 0 ||
      Number(v.quantity ?? 0) > 0
    )
    if (meaningfulItems.length === 0) {
      return { error: 'Il preventivo non ha voci. Aggiungi almeno una voce prima di salvare o inviare.' }
    }
    const combinationErr = vociCombinationMessage(meaningfulItems)
    if (combinationErr) return { error: combinationErr }
    const voceList = z.array(VoceSchema).safeParse(meaningfulItems)
    if (!voceList.success) return { error: voceZodMessage(voceList.error.issues) }
    voci = voceList.data
  } catch {
    return { error: 'Formato voci non valido' }
  }

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
    option_tier: v.option_tier ?? null,
    total: 0,
    ai_generated: false,
    ai_confidence: null,
  }))

  const fiscal = calcolaDocumento(itemsForCalc, fiscalOpts)

  // Opzioni a livelli (041): i totali del DOCUMENTO seguono la proposta
  // consigliata (fallback Base) — le voci restano tutte, con il loro tier.
  const optionsCfg = parseOptionsFields(parsed.data, workspace.plan !== 'free')
  const docTierItems = optionsCfg.enabled
    ? itemsForCalc.filter((i) => (i.option_tier ?? 'base') === (optionsCfg.recommended ?? 'base'))
    : itemsForCalc
  const fiscalDoc = optionsCfg.enabled && docTierItems.length > 0
    ? calcolaDocumento(docTierItems, fiscalOpts)
    : fiscal

  // Snapshot template — sempre salvato (Classico se nessun template scelto)
  const templateSnapshot = await resolveTemplateSnapshot(
    supabase, workspace.id, parsed.data.template_id || null
  )

  // Assegnazione numero documento (scelta prodotto sessione 26):
  // il numero viene assegnato SUBITO alla creazione, anche per le bozze.
  // - override manuale valido → usato così com'è
  // - altrimenti → allocato dalla sequenza (sia per "Salva bozza" sia per "Invia")
  const docNumberOverride = parsed.data.doc_number?.trim()
  let docNumber: string | null = null
  if (docNumberOverride && DOC_NUMBER_RE.test(docNumberOverride)) {
    docNumber = docNumberOverride
  } else {
    try {
      docNumber = await allocateDocNumber(workspace.id)
    } catch {
      return { error: 'Impossibile assegnare il numero progressivo al documento. Riprova tra qualche secondo.' }
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
      client_id: parsed.data.client_id || undefined,
      template_snapshot: templateSnapshot as unknown as Json,
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
      subtotal: fiscalDoc.subtotal,
      tax_amount: fiscalDoc.taxAmount,
      bollo_amount: fiscalDoc.bollo,
      total: fiscalDoc.total,
      expires_at: expiresAt.toISOString(),
    })
    .select('id')
    .single()

  if (docError || !doc) {
    // 23505 = unique_violation: numero documento già esistente per questo workspace
    if ((docError as { code?: string } | null)?.code === '23505') {
      return { error: `Il numero ${docNumber} è già in uso. Modificalo e riprova.` }
    }
    return { error: 'Impossibile salvare il preventivo. Riprova tra qualche istante.' }
  }

  // Acconto (038) + Opzioni a livelli (041) — update separati, tolleranti
  await applyDepositAndOptions(supabase, doc.id, parseDepositFields(parsed.data), optionsCfg, {
    alwaysWriteDeposit: false, // insert appena creato: le colonne sono già null
  })

  // Inserisci voci
  // option_tier (041): passa attraverso calcolaDocumento (spread) — cast
  // perché la colonna non è ancora in types/database.ts
  const items = fiscal.itemTotals.map((item, i) => ({
    document_id: doc.id,
    sort_order: i,
    description: item.description,
    unit: item.unit ?? 'pz',
    quantity: item.quantity,
    unit_price: item.unit_price,
    discount_pct: item.discount_pct ?? null,
    vat_rate: item.vat_rate ?? null,
    bonus_tipo: item.bonus_tipo ?? null,
    option_tier: (item as { option_tier?: string | null }).option_tier ?? null,
    total: item.total,
  })) as unknown as DocumentItemInsert[]

  const { error: itemsError } = await supabase
    .from('document_items')
    .insert(items)

  if (itemsError) {
    // Rollback documento
    await supabase.from('documents').delete().eq('id', doc.id)
    return { error: 'Impossibile salvare le voci del documento. Riprova.' }
  }

  revalidatePath('/preventivi')
  const intent = formData.get('intent')
  if (intent === 'save_draft') {
    // Il numero assegnato viaggia nel param → DraftSavedBanner lo mostra nel pop-up
    redirect(`/preventivi?bozza=${encodeURIComponent(docNumber ?? '1')}`)
  }
  if (intent === 'send') {
    redirect(`/preventivi/${doc.id}?send=1`)
  }
  redirect(`/preventivi/${doc.id}`)
}

// ── itemsSignature ────────────────────────────────────────────────────────
// Costruisce una "firma" normalizzata della lista voci, nell'ordine
// (sort_order/posizione), per rilevare QUALSIASI modifica visibile al
// cliente: descrizione, unità, quantità, prezzo, sconto, IVA, e ordine righe.
// Usata da updateDocumentAction e saveDraftAction per estendere
// publicFieldsChanged anche ai cambi che non alterano il totale (CHECK-3:
// es. cambiare solo la descrizione o l'unità di misura di una voce).
function itemsSignature(
  items: Array<{
    description?: unknown
    unit?: unknown
    quantity?: unknown
    unit_price?: unknown
    discount_pct?: unknown
    vat_rate?: unknown
  }>
): string {
  return items
    .map((it) => [
      String(it.description ?? '').trim(),
      String(it.unit ?? '').trim(),
      Number(it.quantity ?? 0),
      Number(it.unit_price ?? 0),
      it.discount_pct === null || it.discount_pct === undefined ? '' : Number(it.discount_pct),
      it.vat_rate === null || it.vat_rate === undefined ? '' : Number(it.vat_rate),
    ].join('|'))
    .join('::')
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
    .select('id, fiscal_regime, bollo_auto, ritenuta_auto, plan')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!workspace) return { error: 'Workspace non trovato' }

  // Verifica documento appartiene al workspace e legge i campi necessari per
  // determinare se impostare updated_after_send_at (come saveDraftAction).
  const { data: existingDoc } = await supabase
    .from('documents')
    .select('id, status, doc_number, doc_type, document_log, sent_snapshot, title, notes, discount_pct, discount_fixed, vat_rate_default, validity_days, payment_terms, bonus_edilizio, total')
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allItems: any[] = JSON.parse(parsed.data.items_json)
    const meaningfulItems = allItems.filter(v =>
      String(v.description ?? '').trim() !== '' ||
      Number(v.unit_price ?? 0) > 0 ||
      Number(v.quantity ?? 0) > 0
    )
    if (meaningfulItems.length === 0) {
      return { error: 'Il preventivo non ha voci. Aggiungi almeno una voce prima di salvare o inviare.' }
    }
    const voceList = z.array(VoceSchema).safeParse(meaningfulItems)
    if (!voceList.success) return { error: voceZodMessage(voceList.error.issues) }
    voci = voceList.data
  } catch {
    return { error: 'Formato voci non valido' }
  }

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
    option_tier: v.option_tier ?? null,
    total: 0,
    ai_generated: false,
    ai_confidence: null,
  }))

  const fiscal = calcolaDocumento(itemsForCalc, fiscalOpts)

  // Opzioni a livelli (041): i totali del DOCUMENTO seguono la proposta
  // consigliata (fallback Base) — le voci restano tutte, con il loro tier.
  const optionsCfg = parseOptionsFields(parsed.data, workspace.plan !== 'free')
  const docTierItems = optionsCfg.enabled
    ? itemsForCalc.filter((i) => (i.option_tier ?? 'base') === (optionsCfg.recommended ?? 'base'))
    : itemsForCalc
  const fiscalDoc = optionsCfg.enabled && docTierItems.length > 0
    ? calcolaDocumento(docTierItems, fiscalOpts)
    : fiscal

  const validityDays = parsed.data.validity_days ?? 30

  // expires_at: ricalcolato solo per le bozze.
  // Per documenti già inviati (sent/viewed) la scadenza NON cambia al salvataggio:
  // riparte solo quando il documento viene reinviato al cliente.
  const isSentOrViewed = existingDoc.status === 'sent' || existingDoc.status === 'viewed'
  const expiresAt = isSentOrViewed
    ? null  // non aggiornare (usiamo il valore attuale nel DB)
    : (() => { const d = new Date(); d.setDate(d.getDate() + validityDays); return d })()

  // Numero: usa quello dal form (eventuale modifica manuale) oppure mantieni l'esistente
  const docNumberNew = parsed.data.doc_number?.trim() || existingDoc.doc_number

  // Snapshot template aggiornato se l'utente ha cambiato il template
  const updatedTemplateSnapshot = parsed.data.template_id !== undefined
    ? await resolveTemplateSnapshot(supabase, workspace.id, parsed.data.template_id || null)
    : undefined

  const { error: docError } = await supabase
    .from('documents')
    .update({
      // '' → null: rimuove esplicitamente il cliente se deselezionato nel form
      client_id: parsed.data.client_id || null,
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
      subtotal: fiscalDoc.subtotal,
      tax_amount: fiscalDoc.taxAmount,
      bollo_amount: fiscalDoc.bollo,
      total: fiscalDoc.total,
      ...(expiresAt ? { expires_at: expiresAt.toISOString() } : {}),
      updated_at: new Date().toISOString(),
      ...(updatedTemplateSnapshot !== undefined
        ? { template_snapshot: updatedTemplateSnapshot as unknown as Json }
        : {}),
    })
    .eq('id', documentId)
    .eq('workspace_id', workspace.id)

  if (docError) {
    if ((docError as { code?: string }).code === '23505') {
      return { error: `Il numero ${docNumberNew} è già in uso. Modificalo e riprova.` }
    }
    return { error: 'Impossibile aggiornare il documento. Riprova tra qualche istante.' }
  }

  // Acconto (038) + Opzioni a livelli (041) — update separati, tolleranti.
  // Sempre eseguiti: azzerano i campi se i toggle sono stati spenti nel form.
  await applyDepositAndOptions(supabase, documentId, parseDepositFields(parsed.data), optionsCfg, {
    workspaceId: workspace.id,
  })

  // ── Snapshot retroattivo PRIMA del delete (usa dati originali) ──────────
  // Lo snapshot deve catturare lo stato PRE-modifica, non quello nuovo.
  // Leggiamo le voci originali QUI (prima del delete) sia per il confronto
  // "voci cambiate" (CHECK-3) sia per l'eventuale snapshot retroattivo.
  const wasAlreadySent = existingDoc.status === 'sent' || existingDoc.status === 'viewed'

  let originalItems: Array<{ sort_order: number; description: string; unit: string | null; quantity: number; unit_price: number; discount_pct: number | null; vat_rate: number | null; bonus_tipo: string | null; total: number }> | null = null
  if (wasAlreadySent) {
    const { data } = await supabase
      .from('document_items')
      .select('sort_order, description, unit, quantity, unit_price, discount_pct, vat_rate, bonus_tipo, total')
      .eq('document_id', documentId)
      .order('sort_order')
    originalItems = data
  }

  const itemsChanged = wasAlreadySent
    && itemsSignature(originalItems ?? []) !== itemsSignature(fiscal.itemTotals)

  const publicFieldsChanged = wasAlreadySent && (
    (parsed.data.title ?? '') !== (existingDoc.title ?? '') ||
    (parsed.data.notes ?? '') !== (existingDoc.notes ?? '') ||
    (parsed.data.discount_pct ?? null) !== (existingDoc.discount_pct ?? null) ||
    (parsed.data.discount_fixed ?? null) !== (existingDoc.discount_fixed ?? null) ||
    (parsed.data.vat_rate_default ?? null) !== (existingDoc.vat_rate_default ?? null) ||
    (parsed.data.validity_days ?? 30) !== (existingDoc.validity_days ?? 30) ||
    (parsed.data.payment_terms ?? '30 giorni') !== (existingDoc.payment_terms ?? '30 giorni') ||
    (parsed.data.bonus_edilizio ?? '') !== (existingDoc.bonus_edilizio ?? '') ||
    Math.abs(fiscal.total - ((existingDoc as Record<string, unknown>).total as number ?? 0)) > 0.001 ||
    itemsChanged
  )

  let retroSnapshot: { fields: Record<string, unknown>; items: unknown[] } | null = null
  if (publicFieldsChanged && !(existingDoc as Record<string, unknown>).sent_snapshot) {
    retroSnapshot = {
      fields: {
        title: existingDoc.title, notes: existingDoc.notes,
        discount_pct: existingDoc.discount_pct, discount_fixed: existingDoc.discount_fixed,
        vat_rate_default: existingDoc.vat_rate_default, validity_days: existingDoc.validity_days,
        payment_terms: existingDoc.payment_terms,
      },
      items: originalItems ?? [],
    }
  }

  // Sostituisci tutte le voci
  await supabase.from('document_items').delete().eq('document_id', documentId)

  // option_tier (041): passa attraverso calcolaDocumento (spread) — cast
  // perché la colonna non è ancora in types/database.ts
  const items = fiscal.itemTotals.map((item, i) => ({
    document_id: documentId,
    sort_order: i,
    description: item.description,
    unit: item.unit ?? 'pz',
    quantity: item.quantity,
    unit_price: item.unit_price,
    discount_pct: item.discount_pct ?? null,
    vat_rate: item.vat_rate ?? null,
    bonus_tipo: item.bonus_tipo ?? null,
    option_tier: (item as { option_tier?: string | null }).option_tier ?? null,
    total: item.total,
  })) as unknown as DocumentItemInsert[]

  const { error: itemsError } = await supabase
    .from('document_items')
    .insert(items)

  if (itemsError) return { error: 'Impossibile salvare le voci del documento. Riprova.' }

  // Imposta updated_after_send_at
  if (publicFieldsChanged) {
      const now = new Date().toISOString()
      const currentLog = Array.isArray(existingDoc.document_log)
        ? existingDoc.document_log as Array<{ type: string; at: string }>
        : []

      await supabase
        .from('documents')
        .update({
          updated_after_send_at: now,
          document_log: [...currentLog, { type: 'modified', at: now }] as unknown as Json,
          ...(retroSnapshot ? { sent_snapshot: retroSnapshot as unknown as Json } : {}),
        })
        .eq('id', documentId)
        .eq('workspace_id', workspace.id)
  }

  const baseRoute = existingDoc.doc_type === 'fattura' ? '/fatture' : '/preventivi'
  revalidatePath('/preventivi')
  revalidatePath(`/preventivi/${documentId}`)
  revalidatePath('/fatture')
  revalidatePath(`/fatture/${documentId}`)
  revalidatePath('/dashboard')
  redirect(`${baseRoute}/${documentId}`)
}

// ── saveDraftAction (auto-save) ───────────────────────────────────────────
// Usata dall'auto-save ogni 30s — non fa redirect

export async function saveDraftAction(
  documentId: string,
  formData: FormData
): Promise<{ error?: string; ok?: boolean; wasAlreadySent?: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato' }

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, fiscal_regime, plan')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!workspace) return { error: 'Workspace non trovato' }

  const { data: existingDoc } = await supabase
    .from('documents')
    .select('id, status, doc_number, doc_type, document_log, sent_snapshot, title, notes, internal_notes, discount_pct, discount_fixed, vat_rate_default, validity_days, payment_terms, bonus_edilizio, client_id, total')
    .eq('id', documentId)
    .eq('workspace_id', workspace.id)
    .maybeSingle()
  if (!existingDoc || existingDoc.status === 'accepted') return { error: 'Documento non modificabile' }

  // Se il documento è già stato inviato ma non ha ancora uno snapshot,
  // lo creiamo adesso dai dati correnti (prima di sovrascriverli).
  const wasAlreadySent = existingDoc.status === 'sent' || existingDoc.status === 'viewed'
  let snapshotToCreate: { fields: Record<string, unknown>; items: unknown[] } | null = null
  // Voci ORIGINALI lette PRIMA del delete — servono sia per l'eventuale
  // snapshot retroattivo sia per rilevare modifiche voce-per-voce (CHECK-3:
  // descrizione/unità che non cambiano il totale ma vanno comunque segnalate).
  let originalItemsForCompare: Array<{ description?: unknown; unit?: unknown; quantity?: unknown; unit_price?: unknown; discount_pct?: unknown; vat_rate?: unknown }> | null = null
  if (wasAlreadySent) {
    const { data: currentItems } = await supabase
      .from('document_items')
      .select('sort_order, description, unit, quantity, unit_price, discount_pct, vat_rate, bonus_tipo, total')
      .eq('document_id', documentId)
      .order('sort_order')
    originalItemsForCompare = currentItems ?? []
    if (!existingDoc.sent_snapshot) {
      snapshotToCreate = {
        fields: {
          title:            existingDoc.title,
          notes:            existingDoc.notes,
          internal_notes:   existingDoc.internal_notes,
          discount_pct:     existingDoc.discount_pct,
          discount_fixed:   existingDoc.discount_fixed,
          vat_rate_default: existingDoc.vat_rate_default,
          validity_days:    existingDoc.validity_days,
          payment_terms:    existingDoc.payment_terms,
        },
        items: currentItems ?? [],
      }
    }
  }

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

  // Opzioni a livelli (041): i totali del DOCUMENTO seguono la proposta
  // consigliata (fallback Base) — le voci restano tutte, con il loro tier.
  const optionsCfg = parseOptionsFields(parsed.data, workspace.plan !== 'free')

  let fiscal = {
    subtotal: 0, taxAmount: 0, bollo: 0, total: 0,
    itemTotals: [] as ReturnType<typeof calcolaDocumento>['itemTotals'],
  }
  let docTotals = { subtotal: 0, taxAmount: 0, bollo: 0, total: 0 }
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
      option_tier: v.option_tier ?? null,
      total: 0,
      ai_generated: false,
      ai_confidence: null,
    }))
    const result = calcolaDocumento(itemsForCalc, fiscalOpts)
    // FIX: usa itemTotals calcolati (prima era [] — non salvava le voci)
    fiscal = { subtotal: result.subtotal, taxAmount: result.taxAmount, bollo: result.bollo, total: result.total, itemTotals: result.itemTotals }
    const docTierItems = optionsCfg.enabled
      ? itemsForCalc.filter((i) => (i.option_tier ?? 'base') === (optionsCfg.recommended ?? 'base'))
      : itemsForCalc
    const resultDoc = optionsCfg.enabled && docTierItems.length > 0
      ? calcolaDocumento(docTierItems, fiscalOpts)
      : result
    docTotals = { subtotal: resultDoc.subtotal, taxAmount: resultDoc.taxAmount, bollo: resultDoc.bollo, total: resultDoc.total }
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

  // Snapshot template — salva se l'utente ha scelto un template (anche Classico = "")
  const draftTemplateSnapshot = parsed.data.template_id !== undefined
    ? await resolveTemplateSnapshot(supabase, workspace.id, parsed.data.template_id || null)
    : undefined

  await supabase
    .from('documents')
    .update({
      // '' → null: rimuove esplicitamente il cliente se deselezionato nel form
      client_id: parsed.data.client_id || null,
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
      // Totali aggiornati solo se le voci sono valide: un parse fallito
      // durante la digitazione non deve azzerare i totali lasciando le
      // voci vecchie nel DB.
      ...(voci.length > 0
        ? {
            subtotal: docTotals.subtotal,
            tax_amount: docTotals.taxAmount,
            bollo_amount: docTotals.bollo,
            total: docTotals.total,
          }
        : {}),
      expires_at: expiresAt.toISOString(),
      // NON aggiorniamo updated_at nell'auto-save: evita che il documento
      // salga in cima alla lista ogni 30 secondi anche senza modifiche reali.
      // updated_at viene aggiornato solo da updateDocumentAction (salvataggio esplicito).
      ...(draftTemplateSnapshot !== undefined
        ? { template_snapshot: draftTemplateSnapshot as unknown as Json }
        : {}),
    })
    .eq('id', documentId)
    .eq('workspace_id', workspace.id)

  // Acconto (038) + Opzioni a livelli (041) — update separati, tolleranti.
  // Sempre eseguiti: azzerano i campi se i toggle sono stati spenti nel form.
  await applyDepositAndOptions(supabase, documentId, parseDepositFields(parsed.data), optionsCfg, {
    workspaceId: workspace.id,
  })

  // Salva le voci se presenti.
  // Se le voci non sono valide (lista vuota), lascia invariate le voci esistenti (tollerante).
  if (fiscal.itemTotals.length > 0) {
    await supabase.from('document_items').delete().eq('document_id', documentId)
    // option_tier (041): passa attraverso calcolaDocumento (spread) — cast
    // perché la colonna non è ancora in types/database.ts
    const items = fiscal.itemTotals.map((item, i) => ({
      document_id: documentId,
      sort_order: i,
      description: item.description,
      unit: item.unit ?? 'pz',
      quantity: item.quantity,
      unit_price: item.unit_price,
      discount_pct: item.discount_pct ?? null,
      vat_rate: item.vat_rate ?? null,
      bonus_tipo: item.bonus_tipo ?? null,
      option_tier: (item as { option_tier?: string | null }).option_tier ?? null,
      total: item.total,
    })) as unknown as DocumentItemInsert[]
    await supabase.from('document_items').insert(items)
  }

  // Se il documento era già stato inviato, aggiorna updated_after_send_at SOLO se
  // cambiano campi visibili al cliente (non solo client_id o note interne).
  // Campi che NON attivano il banner: client_id, internal_notes.
  // Campi che attivano il banner: titolo, note, sconti, IVA default, validità,
  //   termini pagamento, bonus edilizio, e qualsiasi variazione del totale.
  if (wasAlreadySent) {
    // CHECK-3: confronta anche le voci riga per riga (descrizione, unità,
    // quantità, prezzo, sconto, IVA, ordine) — non solo il totale aggregato,
    // altrimenti cambi che non alterano il totale (es. sola descrizione)
    // non facevano comparire il badge "Modificato".
    // Le voci nel DB vengono sostituite SOLO se fiscal.itemTotals non è vuoto
    // (vedi sotto "Salva le voci se presenti" — tollerante su submit invalidi).
    // Se non sostituite, le voci restano quelle originali → nessuna modifica.
    const itemsChangedDraft = fiscal.itemTotals.length > 0
      && itemsSignature(originalItemsForCompare ?? []) !== itemsSignature(fiscal.itemTotals)

    const publicFieldsChanged =
      (parsed.data.title ?? '') !== (existingDoc.title ?? '') ||
      (parsed.data.notes ?? '') !== (existingDoc.notes ?? '') ||
      (parsed.data.discount_pct ?? null) !== (existingDoc.discount_pct ?? null) ||
      (parsed.data.discount_fixed ?? null) !== (existingDoc.discount_fixed ?? null) ||
      (parsed.data.vat_rate_default ?? null) !== (existingDoc.vat_rate_default ?? null) ||
      (parsed.data.validity_days ?? 30) !== (existingDoc.validity_days ?? 30) ||
      (parsed.data.payment_terms ?? '30 giorni') !== (existingDoc.payment_terms ?? '30 giorni') ||
      (parsed.data.bonus_edilizio ?? '') !== (existingDoc.bonus_edilizio ?? '') ||
      (fiscal.itemTotals.length > 0 &&
        Math.abs(docTotals.total - ((existingDoc as Record<string, unknown>).total as number ?? 0)) > 0.001) ||
      itemsChangedDraft

    const now = new Date().toISOString()
    const currentLog = Array.isArray(existingDoc.document_log) ? existingDoc.document_log as Array<{type: string; at: string}> : []
    const newLog = publicFieldsChanged
      ? [...currentLog, { type: 'modified', at: now }]
      : currentLog

    await supabase
      .from('documents')
      .update({
        ...(publicFieldsChanged ? { updated_after_send_at: now } : {}),
        document_log: newLog as unknown as Json,
        ...(snapshotToCreate ? { sent_snapshot: snapshotToCreate as unknown as Json } : {}),
      })
      .eq('id', documentId)
      .eq('workspace_id', workspace.id)
  }

  revalidatePath(`/preventivi/${documentId}`)
  return { ok: true, wasAlreadySent }
}

// ── restoreToSentVersionAction ────────────────────────────────────────────
// Ripristina il documento alla versione snapshot dell'ultimo invio,
// annullando tutte le modifiche successive.

export async function restoreToSentVersionAction(
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
    .select('id, workspace_id, status, sent_snapshot, updated_after_send_at, document_log')
    .eq('id', documentId)
    .eq('workspace_id', workspace.id)
    .maybeSingle()

  if (!doc) return { error: 'Documento non trovato' }
  if (!doc.sent_snapshot) return { error: 'Nessuno snapshot disponibile per il ripristino' }

  const snap = doc.sent_snapshot as { fields: Record<string, unknown>; items: unknown[] }

  // Cancella tutte le voci correnti
  await supabase.from('document_items').delete().eq('document_id', documentId)

  // Re-inserisce le voci dello snapshot
  if (Array.isArray(snap.items) && snap.items.length > 0) {
    const itemsToInsert = (snap.items as Array<Record<string, unknown>>).map((item) => ({
      document_id: documentId,
      sort_order:   (item.sort_order  as number)  ?? 0,
      description:  (item.description as string)  ?? '',
      unit:         (item.unit        as string)  ?? 'pz',
      quantity:     (item.quantity    as number)  ?? 0,
      unit_price:   (item.unit_price  as number)  ?? 0,
      discount_pct: (item.discount_pct as number | null) ?? null,
      vat_rate:     (item.vat_rate    as number | null) ?? null,
      bonus_tipo:   (item.bonus_tipo  as string | null) ?? null,
      total:        (item.total       as number)  ?? 0,
    }))
    await supabase.from('document_items').insert(itemsToInsert)
  }

  // Aggiunge evento "restored" al log usando il valore già letto nel doc iniziale
  const now = new Date().toISOString()
  const currentLog = Array.isArray(doc.document_log) ? doc.document_log as Array<{type: string; at: string}> : []
  const newLog = [...currentLog, { type: 'restored', at: now }]

  // Ripristina i campi del documento dallo snapshot
  await supabase
    .from('documents')
    .update({
      title:            (snap.fields.title            as string | null) ?? null,
      notes:            (snap.fields.notes            as string | null) ?? null,
      internal_notes:   (snap.fields.internal_notes   as string | null) ?? null,
      discount_pct:     (snap.fields.discount_pct     as number | null) ?? null,
      discount_fixed:   (snap.fields.discount_fixed   as number | null) ?? null,
      vat_rate_default: (snap.fields.vat_rate_default as number | null) ?? null,
      validity_days:    (snap.fields.validity_days    as number)        ?? 30,
      payment_terms:    (snap.fields.payment_terms    as string | null) ?? null,
      updated_after_send_at: null,
      updated_at: now,
      document_log: newLog as unknown as Json,
    })
    .eq('id', documentId)
    .eq('workspace_id', workspace.id)

  revalidatePath('/preventivi')
  revalidatePath(`/preventivi/${documentId}`)
  revalidatePath('/fatture')
  revalidatePath(`/fatture/${documentId}`)
  return { ok: true }
}

// ── deleteDocumentAction ──────────────────────────────────────────────────
// Soft delete: imposta deleted_at invece di cancellare fisicamente.
// Il documento rimane recuperabile dal cestino per 15 giorni.

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
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', documentId)
    .eq('workspace_id', workspace.id)

  if (error) return { error: 'Errore durante l\'eliminazione' }

  revalidatePath('/preventivi')
  revalidatePath('/fatture')
  revalidatePath('/cestino')
  redirect(docMeta?.doc_type === 'fattura' ? '/fatture' : '/preventivi')
}

// ── restoreDocumentAction ─────────────────────────────────────────────────
// Recupera un documento dal cestino ripristinando deleted_at a NULL.

export async function restoreDocumentAction(
  documentId: string
): Promise<{ error?: string; numberConflict?: boolean }> {
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
    .update({ deleted_at: null })
    .eq('id', documentId)
    .eq('workspace_id', workspace.id)

  if (error) return { error: 'Errore nel ripristino' }

  revalidatePath('/preventivi')
  revalidatePath('/fatture')
  revalidatePath('/cestino')
  return {}
}

// ── purgeDeletedDocumentAction ────────────────────────────────────────────
// Hard delete definitivo (usato dal cron e dal cestino per cancellazione esplicita).

export async function purgeDeletedDocumentAction(
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
    .not('deleted_at', 'is', null) // sicurezza: purge solo se già nel cestino

  if (error) return { error: 'Errore durante la cancellazione definitiva' }

  revalidatePath('/cestino')
  return {}
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
    .select('id, status, total, client_id, doc_number, validity_days, pdf_downloaded_at, title, notes, internal_notes, discount_pct, discount_fixed, vat_rate_default, payment_terms, document_items(*)')
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

  // Costruisci lo snapshot per il ripristino futuro
  const sentSnapshot = {
    fields: {
      title:            doc.title ?? null,
      notes:            doc.notes ?? null,
      internal_notes:   doc.internal_notes ?? null,
      discount_pct:     doc.discount_pct ?? null,
      discount_fixed:   doc.discount_fixed ?? null,
      vat_rate_default: doc.vat_rate_default ?? null,
      validity_days:    doc.validity_days ?? 30,
      payment_terms:    doc.payment_terms ?? null,
    },
    items: (doc as Record<string, unknown>).document_items ?? [],
  }

  // Invalida la cache PDF (il documento passa da bozza a inviato — watermark rimosso)
  const { error } = await supabase
    .from('documents')
    .update({
      status: 'sent',
      sent_at: sentAt.toISOString(),
      doc_number: finalDocNumber,
      expires_at: expiresAt.toISOString(),
      pdf_url: null, // invalida cache PDF — verrà rigenerato senza watermark
      sent_snapshot: sentSnapshot as unknown as Json,
      updated_after_send_at: null,
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
  documentId: string,
  sentAtParam?: string,   // ISO date string (YYYY-MM-DD) — se omesso usa oggi
  docTypeHint?: 'preventivo' | 'fattura'  // opzionale — usato per scegliere la sequenza corretta
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
    .select('id, doc_type, status, total, pdf_downloaded_at, doc_number, validity_days, title, notes, internal_notes, discount_pct, discount_fixed, vat_rate_default, payment_terms, document_items(*)')
    .eq('id', documentId)
    .eq('workspace_id', workspace.id)
    .maybeSingle()

  if (!doc) return { error: 'Documento non trovato' }
  if (doc.status !== 'draft') return { error: 'Solo le bozze possono essere registrate come inviate' }
  if ((doc.total ?? 0) === 0) return { error: 'Il preventivo non ha voci salvate. Salva le modifiche prima di condividere.' }

  // Determina il tipo documento (dalla query o dall'hint del chiamante)
  const isFattura = (docTypeHint ?? (doc as Record<string, unknown>).doc_type) === 'fattura'

  // Assegna numero progressivo se non ancora assegnato, usando la sequenza corretta
  let finalDocNumber = doc.doc_number
  if (!finalDocNumber) {
    try {
      finalDocNumber = isFattura
        ? await allocateInvoiceNumber(workspace.id)
        : await allocateDocNumber(workspace.id)
    } catch {
      return { error: 'Impossibile generare il numero documento. Riprova.' }
    }
  }

  // sentAtParam può essere una data scelta dall'utente (YYYY-MM-DD); default: oggi
  const sentAt = sentAtParam
    ? new Date(`${sentAtParam}T12:00:00.000Z`)
    : new Date()
  const validityDays = doc.validity_days ?? 30
  const expiresAt = new Date(sentAt)
  expiresAt.setDate(expiresAt.getDate() + validityDays)

  // Costruisci lo snapshot per il ripristino futuro
  const sentSnapshotManual = {
    fields: {
      title:            doc.title ?? null,
      notes:            doc.notes ?? null,
      internal_notes:   doc.internal_notes ?? null,
      discount_pct:     doc.discount_pct ?? null,
      discount_fixed:   doc.discount_fixed ?? null,
      vat_rate_default: doc.vat_rate_default ?? null,
      validity_days:    doc.validity_days ?? 30,
      payment_terms:    doc.payment_terms ?? null,
    },
    items: (doc as Record<string, unknown>).document_items ?? [],
  }

  const { error } = await supabase
    .from('documents')
    .update({
      status: 'sent',
      sent_at: sentAt.toISOString(),
      doc_number: finalDocNumber,
      expires_at: expiresAt.toISOString(),
      pdf_url: null, // invalida cache PDF — verrà rigenerato senza watermark
      sent_snapshot: sentSnapshotManual as unknown as Json,
      updated_after_send_at: null,
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

  // Revalida i path corretti in base al tipo documento
  if (isFattura) {
    revalidatePath('/fatture')
    revalidatePath(`/fatture/${documentId}`)
  } else {
    revalidatePath('/preventivi')
    revalidatePath(`/preventivi/${documentId}`)
  }
  revalidatePath('/dashboard')
  return { ok: true, docNumber: finalDocNumber }
}

// ── resendExpiredAction ───────────────────────────────────────────────────
// Rinvia un preventivo scaduto: reimposta la scadenza (oggi + giorni scelti
// dall'utente) e riporta lo stato a 'sent'. NON consuma quota Free (già contata
// al primo invio).
export async function resendExpiredAction(
  documentId: string,
  validityDays: number,
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

  const days = Number.isFinite(validityDays) && validityDays > 0 ? Math.floor(validityDays) : 30

  const { data: doc } = await supabase
    .from('documents')
    .select('id, status')
    .eq('id', documentId)
    .eq('workspace_id', workspace.id)
    .is('deleted_at', null)
    .maybeSingle()
  if (!doc) return { error: 'Documento non trovato' }

  const now = new Date()
  const expiresAt = new Date(now)
  expiresAt.setDate(expiresAt.getDate() + days)

  const { error } = await supabase
    .from('documents')
    .update({
      status: 'sent',
      sent_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      validity_days: days,
      updated_after_send_at: null,
      pdf_url: null,
    })
    .eq('id', documentId)
    .eq('workspace_id', workspace.id)
  if (error) return { error: 'Errore durante il rinvio' }

  revalidatePath('/preventivi')
  revalidatePath(`/preventivi/${documentId}`)
  revalidatePath('/dashboard')
  return { ok: true }
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
  revalidatePath('/fatture')
  if (original.doc_type === 'fattura') {
    redirect(`/fatture/${newDoc.id}`)
  } else {
    redirect(`/preventivi/${newDoc.id}`)
  }
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

  // ── Raccoglie tutti gli errori di validazione prima di procedere ──────────
  // Stessa logica di createDocumentAction (preventivi) — messaggi con "fattura".
  const validationErrors: string[] = []

  // 1. Numero fattura obbligatorio
  const docNumberRaw = parsed.data.doc_number?.trim() ?? ''
  if (!docNumberRaw) {
    validationErrors.push('Il numero fattura deve essere inserito.')
  }

  // 2. Valida voci — filtra righe vuote, poi controlla combinazioni campo
  let voci: z.infer<typeof VoceSchema>[] = []
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allItems: any[] = JSON.parse(parsed.data.items_json)
    const meaningfulItems = allItems.filter(v =>
      String(v.description ?? '').trim() !== '' ||
      Number(v.unit_price ?? 0) > 0 ||
      Number(v.quantity ?? 0) > 0
    )
    if (meaningfulItems.length === 0) {
      validationErrors.push('La fattura non ha voci. Aggiungi almeno una voce prima di salvare.')
    } else {
      const noDesc  = meaningfulItems.some(v => String(v.description ?? '').trim() === '')
      const noPrice = meaningfulItems.some(v => Number(v.unit_price ?? 0) === 0)
      const noQty   = meaningfulItems.some(v => Number(v.quantity ?? 0) === 0)
      let voceErr: string | null = null
      if (noDesc && noPrice) voceErr = 'La descrizione e il prezzo in una o più voci fattura devono essere diversi da zero per salvare.'
      else if (noDesc && noQty) voceErr = 'La descrizione e la quantità in una o più voci fattura devono essere diversi da zero per salvare.'
      else if (noPrice && noQty) voceErr = 'Il prezzo e la quantità in una o più voci fattura devono essere diversi da zero per salvare.'
      else if (noDesc) voceErr = 'La descrizione in una o più voci fattura deve essere inserita per poter salvare.'
      else if (noPrice) voceErr = 'Il prezzo in una o più voci fattura deve essere diverso da zero per salvare.'
      else if (noQty) voceErr = 'La quantità in una o più voci fattura deve essere diversa da zero per salvare.'
      if (voceErr) {
        validationErrors.push(voceErr)
      } else {
        const voceList = z.array(VoceSchema).safeParse(meaningfulItems)
        if (!voceList.success) {
          const issue = voceList.error.issues[0]
          const field = issue?.path[1] as string | undefined
          let msg = issue?.message ?? 'Dati voce non validi.'
          if (field === 'description') msg = 'La descrizione in una o più voci fattura deve essere inserita per poter salvare.'
          if (field === 'quantity')    msg = 'La quantità in una o più voci fattura deve essere diversa da zero per salvare.'
          if (field === 'unit_price')  msg = 'Il prezzo in una o più voci fattura deve essere diverso da zero per salvare.'
          validationErrors.push(msg)
        } else {
          voci = voceList.data
        }
      }
    }
  } catch {
    return { error: 'Formato voci non valido' }
  }

  // Restituisce tutti gli errori uniti in un unico messaggio
  if (validationErrors.length > 0) {
    return { error: validationErrors.join(' ') }
  }

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
    option_tier: v.option_tier ?? null,
    total: 0,
    ai_generated: false,
    ai_confidence: null,
  }))

  const fiscal = calcolaDocumento(itemsForCalc, fiscalOpts)

  // Opzioni a livelli (041): i totali del DOCUMENTO seguono la proposta
  // consigliata (fallback Base) — le voci restano tutte, con il loro tier.
  const optionsCfg = parseOptionsFields(parsed.data, workspace.plan !== 'free')
  const docTierItems = optionsCfg.enabled
    ? itemsForCalc.filter((i) => (i.option_tier ?? 'base') === (optionsCfg.recommended ?? 'base'))
    : itemsForCalc
  const fiscalDoc = optionsCfg.enabled && docTierItems.length > 0
    ? calcolaDocumento(docTierItems, fiscalOpts)
    : fiscal

  // Snapshot template — sempre salvato (Classico se nessun template scelto)
  const templateSnapshot = await resolveTemplateSnapshot(
    supabase, workspace.id, parsed.data.template_id || null
  )

  // Numero fattura: alloca formalmente dalla sequenza (incrementa last_number).
  // La peek non incrementa — senza questo passaggio la prossima fattura
  // vedrebbe lo stesso numero nel form, causando un errore di duplicato.
  // Usiamo sempre il numero allocato per garantire unicità.
  let docNumber: string
  try {
    docNumber = await allocateInvoiceNumber(workspace.id)
  } catch {
    return { error: 'Impossibile assegnare il numero progressivo alla fattura. Riprova tra qualche secondo.' }
  }

  // Inserisci documento come fattura
  const { data: doc, error: docError } = await supabase
    .from('documents')
    .insert({
      workspace_id: workspace.id,
      created_by: user.id,
      client_id: parsed.data.client_id || undefined,
      template_snapshot: templateSnapshot as unknown as Json,
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
      subtotal: fiscalDoc.subtotal,
      tax_amount: fiscalDoc.taxAmount,
      bollo_amount: fiscalDoc.bollo,
      total: fiscalDoc.total,
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
  // option_tier (041): passa attraverso calcolaDocumento (spread) — cast
  // perché la colonna non è ancora in types/database.ts
  const items = fiscal.itemTotals.map((item, i) => ({
    document_id: doc.id,
    sort_order: i,
    description: item.description,
    unit: item.unit ?? 'pz',
    quantity: item.quantity,
    unit_price: item.unit_price,
    discount_pct: item.discount_pct ?? null,
    vat_rate: item.vat_rate ?? null,
    bonus_tipo: item.bonus_tipo ?? null,
    option_tier: (item as { option_tier?: string | null }).option_tier ?? null,
    total: item.total,
  })) as unknown as DocumentItemInsert[]

  const { error: itemsError } = await supabase
    .from('document_items')
    .insert(items)

  if (itemsError) {
    await supabase.from('documents').delete().eq('id', doc.id)
    return { error: 'Impossibile salvare le voci del documento. Riprova.' }
  }

  revalidatePath('/fatture')
  revalidatePath(`/fatture/${doc.id}`)

  // Se intent=send → vai al dettaglio con ?send=1 per aprire il dialog invio
  const intent = parsed.data.intent ?? formData.get('intent')
  if (intent === 'send') {
    redirect(`/fatture/${doc.id}?send=1`)
  }
  // Il numero assegnato viaggia nel param → DraftSavedBanner lo mostra nel pop-up
  redirect(`/fatture?bozza=${encodeURIComponent(docNumber)}`)
}

// ── sendReminderAction ────────────────────────────────────────────────────
// Invia un'email di sollecito al cliente per un preventivo in attesa di
// risposta o una fattura in attesa di pagamento (docType 'fattura').

export async function sendReminderAction(
  documentId: string,
  docType: 'preventivo' | 'fattura' = 'preventivo',
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
  if (!['sent', 'viewed'].includes(doc.status)) {
    return {
      error: docType === 'fattura'
        ? 'Solo le fatture in attesa di pagamento possono essere sollecitate'
        : 'Solo i preventivi in attesa di risposta possono essere sollecitati',
    }
  }
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
    : `${appUrl}/${docType === 'fattura' ? 'fatture' : 'preventivi'}/${doc.id}`

  const numClean = doc.doc_number ? doc.doc_number.replace(/^[A-Za-z]+/, '') : ''
  const result = await sendEmail({
    to: client.email,
    subject: docType === 'fattura'
      ? `Promemoria: fattura${numClean ? ` #${numClean}` : ''} in attesa di pagamento`
      : `Promemoria: preventivo${numClean ? ` #${numClean}` : ''} in attesa di risposta`,
    react: createElement(SollecitoClienteEmail, {
      clientName: client.name,
      documentTitle: doc.title ?? '',
      documentNumber: numClean || undefined,
      workspaceName: workspace.ragione_sociale ?? workspace.name,
      publicUrl,
      docType,
    }),
    replyTo: user.email ?? undefined,
  })

  if (!result.success) return { error: result.error ?? 'Errore invio email' }

  await supabase
    .from('documents')
    .update({ last_reminder_at: new Date().toISOString() })
    .eq('id', documentId)

  return { ok: true }
}

// ── linkDocumentAction ────────────────────────────────────────────────────
// Collega (o scollega) manualmente una fattura a un preventivo via
// origin_document_id. Usato da LinkToPreventivoButton nella pagina fattura.

export async function linkDocumentAction(
  fatturaId: string,
  preventivoId: string | null
): Promise<{ error?: string; ok?: boolean; markedAccepted?: boolean }> {
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
    .update({ origin_document_id: preventivoId })
    .eq('id', fatturaId)
    .eq('workspace_id', workspace.id)
    .eq('doc_type', 'fattura')

  if (error) return { error: 'Errore durante il collegamento' }

  // Collegare un preventivo INVIATO/VISTO a una fattura implica che il cliente l'ha accettato:
  // lo segniamo come Accettato (l'utente è avvisato nel dialog di collegamento).
  let markedAccepted = false
  if (preventivoId) {
    const { data: prev } = await supabase
      .from('documents')
      .select('status')
      .eq('id', preventivoId)
      .eq('workspace_id', workspace.id)
      .eq('doc_type', 'preventivo')
      .maybeSingle()

    if (prev && (prev.status === 'sent' || prev.status === 'viewed')) {
      await supabase
        .from('documents')
        .update({ status: 'accepted', accepted_at: new Date().toISOString() })
        .eq('id', preventivoId)
        .eq('workspace_id', workspace.id)
      markedAccepted = true
      revalidatePath(`/preventivi/${preventivoId}`)
      revalidatePath('/preventivi')
    }
  }

  revalidatePath(`/fatture/${fatturaId}`)
  revalidatePath('/fatture')
  return { ok: true, markedAccepted }
}

// ============================================================
// ACCONTI — registra l'acconto ricevuto su un preventivo accettato
// (payment_status 'partial' + paid_amount/paid_at, colonne 038).
// L'incasso entra nelle Entrate del Bilancio (criterio di cassa).
// ============================================================

export async function registerDepositReceivedAction(
  documentId: string,
  amount: number,
  dateYmd?: string
): Promise<{ error?: string; success?: string } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato.' }

  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: 'Importo non valido.' }
  }

  // RLS garantisce che solo i membri del workspace vedano il documento
  const { data: doc } = await supabase
    .from('documents')
    .select('id, doc_type, status, total')
    .eq('id', documentId)
    .maybeSingle()
  if (!doc) return { error: 'Documento non trovato.' }
  // L'acconto ha senso solo su un preventivo accettato — mai su bozze,
  // rifiutati o fatture (che hanno il loro flusso "Segna come pagata").
  if (doc.doc_type !== 'preventivo') return { error: 'Questo documento non è un preventivo.' }
  if (doc.status !== 'accepted') return { error: 'L’acconto si registra solo su un preventivo accettato.' }
  if ((doc.total ?? 0) > 0 && amount > (doc.total ?? 0)) {
    return { error: 'L’importo supera il totale del preventivo.' }
  }

  const paidAtIso = dateYmd && /^\d{4}-\d{2}-\d{2}$/.test(dateYmd)
    ? new Date(`${dateYmd}T12:00:00`).toISOString()
    : new Date().toISOString()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 038 non ancora in types/database.ts
  const { error } = await (supabase as any)
    .from('documents')
    .update({
      payment_status: 'partial',
      paid_amount: Math.round(amount * 100) / 100,
      paid_at: paidAtIso,
    })
    .eq('id', documentId)

  if (error) {
    return { error: 'Registrazione non riuscita. La migration 038 potrebbe non essere ancora applicata.' }
  }

  revalidatePath(`/preventivi/${documentId}`)
  revalidatePath('/preventivi')
  revalidatePath('/bilancio')
  return { success: 'Acconto registrato' }
}
