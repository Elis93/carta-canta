'use client'

import { useState, useActionState, useEffect, useRef, useCallback } from 'react'
import { QuickCreateClientDialog } from '@/components/shared/QuickCreateClientDialog'
import type { ClientHit as QuickClientHit } from '@/components/shared/QuickCreateClientDialog'
import { Loader2, AlertCircle, Send, ChevronDown } from 'lucide-react'
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
    quantity: 1,    // default 1 — Q.tà 0 dà sempre totale 0
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

// Validazione voci client-side — stessa logica del server, messaggi con "fattura"
function getVociError(items: VoceItem[]): string | null {
  const meaningful = items.filter(v =>
    v.description.trim() !== '' || (v.unit_price ?? 0) > 0 || (v.quantity ?? 0) > 0
  )
  if (meaningful.length === 0) {
    return 'La fattura non ha voci. Aggiungi almeno una voce prima di salvare.'
  }
  const noDesc  = meaningful.some(v => v.description.trim() === '')
  const noPrice = meaningful.some(v => (v.unit_price ?? 0) === 0)
  const noQty   = meaningful.some(v => (v.quantity ?? 0) === 0)
  if (noDesc && noPrice) return 'La descrizione e il prezzo in una o più voci fattura devono essere diversi da zero per salvare.'
  if (noDesc && noQty)   return 'La descrizione e la quantità in una o più voci fattura devono essere diversi da zero per salvare.'
  if (noPrice && noQty)  return 'Il prezzo e la quantità in una o più voci fattura devono essere diversi da zero per salvare.'
  if (noDesc)  return 'La descrizione in una o più voci fattura deve essere inserita per poter salvare.'
  if (noPrice) return 'Il prezzo in una o più voci fattura deve essere diverso da zero per salvare.'
  if (noQty)   return 'La quantità in una o più voci fattura deve essere diversa da zero per salvare.'
  return null
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
  // Traccia quale bottone ha avviato la submit (per mostrare lo spinner solo su quello)
  const [pendingIntent, setPendingIntent] = useState<'save' | 'send' | null>(null)
  // M1: "Altre opzioni" — sempre chiuso alla creazione (FatturaForm è sempre create mode)
  const [altreOpzioniOpen, setAltreOpzioniOpen] = useState(false)

  const [state, formAction, isPending] = useActionState(createInvoiceAction, null)

  // ── Gestione errore unificata (scroll garantito ad ogni tentativo) ─────────
  const [formError, setFormError] = useState<string | null>(null)
  const [formErrorScrollKey, setFormErrorScrollKey] = useState(0)
  const formErrorRef = useRef<HTMLDivElement>(null)
  const isVociErrorRef = useRef(false)

  const showFormError = useCallback((msg: string, isVoci = false) => {
    setFormError(msg)
    isVociErrorRef.current = isVoci
    setFormErrorScrollKey(k => k + 1)
  }, [])

  // Scrolla al banner ogni volta che il counter cambia (anche stesso messaggio)
  useEffect(() => {
    if (formErrorScrollKey > 0 && formErrorRef.current) {
      formErrorRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
      formErrorRef.current.focus()
    }
  }, [formErrorScrollKey])

  // Sincronizza errori server → banner unificato
  useEffect(() => {
    if (state?.error) showFormError(state.error)
  }, [state, showFormError])

  // Auto-cancella l'errore voci quando l'utente lo risolve
  useEffect(() => {
    if (formError && isVociErrorRef.current) {
      const err = getVociError(voci)
      if (!err) { setFormError(null); isVociErrorRef.current = false }
      else if (err !== formError) setFormError(err)
    }
  }, [voci, formError])

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
    <form
      action={formAction}
      onSubmit={(e) => {
        const errors: string[] = []
        // Valida numero fattura
        const numErr = validateDocNumeric(docNumeric)
        if (numErr) { setDocNumberError(numErr); errors.push('Il numero fattura deve essere inserito.') }
        // Valida voci
        const vociErr = getVociError(voci)
        if (vociErr) errors.push(vociErr)
        if (errors.length > 0) {
          e.preventDefault()
          showFormError(errors.join(' '), !numErr && !!vociErr)
        }
      }}
    >
      <input type="hidden" name="items_json" value={JSON.stringify(voci.map(({ _key, ...v }) => v))} />
      <input type="hidden" name="client_id" value={selectedClient?.id ?? ''} />
      <input type="hidden" name="bonus_edilizio" value={bonusEdilizio} />
      {/* intent: 'save' | 'send' — determina se aprire invio email dopo la creazione */}
      <input type="hidden" name="intent" id="fattura-intent" value="save" />
      {vatRateDefault != null && (
        <input type="hidden" name="vat_rate_default" value={vatRateDefault} />
      )}

      {formError && (
        <div
          ref={formErrorRef}
          tabIndex={-1}
          className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive outline-none"
          style={{ marginBottom: 14 }}
        >
          <AlertCircle className="size-4 shrink-0" />
          {formError}
        </div>
      )}

      {/* ── Card 1: Fattura (Numero + Data + Cliente) ────────────── */}
      <div className="cc-card-md" style={{ padding: '14px 15px', display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 14 }}>
        <div className="cc-section-label">Fattura</div>

        {/* Numero + Data — row */}
        <div style={{ display: 'flex', gap: 10 }}>
          {/* Numero */}
          <div style={{ width: 140 }}>
            <div style={{ fontSize: 11, color: 'var(--cc-text-3)', marginBottom: 3 }}>
              Numero <span style={{ color: 'var(--cc-danger)' }}>*</span>
            </div>
            <input type="hidden" name="doc_number" value={docNumber} />
            <div
              style={{
                border: `0.5px solid ${docNumberError ? 'var(--cc-danger)' : 'var(--cc-border-color)'}`,
                borderRadius: 'var(--cc-radius-md)',
                padding: '9px 11px',
                fontSize: 14,
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                background: '#fff',
              }}
            >
              {docPrefix && (
                <span style={{ color: 'var(--cc-text-2)', flexShrink: 0 }}>
                  {docPrefix}
                </span>
              )}
              <input
                id="doc_number"
                value={docNumeric}
                onChange={(e) => { setDocNumeric(e.target.value); setDocNumberError(null) }}
                onBlur={(e) => setDocNumberError(validateDocNumeric(e.target.value))}
                placeholder="001/2026"
                style={{
                  border: 'none',
                  outline: 'none',
                  width: '100%',
                  fontSize: 14,
                  background: 'transparent',
                  color: docNumberError ? 'var(--cc-danger)' : 'var(--cc-text)',
                }}
              />
            </div>
            {docNumberError && (
              <p style={{ fontSize: 11, color: 'var(--cc-danger)', marginTop: 3 }}>{docNumberError}</p>
            )}
          </div>

          {/* Data (read-only, server usa new Date()) */}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: 'var(--cc-text-3)', marginBottom: 3 }}>Data</div>
            <div
              style={{
                border: '0.5px solid var(--cc-border-color)',
                borderRadius: 'var(--cc-radius-md)',
                padding: '9px 11px',
                fontSize: 14,
                color: 'var(--cc-text)',
                background: '#fff',
              }}
            >
              {docDate.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
          </div>
        </div>

        {/* Cliente */}
        <div>
          <ClientAutocomplete
            value={selectedClient}
            onChange={(c: ClientHit | null) => setSelectedClient(c)}
            onCreateNew={() => setQuickCreateOpen(true)}
          />
        </div>
      </div>

      {/* ── Card 2: Voci ──────────────────────────────────────────── */}
      <div className="cc-card-md" style={{ overflow: 'hidden', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 15px', borderBottom: '0.5px solid var(--cc-border-color)' }}>
          <div className="cc-section-label" style={{ marginBottom: 0 }}>Voci</div>
        </div>
        <VociTable
          voci={voci}
          onChange={setVoci}
          fiscalRegime={fiscalRegime}
          defaultVatRate={vatRateDefault ?? defaultVatRate}
          vatRates={VAT_RATES}
          units={UNIT_VALUES}
          bonusEdilizio={bonusEdilizio}
          docType="fattura"
          autoFocusFirst={true}
        />
      </div>

      {/* ── Card 3: Altre opzioni ─────────────────────────────────── */}
      <div className="cc-card-md" style={{ padding: '4px 15px', marginBottom: 14 }}>
        <button
          type="button"
          onClick={() => setAltreOpzioniOpen(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            width: '100%', padding: '13px 0', background: 'none', border: 'none',
            cursor: 'pointer', textAlign: 'left',
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--cc-text)' }}>Altre opzioni</span>
          <ChevronDown
            size={19}
            style={{
              color: 'var(--cc-text-3)',
              transform: altreOpzioniOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s',
            }}
          />
        </button>

        {/* I campi restano nel DOM anche quando chiusi — hidden via className, niente unmount */}
        <div className={altreOpzioniOpen ? 'space-y-4 pb-4' : 'hidden'}>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
            {/* Titolo del lavoro */}
            <div className="space-y-1.5">
              <Label htmlFor="title">Titolo del lavoro</Label>
              <Input id="title" name="title" placeholder="es. Consulenza aprile 2026…" />
            </div>

            {/* Template */}
            <div className="space-y-1.5">
              <Label htmlFor="template_id">Template</Label>
              <Select name="template_id" defaultValue={defaultTemplateId ?? '__classico__'}>
                <SelectTrigger><SelectValue placeholder="Default (Classico)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__classico__">Default (Classico)</SelectItem>
                  {templates.filter(t => t.name !== 'Template predefinito').map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Note pubbliche */}
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

          {/* Scadenza pagamento + Termini + Bonus edilizio */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="validity_days">Scadenza pagamento (giorni)</Label>
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
      </div>

      {/* ── Card 4: Sconti globali ────────────────────────────────── */}
      <div className="cc-card-md" style={{ padding: '14px 15px', display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 14 }}>
        <div className="cc-section-label">Sconti globali</div>
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

      {/* ── Riepilogo fiscale (già cc-card-md internamente) ───────── */}
      <FiscalSummary voci={voci} fiscalOpts={fiscalOpts} bonusEdilizio={bonusEdilizio} docType="fattura" />

      {/* ── Azioni ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 9, marginTop: 18 }}>
        <Button
          type="submit"
          variant="outline"
          disabled={isPending}
          onClick={(e) => {
            // Validazione preventiva (onClick si esegue prima della submit in React 19)
            const numErr = validateDocNumeric(docNumeric)
            const vociErr = getVociError(voci)
            if (numErr || vociErr) {
              e.preventDefault()
              if (numErr) setDocNumberError(numErr)
              showFormError([numErr, vociErr].filter(Boolean).join(' '), !numErr && !!vociErr)
              return
            }
            const el = document.getElementById('fattura-intent') as HTMLInputElement | null
            if (el) el.value = 'save'
            setPendingIntent('save')
          }}
          style={{ flex: 1 }}
        >
          {isPending && pendingIntent === 'save' && <Loader2 className="size-4 animate-spin" />}
          Salva bozza
        </Button>
        <Button
          type="submit"
          disabled={isPending}
          onClick={(e) => {
            const numErr = validateDocNumeric(docNumeric)
            const vociErr = getVociError(voci)
            if (numErr || vociErr) {
              e.preventDefault()
              if (numErr) setDocNumberError(numErr)
              showFormError([numErr, vociErr].filter(Boolean).join(' '), !numErr && !!vociErr)
              return
            }
            const el = document.getElementById('fattura-intent') as HTMLInputElement | null
            if (el) el.value = 'send'
            setPendingIntent('send')
          }}
          style={{
            flex: 1,
            background: 'var(--cc-navy)',
            color: '#fff',
            boxShadow: 'var(--cc-shadow-btn)',
          }}
        >
          {isPending && pendingIntent === 'send' ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
          Invia al cliente
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
