'use client'

import { useState, useActionState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, Trash2, Save, Send, AlertCircle, Hash } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ClientAutocomplete } from '@/components/shared/ClientAutocomplete'
import { QuickCreateClientDialog } from '@/components/shared/QuickCreateClientDialog'
import type { ClientHit as QuickClientHit } from '@/components/shared/QuickCreateClientDialog'
import { FiscalSummary } from './FiscalSummary'
import { VociTable } from './VociTable'
import { AiImportButton } from './AiImportButton'
import { createDocumentAction, updateDocumentAction, saveDraftAction, sendDocumentAction } from '@/lib/actions/documents'
import type { FiscalOptions } from '@/types/index'
import type { Database } from '@/types/database'
import type { ExtractedItem } from '@/lib/ai/types'

type TemplateRow = Database['public']['Tables']['templates']['Row']
type DocumentRow = Database['public']['Tables']['documents']['Row']
type DocumentItemRow = Database['public']['Tables']['document_items']['Row']

type ClientHit = {
  id: string
  name: string
  email: string | null
  phone: string | null
  piva: string | null
}

type TemplateLight = { id: string; name: string; is_default: boolean | null }

export type VoceItem = {
  _key: string
  id?: string
  sort_order: number
  description: string
  unit: string
  quantity: number
  unit_price: number
  discount_pct: number | null
  vat_rate: number | null
}

// Regex formato numero documento: NNN/YYYY — es. 001/2026
const DOC_NUMBER_RE = /^\d{1,6}\/\d{4}$/

interface PreventivoFormProps {
  mode: 'create' | 'edit'
  documentId?: string
  defaultValues?: DocumentRow & { document_items: DocumentItemRow[] }
  templates: TemplateLight[]
  defaultTemplateId?: string | null
  fiscalRegime: 'forfettario' | 'ordinario' | 'minimi'
  defaultVatRate?: number | null
  isProPlan?: boolean
  /** Anteprima del prossimo numero (solo create mode, senza incrementare la sequenza) */
  nextDocNumber?: string
  docType?: 'preventivo' | 'fattura'
}

const VAT_RATES = [22, 10, 5, 4, 0]
const UNITA = ['pz', 'ore', 'mq', 'ml', 'kg', 'gg', 'mc', 'lt']

function newVoce(sortOrder: number): VoceItem {
  return {
    _key: `${Date.now()}-${Math.random()}`,
    sort_order: sortOrder,
    description: '',
    unit: 'pz',
    quantity: 1,
    unit_price: 0,
    discount_pct: null,
    vat_rate: null,
  }
}

