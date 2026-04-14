import type { Database } from './database'

// Row types
type WorkspaceRow    = Database['public']['Tables']['workspaces']['Row']
type ClientRow       = Database['public']['Tables']['clients']['Row']
type DocumentRow     = Database['public']['Tables']['documents']['Row']
type DocumentItemRow = Database['public']['Tables']['document_items']['Row']
type TemplateRow     = Database['public']['Tables']['templates']['Row']

// Enum types
export type PlanType      = Database['public']['Enums']['plan_type']
export type FiscalRegime  = Database['public']['Enums']['fiscal_regime']
export type DocStatus     = Database['public']['Enums']['doc_status']
export type UserRole      = Database['public']['Enums']['user_role']
export type CurrencyCode  = Database['public']['Enums']['currency_code']

// ============================================================
// Workspace con piano e info billing
// ============================================================
export type WorkspaceWithPlan = WorkspaceRow & {
  /** Calcolato lato client: true se la subscription è attiva */
  isSubscriptionActive: boolean
  /** Numero di documenti creati nel workspace (join opzionale) */
  documentsCount?: number
}

// ============================================================
// Documento con le voci di dettaglio
// ============================================================
export type DocumentWithItems = DocumentRow & {
  items: DocumentItemRow[]
}

// ============================================================
// Documento con le informazioni sul cliente
// ============================================================
export type DocumentWithClient = DocumentRow & {
  client: ClientRow | null
}

// ============================================================
// Documento completo: voci + cliente + template
// ============================================================
export type DocumentFull = DocumentRow & {
  items: DocumentItemRow[]
  client: ClientRow | null
  template?: TemplateRow | null
}

// ============================================================
// Opzioni fiscali per il motore di calcolo
// ============================================================
export type FiscalOptions = {
  fiscal_regime: FiscalRegime
  /** Aliquota IVA di default applicata alle voci senza aliquota specifica */
  vat_rate_default?: number
  /** Sconto percentuale globale (es. 10 = 10%) */
  discount_pct?: number
  /** Sconto fisso in EUR applicato dopo lo sconto percentuale */
  discount_fixed?: number
  /** Percentuale ritenuta d'acconto (es. 20 per il 20%) */
  ritenuta_pct?: number
  /** Indica se applicare automaticamente la marca da bollo */
  bollo_auto?: boolean
  currency: CurrencyCode
  exchange_rate?: number
}

// ============================================================
// Risultato del calcolo fiscale
// ============================================================
export type FiscalResult = {
  subtotal: number
  afterDiscount: number
  taxAmount: number
  ritenuta: number
  bollo: number
  total: number
  itemTotals: Array<DocumentItemRow & { total: number }>
}

// ============================================================
// Payload per creare/aggiornare un documento
// ============================================================
export type DocumentUpsertPayload = {
  workspace_id: string
  client_id?: string | null
  doc_type?: string
  title: string
  notes?: string | null
  internal_notes?: string | null
  validity_days?: number
  payment_terms?: string
  currency?: CurrencyCode
  vat_rate_default?: number | null
  ritenuta_pct?: number | null
  discount_pct?: number | null
  discount_fixed?: number | null
  items: Array<{
    id?: string
    sort_order: number
    description: string
    unit?: string
    quantity: number
    unit_price: number
    discount_pct?: number | null
    vat_rate?: number | null
  }>
}

// ============================================================
// Risposta pubblica preventivo (link cliente — dati ridotti)
// ============================================================
export type PublicDocumentView = {
  id: string
  title: string
  notes: string | null
  status: DocStatus
  doc_number: string | null
  total: number
  currency: CurrencyCode
  sent_at: string | null
  expires_at: string | null
  accepted_at: string | null
  workspace: {
    ragione_sociale: string | null
    name: string
    logo_url: string | null
    piva: string | null
    indirizzo: string | null
    citta: string | null
    provincia: string | null
  }
  client: {
    name: string
    email: string | null
  } | null
  items: Array<{
    sort_order: number
    description: string
    unit: string | null
    quantity: number
    unit_price: number
    vat_rate: number | null
    total: number
  }>
}
