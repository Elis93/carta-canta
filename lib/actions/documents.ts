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
import { isMissingColumnError } from '@/lib/supabase/errors'
import { tierDuplicateSendError } from '@/lib/documents/tier-check'
import { parseImportoIt } from '@/lib/utils'
import { resolveWorkspaceForUser } from './resolve-workspace'

type DocumentItemInsert = Database['public']['Tables']['document_items']['Insert']

// Guardia: una fattura già TRASMESSA allo SdI (sdi_status non null e ≠ 'scartata')
// non va più modificata — l'XML che il commercialista riscarica divergerebbe da
// quello realmente trasmesso (audit 24 lug). Lettura tollerante: se la colonna
// 044 non esiste (SdI mai attivato), la guardia è trasparente (ritorna false).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function isSdiTransmitted(supabase: any, documentId: string, docType: string | null): Promise<boolean> {
  if (docType !== 'fattura') return false
  const { data, error } = await supabase
    .from('documents').select('sdi_status').eq('id', documentId).maybeSingle()
  if (error) return false // colonna assente / errore transiente → non blocca
  const st = data?.sdi_status as string | null | undefined
  return !!st && st !== 'scartata'
}

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
  if (noDesc && noQty)   return 'Compila la descrizione e una quantità diversa da zero in ogni voce del preventivo per salvare o inviare.'
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


// ── Insert voci TOLLERANTE alla migration 062 (unit_cost) ──────────────────
// Prima che la 062 sia applicata la colonna unit_cost non esiste: l'insert
// fallirebbe (42703/PGRST204) e il documento non si salverebbe più. Qui si
// ritenta senza il campo: il documento si salva comunque, solo senza costi.
async function insertDocumentItemsTollerante(
  supabase: Awaited<ReturnType<typeof createClient>>,
  items: DocumentItemInsert[]
): Promise<{ error: { message: string } | null }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- unit_cost (062) / supplier_list_id (063) non ancora in types/database.ts
  const { error } = await supabase.from('document_items').insert(items as any)
  if (error && (error.code === '42703' || error.code === 'PGRST204' || error.code === '23503')) {
    // Cascata tollerante: prima senza supplier_list_id (colonna 063 assente,
    // O listino cancellato tra la scelta e il salvataggio → FK 23503: la voce
    // si salva comunque, perde solo il collegamento al listino)…
    const senzaListino = items.map((it) => {
      const { supplier_list_id: _sl, ...rest } = it as DocumentItemInsert & { supplier_list_id?: string | null }
      return rest
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- vedi sopra
    const retry1 = await supabase.from('document_items').insert(senzaListino as any)
    if (!retry1.error) return { error: null }
    if (retry1.error.code !== '42703' && retry1.error.code !== 'PGRST204') return { error: retry1.error }
    // …poi anche senza unit_cost (pre-062)
    const stripped = senzaListino.map((it) => {
      const { unit_cost: _drop, ...rest } = it as DocumentItemInsert & { unit_cost?: number | null }
      return rest
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- vedi sopra
    const retry = await supabase.from('document_items').insert(stripped as any)
    return { error: retry.error }
  }
  return { error }
}

// Il listino di una voce (063): si persiste solo se è un UUID plausibile —
// spazzatura dal client diventa null, mai un errore di salvataggio.
const sanitizeSupplierListId = (v?: string | null): string | null =>
  v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v) ? v : null

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
  // Costo d'acquisto (062) — SOLO per il margine privato dell'artigiano.
  // 🔒 Regola B.2: non deve MAI arrivare a superfici viste dal cliente.
  unit_cost: z.number().nonnegative().nullable().optional(),
  // Listino fornitore di origine (063) — per l'aggancio scadenza listino↔preventivo
  supplier_list_id: z.string().nullable().optional(),
})

