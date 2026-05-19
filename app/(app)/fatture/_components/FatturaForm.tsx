'use client'

import { useState, useActionState, useEffect, useRef } from 'react'
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
import { UNIT_VALUES } from '@/lib/constants/units'

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

// Ammette sia "001/2026" sia "Fatt001/2026" (con prefisso workspace)
const FT_NUMBER_RE = /^.*\d{1,6}\/\d{4}$/
const VAT_RATES = [22, 10, 5, 4, 0]

const PAYMENT_TERMS = [
  'Alla firma',
  '10 giorni',
  '30 giorni',
  '60 giorni',
  '90 giorni',
  '30 gg data fattura',
  'Fine mese + 30 gg',
  'Personalizzati',
]

function fmtDate(d: Date): string {
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })
}

function dueDateHint(terms: string, from: Date): string | null {
  if (terms === '30 gg data fattura') {
    const d = new Date(from)
    d.setDate(d.getDate() + 30)
    return `Scadenza stimata: ${fmtDate(d)}`
  }
  if (terms === 'Fine mese + 30 gg') {
    const d = new Date(from)
    d.setMonth(d.getMonth() + 1, 0) // ultimo giorno del mese corrente
    d.setDate(d.getDate() + 30)
    return `Scadenza stimata: ${fmtDate(d)}`
  }
  return null
}

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

// Separa il prefisso alfabetico dalla parte numerica: "Fatt001/2026" → ["Fatt", "001/2026"]
function splitDocNumber(full: string): [string, string] {
  const m = full.match(/^([A-Za-z]*)(\d.*)$/)
  if (m) return [m[1], m[2]]
  return ['', full]
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

  // Split del numero fattura in prefisso (read-only) + parte editabile
  const [docPrefix, docNumericInit] = splitDocNumber(nextInvoiceNumber ?? '')
  const [docNumeric, setDocNumeric] = useState(docNumericInit)
  const docNumber = `${docPrefix}${docNumeric}` // valore completo inviato al server
  const [docNumberError, setDocNumberError] = useState<string | null>(null)

  const [paymentTerms, setPaymentTerms] = useState('30 giorni')
  const docDate = new Date()
  const [bonusEdilizio, setBonusEdilizio] = useState('')
  const [vatRateDefault, setVatRateDefault] = useState<number | null>(null)

  const [state, formAction, isPending] = useActionState(createInvoiceAction, null)
  const errorRef = useRef<HTMLDivElement>(null)

  // Scrolla al banner di errore quando compare
  useEffect(() => {
    if (state?.error) {
      errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [state?.error])

  function validateDocNumeric(value: string): string | null {
    const full = `${docPrefix}${value.trim()}`
    if (!value.trim()) return 'Il numero è obbligatorio'
    if (!FT_NUMBER_RE.test(full)) return 'Formato non valido (es. 001/2026)'
    return null
  }

  const fiscalOpts: FiscalOptions = {
    fiscal_regime: fiscalRegime,
    currency: 'EUR',
    discount_pct: parseFloat(discountPct) || undefined,
    discount_fixed: parseFloat(discountFixed) || undefined,
    vat_rate_default: vatRateDefault ?? defaultVatRate ?? undefined,
  }

  return (
    <>
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="items_json" value={JSON.stringify(voci.map(({ _key, ...v }) => v))} />
      <input type="hidden" name="client_id" value={selectedClient?.id ?? ''} />
      <input type="hidden" name="bonus_edilizio" value={bonusEdilizio} />
      {vatRateDefault != null && (
        <input type="hidden" name="vat_rate_default" value={vatRateDefault} />
      )}

      {state?.error && (
        <div ref={errorRef} className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
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
          {/* Numero fattura — prefisso read-only + parte numerica editabile */}
          <div className="space-y-1.5">
            <Label htmlFor="doc_number">
              Numero fattura <span className="text-destructive">*</span>
            </Label>
            {/* Hidden input invia il numero completo (prefisso + numerico) */}
            <input type="hidden" name="doc_number" value={docNumber} />
            <div className="flex items-center rounded-md border bg-background overflow-hidden w-fit focus-within:ring-1 focus-within:ring-ring">
              {docPrefix && (
                <span className="px-2.5 py-2 text-sm font-mono text-muted-foreground bg-muted border-r select-none">
                  {docPrefix}
                </span>
              )}
              <Input
                id="doc_number"
                value={docNumeric}
                onChange={(e) => { setDocNumeric(e.target.value); setDocNumberError(null) }}
                onBlur={(e) => setDocNumberError(validateDocNumeric(e.target.value))}
                placeholder="001/2026"
                className={`border-0 shadow-none rounded-none font-mono w-28 focus-visible:ring-0 ${docNumberError ? 'text-destructive' : ''}`}
              />
            </div>
            {docNumberError && <p className="text-xs text-destructive">{docNumberError}</p>}
            {!docNumberError && (
              <p className="text-xs text-muted-foreground">
                Modifica la parte numerica se necessario.
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

        {/* Validità + Pagamento + Bonus edilizio */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="validity_days">Validità (giorni)</Label>
            <Input id="validity_days" name="validity_days" type="number" min="1" max="365" defaultValue={30} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="payment_terms">Termini di pagamento</Label>
            <Select
              name="payment_terms"
              value={paymentTerms}
              onValueChange={setPaymentTerms}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYMENT_TERMS.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {dueDateHint(paymentTerms, docDate) && (
              <p className="text-xs text-muted-foreground">
                {dueDateHint(paymentTerms, docDate)}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Bonus edilizio</Label>
            <Select
              value={bonusEdilizio || '__none__'}
              onValueChange={(v) => {
                const val = v === '__none__' ? '' : v
                setBonusEdilizio(val)
                if (val) setVatRateDefault(10)
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Nessuno</SelectItem>
                <SelectItem value="ecobonus">Ecobonus</SelectItem>
                <SelectItem value="sismabonus">Sismabonus</SelectItem>
                <SelectItem value="bonus_casa">Bonus Casa</SelectItem>
              </SelectContent>
            </Select>
            {bonusEdilizio && (
              <p className="text-xs text-muted-foreground">
                IVA 10% default attiva. Classifica le voci nella tabella.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Voci ─────────────────────────────────────────────── */}
      <VociTable
        voci={voci}
        onChange={setVoci}
        fiscalRegime={fiscalRegime}
        defaultVatRate={vatRateDefault ?? defaultVatRate}
        vatRates={VAT_RATES}
        units={UNIT_VALUES}
        bonusEdilizio={bonusEdilizio}
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
            <Label htmlFor="discount_fixed">Sconto in €</Label>
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
      <FiscalSummary voci={voci} fiscalOpts={fiscalOpts} bonusEdilizio={bonusEdilizio} />

      {/* ── Azione ───────────────────────────────────────────── */}
      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={isPending || !!docNumberError}
          onClick={() => {
            const err = validateDocNumeric(docNumeric)
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
