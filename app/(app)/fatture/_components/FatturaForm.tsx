'use client'

import { useState, useActionState } from 'react'
import { QuickCreateClientDialog } from '@/components/shared/QuickCreateClientDialog'
import type { ClientHit as QuickClientHit } from '@/components/shared/QuickCreateClientDialog'
import { Loader2, AlertCircle, Hash } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ClientAutocomplete } from '@/components/shared/ClientAutocomplete'
import { FiscalSummary } from '@/app/(app)/preventivi/_components/FiscalSummary'
import { VociTable } from '@/app/(app)/preventivi/_components/VociTable'
import { createInvoiceAction } from '@/lib/actions/documents'
import type { FiscalOptions } from '@/types/index'

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

// Ammette sia "001/2026" sia "FT-001/2026" (con prefisso workspace)
const FT_NUMBER_RE = /^.*\d{1,6}\/\d{4}$/
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

interface FatturaFormProps {
  templates: TemplateLight[]
  defaultTemplateId?: string | null
  fiscalRegime: 'forfettario' | 'ordinario' | 'minimi'
  defaultVatRate?: number | null
  isProPlan?: boolean
  nextInvoiceNumber?: string
}

export function FatturaForm({
  templates,
  defaultTemplateId,
  fiscalRegime,
  defaultVatRate,
  nextInvoiceNumber,
}: FatturaFormProps) {
  const [selectedClient, setSelectedClient] = useState<ClientHit | null>(null)
  const [quickCreateOpen, setQuickCreateOpen] = useState(false)
  const [voci, setVoci] = useState<VoceItem[]>([newVoce(0)])
  const [discountPct, setDiscountPct] = useState('')
  const [discountFixed, setDiscountFixed] = useState('')
  const [docNumber, setDocNumber] = useState(nextInvoiceNumber ?? '')
  const [docNumberError, setDocNumberError] = useState<string | null>(null)

  const [state, formAction, isPending] = useActionState(createInvoiceAction, null)

  function validateDocNumber(value: string): string | null {
    if (!value.trim()) return 'Il numero è obbligatorio'
    if (!FT_NUMBER_RE.test(value.trim())) return 'Formato non valido (es. 001/2026)'
    return null
  }

  const fiscalOpts: FiscalOptions = {
    fiscal_regime: fiscalRegime,
    currency: 'EUR',
    discount_pct: parseFloat(discountPct) || undefined,
    discount_fixed: parseFloat(discountFixed) || undefined,
    vat_rate_default: defaultVatRate ?? undefined,
  }

  return (
    <>
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="items_json" value={JSON.stringify(voci.map(({ _key, ...v }) => v))} />
      <input type="hidden" name="client_id" value={selectedClient?.id ?? ''} />

      {state?.error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {state.error}
        </div>
      )}

      {/* ── Informazioni ─────────────────────────────────────── */}
      <div className="rounded-lg border bg-card p-4 md:p-5 space-y-4">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
          Informazioni
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Numero fattura */}
          <div className="space-y-1.5">
            <Label htmlFor="doc_number">
              Numero fattura <span className="text-destructive">*</span>
            </Label>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <Input
                  id="doc_number"
                  name="doc_number"
                  value={docNumber}
                  onChange={(e) => { setDocNumber(e.target.value); setDocNumberError(null) }}
                  onBlur={(e) => setDocNumberError(validateDocNumber(e.target.value))}
                  placeholder="001/2026"
                  className={`pl-7 font-mono w-40 ${docNumberError ? 'border-destructive' : ''}`}
                />
              </div>
            </div>
            {docNumberError && <p className="text-xs text-destructive">{docNumberError}</p>}
            {!docNumberError && (
              <p className="text-xs text-muted-foreground">
                Puoi modificarlo — il numero definitivo viene assegnato al salvataggio.
              </p>
            )}
          </div>

          {/* Oggetto */}
          <div className="space-y-1.5">
            <Label htmlFor="title">
              Oggetto{' '}
              <span className="font-normal text-muted-foreground text-xs">(opzionale)</span>
            </Label>
            <Input id="title" name="title" placeholder="es. Consulenza aprile 2026…" />
          </div>

          {/* Cliente */}
          <div className="space-y-1.5">
            <Label>Cliente</Label>
            <ClientAutocomplete
              value={selectedClient}
              onChange={(c: ClientHit | null) => setSelectedClient(c)}
              onCreateNew={() => setQuickCreateOpen(true)}
            />
          </div>

          {/* Template */}
          {templates.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="template_id">Template</Label>
              <Select name="template_id" defaultValue={defaultTemplateId ?? undefined}>
                <SelectTrigger><SelectValue placeholder="Scegli template…" /></SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Note */}
        <div className="space-y-1.5">
          <Label htmlFor="notes">Note (visibili al cliente)</Label>
          <Textarea id="notes" name="notes" placeholder="Condizioni di pagamento, note aggiuntive…" rows={3} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="internal_notes">
            Note interne{' '}
            <span className="text-muted-foreground font-normal text-xs">(non visibili al cliente)</span>
          </Label>
          <Textarea id="internal_notes" name="internal_notes" placeholder="Appunti interni…" rows={2} />
        </div>

        {/* Validità + Pagamento */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="validity_days">Validità (giorni)</Label>
            <Input id="validity_days" name="validity_days" type="number" min="1" max="365" defaultValue={30} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="payment_terms">Termini di pagamento</Label>
            <Select name="payment_terms" defaultValue="30 giorni">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {['Alla firma', '10 giorni', '30 giorni', '60 giorni', '90 giorni', 'Personalizzati'].map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* ── Voci ─────────────────────────────────────────────── */}
      <VociTable
        voci={voci}
        onChange={setVoci}
        fiscalRegime={fiscalRegime}
        defaultVatRate={defaultVatRate}
        vatRates={VAT_RATES}
        units={UNITA}
      />

      {/* ── Sconti globali ────────────────────────────────────── */}
      <div className="rounded-lg border bg-card p-4 md:p-5 space-y-4">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
          Sconti globali (opzionale)
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="discount_pct">Sconto %</Label>
            <div className="relative">
              <Input
                id="discount_pct" name="discount_pct" type="number"
                min="0" max="100" step="0.01" placeholder="0"
                value={discountPct} onChange={(e) => setDiscountPct(e.target.value)}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="discount_fixed">Sconto fisso</Label>
            <div className="relative">
              <Input
                id="discount_fixed" name="discount_fixed" type="number"
                min="0" step="0.01" placeholder="0.00"
                value={discountFixed} onChange={(e) => setDiscountFixed(e.target.value)}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">€</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Riepilogo fiscale ─────────────────────────────────── */}
      <FiscalSummary voci={voci} fiscalOpts={fiscalOpts} />

      {/* ── Azione ───────────────────────────────────────────── */}
      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={isPending || !!docNumberError}
          onClick={() => {
            const err = validateDocNumber(docNumber)
            if (err) setDocNumberError(err)
          }}
        >
          {isPending && <Loader2 className="size-4 animate-spin" />}
          Crea fattura
        </Button>
      </div>
    </form>

    <QuickCreateClientDialog
      open={quickCreateOpen}
      onOpenChange={setQuickCreateOpen}
      onCreated={(client: QuickClientHit) => setSelectedClient(client)}
    />
    </>
  )
}