// Variante per il SALVATAGGIO BOZZA: una bozza può contenere voci ancora da
// completare — prezzo 0 ("da prezzare") e quantità 0 ("da compilare"), come le
// voci proposte dall'AI dalle foto/note. L'invio al cliente resta su VoceSchema.
const VoceDraftSchema = VoceSchema.extend({
  quantity: z.number({ error: 'Quantità non valida' }).nonnegative(),
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
  // 19 lug (Eli): la "Consigliata" (★) è stata rimossa — la proposta di
  // riferimento dei totali di documento è SEMPRE la Base. Il campo resta
  // nella shape (e la colonna nel DB) ma non si legge più dal form: al
  // prossimo salvataggio le stelle legacy vengono azzerate.
  return { enabled, recommended: null }
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
  // Clamp a 100 come fa il form: azzerare qui farebbe SPARIRE l'acconto
  // in silenzio se il client (o un vecchio form) manda 150.
  if (type === 'percent' && val > 100) return { deposit_type: type, deposit_value: 100 }
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
): Promise<string | null> {
  // Ritorna un messaggio d'errore se un update fallisce per un motivo REALE
  // (RLS, rete…): prima QUALSIASI errore era ignorato e l'utente vedeva
  // "salvato" con acconto/opzioni persi. Resta tollerante SOLO alla colonna
  // mancante (migration non applicata).
  const apply = async (payload: Record<string, unknown>): Promise<string | null> => {
    let q = supabase.from('documents').update(payload).eq('id', documentId)
    if (workspaceId) q = q.eq('workspace_id', workspaceId)
    const { error } = await q
    if (error && !isMissingColumnError(error)) {
      return 'Attenzione: acconto o opzioni non salvati. Riapri il documento e riprova.'
    }
    return null
  }
  let err: string | null = null
  if (alwaysWriteDeposit || dep.deposit_type) {
    err = await apply({ deposit_type: dep.deposit_type, deposit_value: dep.deposit_value })
  }
  const err2 = await apply({
    options_enabled: optionsCfg.enabled,
    recommended_tier: optionsCfg.enabled ? optionsCfg.recommended : null,
  })
  return err ?? err2
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
// Un numero scritto A MANO non può coesistere con un altro documento ATTIVO
// dello stesso tipo con lo stesso numero (feedback Eli 17 lug: l'app accettava
// due preventivi entrambi "001/2026"). I documenti nel cestino non contano:
// al ripristino il numero occupato viene già riassegnato. Best-effort: un
// errore transiente della verifica non blocca il salvataggio.
async function manualNumberError(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- client Supabase condiviso dalle action
  supabase: any,
  workspaceId: string,
  docType: string,
  docNumber: string,
  excludeId?: string,
): Promise<string | null> {
  let q = supabase
    .from('documents')
    .select('id, deleted_at')
    .eq('workspace_id', workspaceId)
    .eq('doc_type', docType)
    .eq('doc_number', docNumber)
    .limit(2)
  if (excludeId) q = q.neq('id', excludeId)
  const { data, error } = await q
  if (error || !Array.isArray(data) || data.length === 0) return null
  const tipo = docType === 'fattura' ? 'una fattura' : 'un preventivo'
  // Anche i documenti nel CESTINO tengono occupato il numero (l'indice unico
  // 059 non li esclude): senza dirlo, l'artigiano non vedeva nessun documento
  // con quel numero e non capiva il rifiuto.
  const soloNelCestino = (data as Array<{ deleted_at: string | null }>).every((d) => d.deleted_at !== null)
  if (soloNelCestino) {
    return `Il numero ${docNumber} è ancora occupato da ${tipo} che si trova nel cestino. Svuota quel documento dal cestino, oppure scegli un altro numero.`
  }
  return `Esiste già ${tipo} con il numero ${docNumber}. Scegli un altro numero, oppure lascia il campo vuoto per averlo assegnato in automatico.`
}

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

  const workspace = await resolveWorkspaceForUser(supabase, user.id, 'id, fiscal_regime, bollo_auto, ritenuta_auto, plan, free_trial_expires_at, sent_quota_used')
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
    // 'save_draft' (preventivo) e 'create' (fattura "Salva e apri") producono
    // una BOZZA: prezzi/quantità 0 sono voci "da completare" e si possono
    // salvare (serve solo la descrizione). Con intent 'send' resta tutto severo.
    const intentRaw = String(formData.get('intent') ?? '')
    const isDraftSave = intentRaw === 'save_draft' || intentRaw === 'create'
    const combinationErr = isDraftSave
      ? (meaningfulItems.some((v) => String(v.description ?? '').trim() === '')
          ? 'La descrizione in una o più voci preventivo deve essere inserita per poter salvare la bozza.'
          : null)
      : vociCombinationMessage(meaningfulItems)
    if (combinationErr) return { error: combinationErr }
    const voceList = z.array(isDraftSave ? VoceDraftSchema : VoceSchema).safeParse(meaningfulItems)
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
    unit_cost: v.unit_cost ?? null,
    supplier_list_id: sanitizeSupplierListId(v.supplier_list_id),
    total: 0,
    ai_generated: false,
    ai_confidence: null,
  }))

  const fiscal = calcolaDocumento(itemsForCalc, fiscalOpts)

  // Opzioni a livelli (041): i totali del DOCUMENTO seguono la proposta
  // Base (la ★ Consigliata è stata rimossa il 19 lug) — le voci restano
  // tutte, con il loro tier.
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
    const dupErr = await manualNumberError(supabase, workspace.id, 'preventivo', docNumberOverride)
    if (dupErr) return { error: dupErr }
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

  // Acconto (038) + Opzioni a livelli (041) — update separati, tolleranti.
  // L'eventuale errore NON viene restituito qui: il documento è già stato
  // creato e un "error" farebbe ripetere il submit → documento duplicato.
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
    unit_cost: (item as { unit_cost?: number | null }).unit_cost ?? null,
    supplier_list_id: (item as { supplier_list_id?: string | null }).supplier_list_id ?? null,
    total: item.total,
  })) as unknown as DocumentItemInsert[]

  const { error: itemsError } = await insertDocumentItemsTollerante(supabase, items)

  if (itemsError) {
    // Rollback documento
    await supabase.from('documents').delete().eq('id', doc.id)
    return { error: 'Impossibile salvare le voci del documento. Riprova.' }
  }

  // Foto allegate DAL FORM (richiesta Eli 18 lug: niente più "salva la bozza
  // e poi usa Foto lavoro"). Il client le ha già caricate nello storage
  // work-photos: qui si registrano le righe collegate al documento appena
  // creato. Best-effort: un errore qui non deve far fallire la creazione.
  try {
    const rawPaths = formData.get('photo_paths')
    if (typeof rawPaths === 'string' && rawPaths.trim()) {
      const parsedPaths: unknown = JSON.parse(rawPaths)
      if (Array.isArray(parsedPaths)) {
        // Stesso tetto del caricamento diretto sul piano Free (6 per documento)
        const maxPhotos = workspace.plan === 'free' ? 6 : 40
        const paths = parsedPaths
          .filter((p): p is string => typeof p === 'string' && p.trim() !== '' && !p.includes('..'))
          .slice(0, maxPhotos)
        if (paths.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabella 041 non ancora in types/database.ts
          await (supabase as any).from('work_photos').insert(
            paths.map((p) => ({
              workspace_id: workspace.id,
              storage_path: p,
              document_id: doc.id,
              visible_to_client: false,
            }))
          )
        }
      }
    }
  } catch { /* foto non collegate: non bloccare la creazione */ }

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

  const workspace = await resolveWorkspaceForUser(supabase, user.id, 'id, fiscal_regime, bollo_auto, ritenuta_auto, plan')
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
  if (await isSdiTransmitted(supabase, documentId, existingDoc.doc_type)) {
    return { error: 'Questa fattura è già stata trasmessa allo SdI: non è più modificabile. Per correggerla serve una nota di credito.' }
  }

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
    unit_cost: v.unit_cost ?? null,
    supplier_list_id: sanitizeSupplierListId(v.supplier_list_id),
    total: 0,
    ai_generated: false,
    ai_confidence: null,
  }))

  const fiscal = calcolaDocumento(itemsForCalc, fiscalOpts)

  // Opzioni a livelli (041): i totali del DOCUMENTO seguono la proposta
  // Base (la ★ Consigliata è stata rimossa il 19 lug) — le voci restano
  // tutte, con il loro tier.
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
  // Cambiato A MANO → non deve scontrarsi con un altro documento attivo
  if (docNumberNew && docNumberNew !== existingDoc.doc_number) {
    const dupErr = await manualNumberError(supabase, workspace.id, existingDoc.doc_type, docNumberNew, existingDoc.id)
    if (dupErr) return { error: dupErr }
  }

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
      // '' → null: il titolo svuotato va rimosso (prima restava il vecchio → falso 'Modificato' a ogni salvataggio)
      title: parsed.data.title?.trim() ? parsed.data.title : null,
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
  const depOptErr = await applyDepositAndOptions(supabase, documentId, parseDepositFields(parsed.data), optionsCfg, {
    workspaceId: workspace.id,
  })
  if (depOptErr) return { error: depOptErr }

  // ── Snapshot retroattivo PRIMA del delete (usa dati originali) ──────────
  // Lo snapshot deve catturare lo stato PRE-modifica, non quello nuovo.
  // Leggiamo le voci originali QUI (prima del delete) sia per il confronto
  // "voci cambiate" (CHECK-3) sia per l'eventuale snapshot retroattivo.
  const wasAlreadySent = existingDoc.status === 'sent' || existingDoc.status === 'viewed'

  let originalItems: Array<{ sort_order: number; description: string; unit: string | null; quantity: number; unit_price: number; discount_pct: number | null; vat_rate: number | null; bonus_tipo: string | null; total: number }> | null = null
  if (wasAlreadySent) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- option_tier (041) non ancora in types/database.ts
    const { data } = await (supabase as any)
      .from('document_items')
      .select('sort_order, description, unit, quantity, unit_price, discount_pct, vat_rate, bonus_tipo, option_tier, total')
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

  // Sostituisci tutte le voci — delete CONTROLLATO: se fallisse e si
  // proseguisse, l'insert duplicherebbe le voci esistenti.
  const { error: delItemsErr } = await supabase.from('document_items').delete().eq('document_id', documentId)
  if (delItemsErr) return { error: 'Impossibile aggiornare le voci del documento. Riprova.' }

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
    unit_cost: (item as { unit_cost?: number | null }).unit_cost ?? null,
    supplier_list_id: (item as { supplier_list_id?: string | null }).supplier_list_id ?? null,
    total: item.total,
  })) as unknown as DocumentItemInsert[]

  const { error: itemsError } = await insertDocumentItemsTollerante(supabase, items)

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

  const workspace = await resolveWorkspaceForUser(supabase, user.id, 'id, fiscal_regime, plan')
  if (!workspace) return { error: 'Workspace non trovato' }

  const { data: existingDoc } = await supabase
    .from('documents')
    .select('id, status, doc_number, doc_type, document_log, sent_snapshot, title, notes, internal_notes, discount_pct, discount_fixed, vat_rate_default, validity_days, payment_terms, bonus_edilizio, client_id, total')
    .eq('id', documentId)
    .eq('workspace_id', workspace.id)
    .maybeSingle()
  if (!existingDoc || existingDoc.status === 'accepted') return { error: 'Documento non modificabile' }
  if (await isSdiTransmitted(supabase, documentId, existingDoc.doc_type)) {
    return { error: 'Questa fattura è già stata trasmessa allo SdI: non è più modificabile. Per correggerla serve una nota di credito.' }
  }

  // Se il documento è già stato inviato ma non ha ancora uno snapshot,
  // lo creiamo adesso dai dati correnti (prima di sovrascriverli).
  const wasAlreadySent = existingDoc.status === 'sent' || existingDoc.status === 'viewed'
  let snapshotToCreate: { fields: Record<string, unknown>; items: unknown[] } | null = null
  // Voci ORIGINALI lette PRIMA del delete — servono sia per l'eventuale
  // snapshot retroattivo sia per rilevare modifiche voce-per-voce (CHECK-3:
  // descrizione/unità che non cambiano il totale ma vanno comunque segnalate).
  let originalItemsForCompare: Array<{ description?: unknown; unit?: unknown; quantity?: unknown; unit_price?: unknown; discount_pct?: unknown; vat_rate?: unknown }> | null = null
  if (wasAlreadySent) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- option_tier (041) non ancora in types/database.ts
    const { data: currentItems } = await (supabase as any)
      .from('document_items')
      .select('sort_order, description, unit, quantity, unit_price, discount_pct, vat_rate, bonus_tipo, option_tier, total')
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawItems: any[] = JSON.parse(parsed.data.items_json)
    // Come create/update: le righe completamente vuote (la riga "Aggiungi
    // voce" lasciata lì) NON devono far fallire la validazione dell'intero
    // array — altrimenti l'auto-save direbbe ok senza salvare le voci.
    const meaningfulItems = rawItems.filter((v) =>
      String(v.description ?? '').trim() !== '' ||
      Number(v.unit_price ?? 0) > 0 ||
      Number(v.quantity ?? 0) > 0
    )
    // Le BOZZE possono salvare voci incomplete (quantità 0 "da compilare",
    // es. proposte dall'AI dalle foto). Per i documenti già inviati lo schema
    // resta severo: una voce a 0 non deve finire su un documento che il
    // cliente può già vedere.
    const voceSchemaForSave = existingDoc.status === 'draft' ? VoceDraftSchema : VoceSchema
    const voceList = z.array(voceSchemaForSave).safeParse(meaningfulItems)
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
  // Base (la ★ Consigliata è stata rimossa il 19 lug) — le voci restano
  // tutte, con il loro tier.
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
      unit_cost: v.unit_cost ?? null,
      supplier_list_id: sanitizeSupplierListId(v.supplier_list_id),
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
  // expires_at riparte SOLO al (re)invio (decisione bloccata): per i doc già
  // inviati il salvataggio NON tocca la scadenza.
  const draftIsSentOrViewed = existingDoc.status === 'sent' || existingDoc.status === 'viewed'
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
  // Numero cambiato A MANO → non deve scontrarsi con un altro documento attivo
  if (docNumberNew && docNumberNew !== existingDoc.doc_number) {
    const dupErr = await manualNumberError(supabase, workspace.id, existingDoc.doc_type, docNumberNew, existingDoc.id)
    if (dupErr) return { error: dupErr }
  }

  // Snapshot template — salva se l'utente ha scelto un template (anche Classico = "")
  const draftTemplateSnapshot = parsed.data.template_id !== undefined
    ? await resolveTemplateSnapshot(supabase, workspace.id, parsed.data.template_id || null)
    : undefined

  const { error: draftUpdErr } = await supabase
    .from('documents')
    .update({
      // '' → null: rimuove esplicitamente il cliente se deselezionato nel form
      client_id: parsed.data.client_id || null,
      doc_number: docNumberNew,
      // '' → null: il titolo svuotato va rimosso (prima restava il vecchio → falso 'Modificato' a ogni salvataggio)
      title: parsed.data.title?.trim() ? parsed.data.title : null,
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
      ...(draftIsSentOrViewed ? {} : { expires_at: expiresAt.toISOString() }),
      // NON aggiorniamo updated_at nell'auto-save: evita che il documento
      // salga in cima alla lista ogni 30 secondi anche senza modifiche reali.
      // updated_at viene aggiornato solo da updateDocumentAction (salvataggio esplicito).
      ...(draftTemplateSnapshot !== undefined
        ? { template_snapshot: draftTemplateSnapshot as unknown as Json }
        : {}),
    })
    .eq('id', documentId)
    .eq('workspace_id', workspace.id)
  if (draftUpdErr) {
    // MAI dichiarare "Bozza salvata" se l'update è fallito (es. numero duplicato)
    console.error('[saveDraft] update documento fallito:', draftUpdErr.message)
    return { error: 'Salvataggio non riuscito. Controlla il numero documento e riprova.' }
  }

  // Acconto (038) + Opzioni a livelli (041) — update separati, tolleranti.
  // Sempre eseguiti: azzerano i campi se i toggle sono stati spenti nel form.
  const depOptErr = await applyDepositAndOptions(supabase, documentId, parseDepositFields(parsed.data), optionsCfg, {
    workspaceId: workspace.id,
  })
  if (depOptErr) return { error: depOptErr }

  // Salva le voci se presenti.
  // Se le voci non sono valide (lista vuota), lascia invariate le voci esistenti (tollerante).
  if (fiscal.itemTotals.length > 0) {
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
      unit_cost: (item as { unit_cost?: number | null }).unit_cost ?? null,
      supplier_list_id: (item as { supplier_list_id?: string | null }).supplier_list_id ?? null,
      total: item.total,
    })) as unknown as DocumentItemInsert[]
    // INSERT prima della DELETE non è possibile (sort_order/duplicati) →
    // si controllano ENTRAMBI gli errori: se l'insert fallisce dopo la
    // delete, l'utente DEVE saperlo (prima mostrava "salvato" con doc vuoto).
    const { error: delItemsErr } = await supabase.from('document_items').delete().eq('document_id', documentId)
    if (delItemsErr) {
      console.error('[saveDraft] delete voci fallita:', delItemsErr.message)
      return { error: 'Salvataggio delle voci non riuscito. Riprova.' }
    }
    const { error: insItemsErr } = await insertDocumentItemsTollerante(supabase, items)
    if (insItemsErr) {
      console.error('[saveDraft] insert voci fallita:', insItemsErr.message)
      return { error: 'Salvataggio delle voci non riuscito: NON chiudere la pagina e riprova a salvare (le voci sono ancora nel form).' }
    }
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
  // saveDraftAction serve ANCHE le fatture (auto-save del form condiviso):
  // senza questi, lista e dettaglio fattura restavano in cache (review 25 lug #13).
  revalidatePath('/fatture')
  revalidatePath(`/fatture/${documentId}`)
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

  const workspace = await resolveWorkspaceForUser(supabase, user.id, 'id')
  if (!workspace) return { error: 'Workspace non trovato' }

  const { data: doc } = await supabase
    .from('documents')
    .select('id, workspace_id, status, doc_type, sent_snapshot, updated_after_send_at, document_log')
    .eq('id', documentId)
    .eq('workspace_id', workspace.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!doc) return { error: 'Documento non trovato' }
  if (!doc.sent_snapshot) return { error: 'Nessuno snapshot disponibile per il ripristino' }
  // Stesse guardie di updateDocumentAction (review 25 lug #1 trasversale/M3):
  // su un documento ACCETTATO il delete delle voci verrebbe comunque respinto
  // dal trigger 057 ("riprova" all'infinito); su una fattura TRASMESSA allo
  // SdI il ripristino farebbe divergere PDF e pagina pubblica dall'XML.
  if (doc.status === 'accepted') {
    return { error: 'Il documento è stato accettato: le versioni non si possono più ripristinare.' }
  }
  if (await isSdiTransmitted(supabase, documentId, doc.doc_type)) {
    return { error: 'Questa fattura è già stata trasmessa allo SdI: non si può più modificare.' }
  }

  const snap = doc.sent_snapshot as { fields: Record<string, unknown>; items: unknown[] }

  // Cancella tutte le voci correnti — esito CONTROLLATO: se il delete
  // fallisse e si proseguisse, l'insert duplicherebbe le voci.
  const { error: delErr } = await supabase.from('document_items').delete().eq('document_id', documentId)
  if (delErr) return { error: 'Ripristino non riuscito. Riprova tra qualche istante.' }

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
      // option_tier (041): senza, il restore collassava le tre proposte in una
      option_tier:  (item.option_tier as string | null) ?? null,
      total:        (item.total       as number)  ?? 0,
    }))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- option_tier non ancora in types/database.ts
    const { error: insErr } = await supabase.from('document_items').insert(itemsToInsert as any)
    if (insErr) {
      // Le voci correnti sono già state cancellate: dirlo chiaramente,
      // NON fingere il successo (il documento resterebbe senza voci).
      return { error: 'Ripristino incompleto: le voci non sono state reinserite. Riprova subito.' }
    }
  }

  // Aggiunge evento "restored" al log usando il valore già letto nel doc iniziale
  const now = new Date().toISOString()
  const currentLog = Array.isArray(doc.document_log) ? doc.document_log as Array<{type: string; at: string}> : []
  const newLog = [...currentLog, { type: 'restored', at: now }]

  // Ripristina i campi del documento dallo snapshot
  const { error: updErr } = await supabase
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
  if (updErr) return { error: 'Ripristino incompleto: voci ripristinate ma campi non aggiornati. Riprova.' }

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

  const workspace = await resolveWorkspaceForUser(supabase, user.id, 'id')
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

  const workspace = await resolveWorkspaceForUser(supabase, user.id, 'id')
  if (!workspace) return { error: 'Workspace non trovato' }

  const { error } = await supabase
    .from('documents')
    .update({ deleted_at: null })
    .eq('id', documentId)
    .eq('workspace_id', workspace.id)

  if (error) {
    // 23505: un altro documento attivo ha lo stesso numero. Rete di
    // sicurezza — con l'indice 059 non dovrebbe accadere (verificato su PG16:
    // l'indice copre ANCHE i documenti nel cestino, quindi finché il
    // documento è cestinato nessun altro può prendergli il numero), ma il
    // cestino mostrava già il messaggio "numero riassegnato" senza che il
    // server lo producesse mai: meglio un ramo vero che codice morto, e
    // regge anche se un domani l'indice diventasse parziale sul cestino.
    // Si ripristina liberando il numero: l'indice è parziale
    // (WHERE doc_number IS NOT NULL), quindi con numero vuoto non c'è
    // collisione. Lo STATO resta quello di prima: forzare la bozza
    // distruggerebbe un'eventuale accettazione firmata dal cliente.
    if ((error as { code?: string }).code !== '23505') {
      console.error('[restoreDocument] ripristino fallito:', error)
      return { error: 'Errore nel ripristino' }
    }
    const { error: retryErr } = await supabase
      .from('documents')
      .update({ deleted_at: null, doc_number: null })
      .eq('id', documentId)
      .eq('workspace_id', workspace.id)
    if (retryErr) {
      console.error('[restoreDocument] ripristino senza numero fallito:', retryErr)
      return { error: 'Errore nel ripristino' }
    }
    revalidatePath('/preventivi')
    revalidatePath('/fatture')
    revalidatePath('/cestino')
    return { numberConflict: true }
  }

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

  const workspace = await resolveWorkspaceForUser(supabase, user.id, 'id')
  if (!workspace) return { error: 'Workspace non trovato' }

  // Foto del documento — PRIMA del delete: la FK è ON DELETE SET NULL, dopo
  // il delete le righe non sarebbero più rintracciabili. Senza questo blocco
  // le righe restavano orfane e i FILE nel bucket non venivano MAI rimossi
  // (il copy promette l'eliminazione definitiva — vale anche per il GDPR).
  // Le foto che appartengono ANCHE a un sopralluogo restano (vivono lì).
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabella 041 non ancora in types/database.ts
    const db = supabase as any
    const { data: orphanPhotos } = await db
      .from('work_photos')
      .select('id, storage_path')
      .eq('document_id', documentId)
      .is('sopralluogo_id', null)
    const rows = (orphanPhotos ?? []) as Array<{ id: string; storage_path: string | null }>
    if (rows.length > 0) {
      const paths = rows.map((p) => p.storage_path).filter((p): p is string => !!p)
      if (paths.length > 0) await supabase.storage.from('work-photos').remove(paths)
      await db.from('work_photos').delete().in('id', rows.map((p) => p.id))
    }
  } catch { /* tabella 041 mancante o storage non raggiungibile: non blocca il purge */ }

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

  const workspace = await resolveWorkspaceForUser(supabase, user.id, 'id, plan, free_trial_expires_at, sent_quota_used')
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
    .select('id, doc_type, sent_at, status, total, client_id, doc_number, validity_days, pdf_downloaded_at, title, notes, internal_notes, discount_pct, discount_fixed, vat_rate_default, payment_terms, document_items(*)')
    .eq('id', documentId)
    .eq('workspace_id', workspace.id)
    .is('deleted_at', null)
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
  // SOLO preventivi (il limite è "8 preventivi": la fattura di un lavoro
  // già contato non deve bruciare un secondo slot) e SOLO al primo invio
  // assoluto (sent_at null): un accettato ri-editato non conta due volte.
  if (workspace.plan === 'free' && doc.doc_type !== 'fattura' && !doc.sent_at) {
    // RPC atomica (059) con fallback pre-migration: il read-modify-write
    // perdeva incrementi con invii concorrenti (review 25 lug).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RPC 059 non ancora in types/database.ts
    const { error: rpcErr } = await (supabase as any).rpc('increment_sent_quota', { p_workspace_id: workspace.id })
    if (rpcErr) {
      await supabase
        .from('workspaces')
        .update({ sent_quota_used: workspace.sent_quota_used + 1 })
        .eq('id', workspace.id)
    }
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

  const workspace = await resolveWorkspaceForUser(supabase, user.id, 'id, plan, free_trial_expires_at, sent_quota_used')
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
    .select('id, doc_type, client_id, sent_at, status, total, pdf_downloaded_at, doc_number, validity_days, title, notes, internal_notes, discount_pct, discount_fixed, vat_rate_default, payment_terms, document_items(*)')
    .eq('id', documentId)
    .eq('workspace_id', workspace.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!doc) return { error: 'Documento non trovato' }
  if (doc.status !== 'draft') return { error: 'Solo le bozze possono essere registrate come inviate' }
  // Decisione Eli 27 lug: la BOZZA può vivere senza cliente (appunti presi in
  // cantiere), ma l'INVIO no — un preventivo in giro senza intestatario è
  // esattamente il "per chi era?" che si voleva evitare. Questo è il varco di
  // WhatsApp/copia link; l'email richiede già un destinatario.
  if (!(doc as Record<string, unknown>).client_id) {
    return { error: 'Scegli il cliente prima di inviare il preventivo: apri la bozza e aggiungilo in cima.' }
  }
  if ((doc.total ?? 0) === 0) return { error: 'Il preventivo non ha voci salvate. Salva le modifiche prima di condividere.' }

  // Le bozze possono contenere voci "da completare" (prezzo/quantità 0, es.
  // proposte dall'AI dalle foto): non devono poter partire verso il cliente.
  const sendItems = ((doc as Record<string, unknown>).document_items ?? []) as Array<Record<string, unknown>>
  const hasIncompleteVoce = sendItems.some((it) =>
    String(it.description ?? '').trim() === '' ||
    Number(it.unit_price ?? 0) <= 0 ||
    Number(it.quantity ?? 0) <= 0
  )
  if (hasIncompleteVoce) {
    return { error: 'Una o più voci sono ancora da completare (prezzo o quantità a zero). Completale prima di condividere.' }
  }

  // Proposte identiche (l'auto-save aggira il blocco client): niente invio
  // finché Base e Premium non si differenziano.
  const tierDupErr = tierDuplicateSendError(sendItems)
  if (tierDupErr) return { error: tierDupErr }

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

  // Incrementa il contatore storico degli invii Free — SOLO preventivi
  // al primo invio assoluto (vedi sendDocumentAction).
  if (workspace.plan === 'free' && !isFattura && !doc.sent_at) {
    // RPC atomica (059) con fallback pre-migration (vedi sendDocumentAction).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RPC 059 non ancora in types/database.ts
    const { error: rpcErr } = await (supabase as any).rpc('increment_sent_quota', { p_workspace_id: workspace.id })
    if (rpcErr) {
      await supabase
        .from('workspaces')
        .update({ sent_quota_used: workspace.sent_quota_used + 1 })
        .eq('id', workspace.id)
    }
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

  const workspace = await resolveWorkspaceForUser(supabase, user.id, 'id')
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

  const workspace = await resolveWorkspaceForUser(supabase, user.id, 'id, plan, free_trial_expires_at, sent_quota_used')
  if (!workspace) return { error: 'Workspace non trovato' }

  const { data: original } = await supabase
    .from('documents')
    .select('*, document_items(*)')
    .eq('id', documentId)
    .eq('workspace_id', workspace.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!original) return { error: 'Documento non trovato' }

  // Piano Free: blocca la duplicazione di preventivi se trial scaduto o quota raggiunta
  if (workspace.plan === 'free' && original.doc_type === 'preventivo') {
    const trial = checkFreeBlock(workspace)
    if (trial.blocked) {
      return { error: 'Piano Free terminato. Passa a Pro per creare nuovi preventivi illimitati.' }
    }
  }

  // Genera nuovo numero atomico per la copia — dalla sequenza del TIPO giusto
  // (review 25 lug A1: duplicare una fattura pescava dalla sequenza preventivi
  // → numerazione fiscale fuori ordine e possibile collisione).
  let docNumber: string
  try {
    docNumber = original.doc_type === 'fattura'
      ? await allocateInvoiceNumber(workspace.id)
      : await allocateDocNumber(workspace.id)
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

  // Duplica le voci — INCLUSO option_tier (041): senza, un preventivo a proposte
  // (Base/Premium) verrebbe copiato con TUTTE le voci appiattite in un'unica lista
  // e un totale riferito alla sola Base → copia incoerente e proposte perse.
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
    option_tier: (item as { option_tier?: string | null }).option_tier ?? null,
    unit_cost: (item as { unit_cost?: number | null }).unit_cost ?? null,
    supplier_list_id: (item as { supplier_list_id?: string | null }).supplier_list_id ?? null,
    total: item.total,
  }))

  // Riporta anche la configurazione proposte (041) e acconto (038) sulla copia,
  // in modo tollerante alle migration non applicate. Senza questo la copia perde
  // options_enabled/recommended_tier e i totali non tornano con le voci mostrate.
  const orig = original as {
    options_enabled?: boolean | null; recommended_tier?: string | null
    deposit_type?: string | null; deposit_value?: number | null
  }
  const optsErr = await applyDepositAndOptions(
    supabase,
    newDoc.id,
    {
      deposit_type: orig.deposit_type === 'percent' || orig.deposit_type === 'amount' ? orig.deposit_type : null,
      deposit_value: typeof orig.deposit_value === 'number' ? orig.deposit_value : null,
    },
    {
      enabled: orig.options_enabled === true,
      recommended: (orig.options_enabled === true
        ? ((orig.recommended_tier as OptionTier | null) ?? null)
        : null),
    },
    { workspaceId: workspace.id }
  )
  // Best-effort: la copia resta valida anche senza opzioni/acconto, ma un
  // fallimento REALE (non colonna mancante) va almeno registrato nei log.
  if (optsErr) console.error('[duplicateDocument] opzioni/acconto non riportati sulla copia:', optsErr)

  if (items.length > 0) {
    const { error: dupItemsErr } = await insertDocumentItemsTollerante(supabase, items as unknown as DocumentItemInsert[])
    if (dupItemsErr) {
      // Niente duplicato "vuoto" silenzioso: rimuovi la copia appena creata
      // (nel cestino) e di' all'utente di riprovare.
      await supabase.from('documents').update({ deleted_at: new Date().toISOString() }).eq('id', newDoc.id)
      return { error: 'Duplicazione non riuscita: le voci non sono state copiate. Riprova.' }
    }
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

  const workspace = await resolveWorkspaceForUser(supabase, user.id, 'id')
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

  const workspace = await resolveWorkspaceForUser(supabase, user.id, 'id, fiscal_regime, bollo_auto, ritenuta_auto, plan, invoice_prefix')
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

  // 1-bis. Cliente OBBLIGATORIO (review 25 lug #7): una fattura senza
  // intestatario non è un documento valido — sul preventivo la mancanza è
  // tollerabile, qui no (numero fiscale consumato + PDF senza destinatario).
  if (!parsed.data.client_id) {
    validationErrors.push('Scegli il cliente della fattura prima di salvare.')
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
      else if (noDesc && noQty) voceErr = 'Compila la descrizione e una quantità diversa da zero in ogni voce della fattura per salvare.'
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
    unit_cost: v.unit_cost ?? null,
    supplier_list_id: sanitizeSupplierListId(v.supplier_list_id),
    total: 0,
    ai_generated: false,
    ai_confidence: null,
  }))

  const fiscal = calcolaDocumento(itemsForCalc, fiscalOpts)

  // Opzioni a livelli (041): i totali del DOCUMENTO seguono la proposta
  // Base (la ★ Consigliata è stata rimossa il 19 lug) — le voci restano
  // tutte, con il loro tier.
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
    unit_cost: (item as { unit_cost?: number | null }).unit_cost ?? null,
    supplier_list_id: (item as { supplier_list_id?: string | null }).supplier_list_id ?? null,
    total: item.total,
  })) as unknown as DocumentItemInsert[]

  const { error: itemsError } = await insertDocumentItemsTollerante(supabase, items)

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

  const workspace = await resolveWorkspaceForUser(supabase, user.id, 'id, ragione_sociale, name')
  if (!workspace) return { error: 'Workspace non trovato' }

  const { data: doc } = await supabase
    .from('documents')
    .select('id, doc_number, title, status, public_token, client_id')
    .eq('id', documentId)
    .eq('workspace_id', workspace.id)
    .maybeSingle()

  if (!doc) return { error: 'Documento non trovato' }
  // Per le FATTURE anche 'expired' (review 25 lug C2): la fattura scaduta è
  // ESATTAMENTE quella da sollecitare — bloccarla diceva l'opposto della realtà.
  const remindable = docType === 'fattura' ? ['sent', 'viewed', 'expired'] : ['sent', 'viewed']
  if (!remindable.includes(doc.status)) {
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

  const workspace = await resolveWorkspaceForUser(supabase, user.id, 'id')
  if (!workspace) return { error: 'Workspace non trovato' }

  // Se stiamo COLLEGANDO, il preventivo va validato PRIMA di scrivere:
  // deve essere un preventivo di QUESTO workspace, fuori dal cestino e
  // diverso dalla fattura stessa (review 3 ago #2: prima si persisteva
  // qualunque uuid — dato sporco — e un preventivo nel cestino poteva
  // perfino finire marcato Accettato).
  let prev: { status: string; client_id: string | null } | null = null
  if (preventivoId) {
    if (preventivoId === fatturaId) return { error: 'Documento non valido.' }
    const { data, error: prevErr } = await supabase
      .from('documents')
      .select('status, client_id')
      .eq('id', preventivoId)
      .eq('workspace_id', workspace.id)
      .eq('doc_type', 'preventivo')
      .is('deleted_at', null)
      .maybeSingle()
    if (prevErr) return { error: 'Errore durante il collegamento' }
    if (!data) return { error: 'Preventivo non trovato (forse è nel cestino). Ricarica la pagina.' }
    prev = data
  }

  const { data: fatturaRow, error } = await supabase
    .from('documents')
    .update({ origin_document_id: preventivoId })
    .eq('id', fatturaId)
    .eq('workspace_id', workspace.id)
    .eq('doc_type', 'fattura')
    // Una fattura nel cestino non si collega (né si scollega): prima veniva
    // ancora matchata e il preventivo poteva risultare "Accettato" con un
    // collegamento a un documento cestinato (review 3 ago #1).
    .is('deleted_at', null)
    .select('client_id')
    .maybeSingle()

  if (error) return { error: 'Errore durante il collegamento' }
  // 0 righe = fattura inesistente/cestinata/cross-workspace: prima si
  // proseguiva (ok:true) e con un preventivo sent/viewed lo si marcava
  // perfino Accettato SENZA aver collegato nulla (review 3 ago).
  if (!fatturaRow) return { error: 'Fattura non trovata (forse è nel cestino). Ricarica la pagina.' }

  // Collegare un preventivo INVIATO/VISTO a una fattura implica che il cliente l'ha accettato:
  // lo segniamo come Accettato (l'utente è avvisato nel dialog di collegamento).
  let markedAccepted = false
  if (preventivoId && prev) {
    // Il cliente è lo stesso del preventivo (richiesta Eli 3 ago): se la
    // fattura ne è senza, lo eredita — così i contatti compaiono nelle
    // scadenze e nei solleciti (email/WhatsApp/chiama) anche per le fatture
    // nate "vuote" e collegate a mano. Best-effort: un errore qui non
    // annulla il collegamento già riuscito.
    if (prev.client_id && !fatturaRow.client_id) {
      const { error: clientErr } = await supabase
        .from('documents')
        .update({ client_id: prev.client_id })
        .eq('id', fatturaId)
        .eq('workspace_id', workspace.id)
        .is('client_id', null)
      if (clientErr) console.error('[linkDocument] cliente non ereditato:', clientErr)
    }

    if (prev.status === 'sent' || prev.status === 'viewed') {
      // markedAccepted solo se l'update è DAVVERO riuscito (review 25 lug #12):
      // prima si comunicava "segnato come accettato" anche su errore DB.
      const { error: markErr } = await supabase
        .from('documents')
        .update({ status: 'accepted', accepted_at: new Date().toISOString() })
        .eq('id', preventivoId)
        .eq('workspace_id', workspace.id)
      if (!markErr) {
        markedAccepted = true
        revalidatePath(`/preventivi/${preventivoId}`)
        revalidatePath('/preventivi')
      }
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
  if ((doc.total ?? 0) > 0 && amount >= (doc.total ?? 0)) {
    // Acconto pari (o oltre) al totale = pagamento intero: si gestisce
    // dalla fattura con "Segna pagata", non da qui (residuo 0 bloccherebbe tutto).
    return { error: 'L’importo copre l’intero preventivo: converti in fattura e usa "Segna pagata".' }
  }
  // Con una fattura già collegata l'acconto si registra SULLA fattura:
  // qui creerebbe un doppio conteggio nel Bilancio.
  const { data: linkedFattura } = await supabase
    .from('documents')
    .select('id')
    .eq('origin_document_id', documentId)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle()
  if (linkedFattura) {
    return { error: 'Questo preventivo ha già una fattura collegata: registra l’incasso dalla fattura.' }
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