export function PreventivoForm({
  mode,
  documentId,
  defaultValues,
  templates,
  defaultTemplateId,
  fiscalRegime,
  defaultVatRate,
  isProPlan = false,
  nextDocNumber,
  docType = 'preventivo',
}: PreventivoFormProps) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const autoSaveRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastSaveRef = useRef<Date | null>(null)
  const isDirtyRef = useRef(false)

  // ── Stato form ─────────────────────────────────────────────
  const [selectedClient, setSelectedClient] = useState<ClientHit | null>(null)
  const [quickCreateOpen, setQuickCreateOpen] = useState(false)
  const [voci, setVoci] = useState<VoceItem[]>(
    defaultValues?.document_items && defaultValues.document_items.length > 0
      ? defaultValues.document_items.map((item) => ({
          _key: item.id,
          id: item.id,
          sort_order: item.sort_order,
          description: item.description,
          unit: item.unit ?? 'pz',
          quantity: Number(item.quantity),
          unit_price: Number(item.unit_price),
          discount_pct: item.discount_pct !== null ? Number(item.discount_pct) : null,
          vat_rate: item.vat_rate !== null ? Number(item.vat_rate) : null,
        }))
      : [newVoce(0)]
  )
  const [discountPct, setDiscountPct] = useState<string>(
    defaultValues?.discount_pct != null ? String(defaultValues.discount_pct) : ''
  )
  const [discountFixed, setDiscountFixed] = useState<string>(
    defaultValues?.discount_fixed != null ? String(defaultValues.discount_fixed) : ''
  )
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [sendingDoc, setSendingDoc] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  // ── Numero documento (controllato) ────────────────────────
  // In create: pre-popolato con nextDocNumber (anteprima senza incremento)
  // In edit: pre-popolato con il numero attuale del documento
  const [docNumber, setDocNumber] = useState<string>(
    defaultValues?.doc_number ?? nextDocNumber ?? ''
  )
  const [docNumberError, setDocNumberError] = useState<string | null>(null)

  function validateDocNumber(value: string): string | null {
    if (!value.trim()) return 'Il numero è obbligatorio'
    if (!DOC_NUMBER_RE.test(value.trim())) return 'Formato non valido (es. 001/2026)'
    return null
  }

  // ── Titolo opzionale ──────────────────────────────────────
  const [titleValue, setTitleValue] = useState(defaultValues?.title ?? '')

  // ── AI Import: applica voci estratte ─────────────────────
  function handleAiItems(
    items: ExtractedItem[],
    title?: string,
    _notes?: string
  ) {
    const newVoci = items.map((item, i) => ({
      _key: `ai-${Date.now()}-${i}`,
      sort_order: i,
      description: item.description,
      unit: item.unit ?? 'pz',
      quantity: item.quantity,
      unit_price: item.unit_price,
      discount_pct: item.discount_pct ?? null,
      vat_rate: item.vat_rate ?? null,
    }))
    setVoci(newVoci)
    if (title && !titleValue) setTitleValue(title)
    markDirty()
  }

  // ── Server Action ──────────────────────────────────────────
  const action = mode === 'edit' && documentId
    ? updateDocumentAction.bind(null, documentId)
    : createDocumentAction

  const [state, formAction, isPending] = useActionState(action, null)

  // ── Auto-save ogni 30s (solo in modalità edit) ─────────────
  const doAutoSave = useCallback(async () => {
    if (!documentId || !isDirtyRef.current || !formRef.current) return
    setSaving(true)
    const fd = new FormData(formRef.current)
    fd.set('items_json', JSON.stringify(voci.map(({ _key, ...v }) => v)))
    fd.set('client_id', selectedClient?.id ?? '')
    fd.set('doc_number', docNumber)
    await saveDraftAction(documentId, fd)
    lastSaveRef.current = new Date()
    setLastSaved(new Date())
    isDirtyRef.current = false
    setSaving(false)
  }, [documentId, voci, selectedClient, docNumber])

  useEffect(() => {
    if (mode !== 'edit' || !documentId) return
    autoSaveRef.current = setInterval(doAutoSave, 30_000)
    return () => { if (autoSaveRef.current) clearInterval(autoSaveRef.current) }
  }, [mode, documentId, doAutoSave])

  // Marca dirty su ogni cambio
  const markDirty = () => { isDirtyRef.current = true }

  // ── Invia documento ────────────────────────────────────────
  async function handleSend() {
    if (!documentId) return
    setSendError(null)
    setSendingDoc(true)
    const result = await sendDocumentAction(documentId)
    if (result?.error) {
      setSendError(result.error)
      setSendingDoc(false)
    }
    setSendingDoc(false)
    router.refresh()
  }

  // ── Fiscal options per il riepilogo ────────────────────────
  const fiscalOpts: FiscalOptions = {
    fiscal_regime: fiscalRegime,
    currency: 'EUR',
    discount_pct: parseFloat(discountPct) || undefined,
    discount_fixed: parseFloat(discountFixed) || undefined,
    vat_rate_default: defaultVatRate ?? undefined,
  }

  return (
    <>
    <form
      ref={formRef}
      action={formAction}
      onChange={markDirty}
      className="space-y-6"
    >
      {/* Hidden: items, client */}
      <input type="hidden" name="items_json" value={JSON.stringify(voci.map(({ _key, ...v }) => v))} />
      <input type="hidden" name="client_id" value={selectedClient?.id ?? ''} />

      {/* Errore globale */}
      {state?.error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {state.error}
        </div>
      )}
      {sendError && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {sendError}
        </div>
      )}

      {/* ── Sezione 1: Info base ─────────────────────────────── */}
      <div className="rounded-lg border bg-card p-4 md:p-5 space-y-4">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
          Informazioni
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* ── Numero documento (identificatore principale) ── */}
          <div className="space-y-1.5">
            <Label htmlFor="doc_number">
              {docType === 'fattura' ? 'Numero fattura' : 'Numero preventivo'}{' '}
              <span className="text-destructive">*</span>
            </Label>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <Input
                  id="doc_number"
                  name="doc_number"
                  value={docNumber}
                  onChange={(e) => {
                    setDocNumber(e.target.value)
                    setDocNumberError(null)
                    markDirty()
                  }}
                  onBlur={(e) => setDocNumberError(validateDocNumber(e.target.value))}
                  placeholder="001/2026"
                  className={`pl-7 font-mono w-36 ${docNumberError ? 'border-destructive' : ''}`}
                />
              </div>
              <span className="text-xs text-muted-foreground">NNN/ANNO</span>
            </div>
            {docNumberError && (
              <p className="text-xs text-destructive">{docNumberError}</p>
            )}
            {mode === 'create' && !docNumberError && (
              <p className="text-xs text-muted-foreground">
                Puoi modificarlo — il numero definitivo viene assegnato al salvataggio.
              </p>
            )}
          </div>

          {/* ── Titolo opzionale ── */}
          <div className="space-y-1.5">
            <Label htmlFor="title">
              Oggetto{' '}
              <span className="font-normal text-muted-foreground text-xs">(opzionale)</span>
            </Label>
            <Input
              id="title"
              name="title"
              placeholder="es. Impianto elettrico abitazione…"
              value={titleValue}
              onChange={(e) => { setTitleValue(e.target.value); markDirty() }}
            />
          </div>

          {/* Cliente */}
          <div className="space-y-1.5">
            <Label>Cliente</Label>
            <ClientAutocomplete
              value={selectedClient}
              onChange={(c: ClientHit | null) => { setSelectedClient(c); markDirty() }}
              onCreateNew={() => setQuickCreateOpen(true)}
            />
          </div>

          {/* Template */}
          {templates.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="template_id">Template</Label>
              <Select
                name="template_id"
                defaultValue={
                  // Priorità: template salvato nel documento → default workspace → nessuno
                  ((defaultValues as Record<string, unknown> | undefined)?.template_id as string | undefined)
                  ?? defaultTemplateId
                  ?? undefined
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Scegli template…" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Note pubbliche */}
        <div className="space-y-1.5">
          <Label htmlFor="notes">Note (visibili al cliente)</Label>
          <Textarea
            id="notes"
            name="notes"
            placeholder="Condizioni, note aggiuntive…"
            rows={3}
            defaultValue={defaultValues?.notes ?? ''}
          />
        </div>

        {/* Note interne */}
        <div className="space-y-1.5">
          <Label htmlFor="internal_notes">
            Note interne{' '}
            <span className="text-muted-foreground font-normal text-xs">(non visibili al cliente)</span>
          </Label>
          <Textarea
            id="internal_notes"
            name="internal_notes"
            placeholder="Appunti personali, costi, margini…"
            rows={2}
            defaultValue={defaultValues?.internal_notes ?? ''}
          />
        </div>

        {/* Validità + Pagamento */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="validity_days">Validità (giorni)</Label>
            <Input
              id="validity_days"
              name="validity_days"
              type="number"
              min="1"
              max="365"
              defaultValue={defaultValues?.validity_days ?? 30}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="payment_terms">Termini di pagamento</Label>
            <Select name="payment_terms" defaultValue={defaultValues?.payment_terms ?? '30 giorni'}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {['Alla firma', '10 giorni', '30 giorni', '60 giorni', '90 giorni', 'Personalizzati'].map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* ── Sezione 2: Voci ──────────────────────────────────── */}
      <div className="flex items-center justify-end">
        <AiImportButton
          isProPlan={isProPlan}
          onItemsExtracted={handleAiItems}
        />
      </div>

      <VociTable
        voci={voci}
        onChange={(v) => { setVoci(v); markDirty() }}
        fiscalRegime={fiscalRegime}
        defaultVatRate={defaultVatRate}
        vatRates={VAT_RATES}
        units={UNITA}
      />

      {/* ── Sezione 3: Sconti globali ─────────────────────────── */}
      <div className="rounded-lg border bg-card p-4 md:p-5 space-y-4">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
          Sconti globali (opzionale)
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="discount_pct">Sconto %</Label>
            <div className="relative">
              <Input
                id="discount_pct"
                name="discount_pct"
                type="number"
                min="0"
                max="100"
                step="0.01"
                placeholder="0"
                value={discountPct}
                onChange={(e) => { setDiscountPct(e.target.value); markDirty() }}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="discount_fixed">Sconto fisso</Label>
            <div className="relative">
              <Input
                id="discount_fixed"
                name="discount_fixed"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={discountFixed}
                onChange={(e) => { setDiscountFixed(e.target.value); markDirty() }}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">€</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Riepilogo fiscale ─────────────────────────────────── */}
      <FiscalSummary voci={voci} fiscalOpts={fiscalOpts} />

      {/* ── Azioni ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-xs text-muted-foreground">
          {saving && (
            <span className="flex items-center gap-1.5">
              <Loader2 className="size-3 animate-spin" /> Salvataggio…
            </span>
          )}
          {!saving && lastSaved && (
            <span>
              Salvato alle{' '}
              {lastSaved.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {mode === 'edit' && documentId && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={doAutoSave}
              disabled={saving}
            >
              <Save className="size-4" /> Salva bozza
            </Button>
          )}

          {mode === 'edit' && documentId && defaultValues?.status === 'draft' && (
            <Button
              type="button"
              variant="secondary"
              onClick={handleSend}
              disabled={sendingDoc || isPending}
            >
              {sendingDoc
                ? <Loader2 className="size-4 animate-spin" />
                : <Send className="size-4" />}
              Invia al cliente
            </Button>
          )}

          <Button
            type="submit"
            disabled={isPending || !!docNumberError}
            onClick={() => {
              // Valida il numero prima dell'invio
              const err = validateDocNumber(docNumber)
              if (err) setDocNumberError(err)
            }}
          >
            {isPending && <Loader2 className="size-4 animate-spin" />}
            {mode === 'create'
              ? (docType === 'fattura' ? 'Crea fattura' : 'Crea preventivo')
              : (docType === 'fattura' ? 'Aggiorna fattura' : 'Aggiorna preventivo')
            }
          </Button>
        </div>
      </div>
    </form>

    {/* Dialog creazione cliente inline — fuori dal <form> per evitare submit annidati */}
    <QuickCreateClientDialog
      open={quickCreateOpen}
      onOpenChange={setQuickCreateOpen}
      onCreated={(client: QuickClientHit) => {
        setSelectedClient(client)
        markDirty()
      }}
    />
    </>
  )
}
