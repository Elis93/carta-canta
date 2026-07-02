'use client'

import { useState, useActionState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { QuickCreateClientDialog } from '@/components/shared/QuickCreateClientDialog'
import type { ClientHit as QuickClientHit } from '@/components/shared/QuickCreateClientDialog'
import { Loader2, AlertCircle, Send, ChevronDown, Plus, X, Settings, BadgePercent } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  const [discountOpen, setDiscountOpen] = useState(false)

  // Split del numero fattura in prefisso (read-only) + parte editabile
  const [docPrefix, docNumericInit] = splitDocNumber(nextInvoiceNumber ?? '')
  const [docNumeric, setDocNumeric] = useState(docNumericInit)
  const docNumber = `${docPrefix}${docNumeric}` // valore completo inviato al server
  const [docNumberError, setDocNumberError] = useState<string | null>(null)

  const [paymentTerms, setPaymentTerms] = useState('30 giorni')
  const docDate = new Date()
  // Bonus edilizio: interruttore on/off + percentuale (come nel preventivo). Il campo salvato
  // `bonus_edilizio` è la percentuale come stringa ('50', '65', …) oppure '' se disattivo.
  const [bonusAttivo, setBonusAttivo] = useState(false)
  const [bonusPerc, setBonusPerc] = useState('50')
  const bonusEdilizio = bonusAttivo ? bonusPerc : ''
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

  // ── Stili pixel-perfect (mockup 06) ──
  const CARD_SHADOW = '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)'
  const SECTION_LABEL: React.CSSProperties = {
    fontSize: 13, fontWeight: 600, letterSpacing: '.07em',
    textTransform: 'uppercase', color: '#6f6d64', marginBottom: 12,
  }
  const FIELD_LABEL: React.CSSProperties = {
    fontSize: 12, fontWeight: 600, letterSpacing: '.05em',
    textTransform: 'uppercase', color: '#8a887f', marginBottom: 7,
  }
  const FIELD_BOX: React.CSSProperties = {
    border: '1px solid #e3e3e6', borderRadius: 10, padding: '11px 12px',
    fontSize: 14, color: '#161616', width: '100%', boxSizing: 'border-box',
    background: '#fff', outline: 'none', fontFamily: 'inherit',
  }
  const HELP_TEXT: React.CSSProperties = {
    fontSize: 12, color: '#767676', marginTop: 6, lineHeight: 1.45,
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

      {/* ── Card 1: Cliente ──────────────────────────────────────── */}
      <div style={{ background: '#fff', borderRadius: 14, boxShadow: CARD_SHADOW, padding: '15px 15px', marginBottom: 14 }}>
        <div style={SECTION_LABEL}>Cliente</div>
        <ClientAutocomplete
          value={selectedClient}
          onChange={(c: ClientHit | null) => setSelectedClient(c)}
          onCreateNew={() => setQuickCreateOpen(true)}
        />
      </div>

      {/* ── Card 2: Voci ──────────────────────────────────────────── */}
      <div style={{ background: '#fff', borderRadius: 14, boxShadow: CARD_SHADOW, overflow: 'hidden', marginBottom: 14 }}>
        <div style={{ padding: '15px 15px 12px' }}>
          <div style={{ ...SECTION_LABEL, marginBottom: 0 }}>Voci fattura</div>
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
      <div style={{ background: '#fff', borderRadius: 14, boxShadow: CARD_SHADOW, padding: '4px 15px 15px', marginBottom: 14 }}>
        <button
          type="button"
          onClick={() => setAltreOpzioniOpen(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            width: '100%', padding: '13px 0', background: 'none', border: 'none',
            cursor: 'pointer', textAlign: 'left',
          }}
        >
          <span style={{ ...SECTION_LABEL, marginBottom: 0 }}>Altre opzioni</span>
          <ChevronDown
            size={18}
            style={{
              color: '#8a887f',
              transform: altreOpzioniOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s',
            }}
          />
        </button>

        {/* I campi restano nel DOM anche quando chiusi — hidden via className, niente unmount */}
        <div className={altreOpzioniOpen ? undefined : 'hidden'} style={{ paddingTop: 3 }}>

          {/* Numero fattura * */}
          <div style={{ marginBottom: 14 }}>
            <div style={FIELD_LABEL}>Numero fattura <span style={{ color: '#b08d3e' }}>*</span></div>
            <input type="hidden" name="doc_number" value={docNumber} />
            <div
              style={{
                ...FIELD_BOX,
                borderColor: docNumberError ? 'var(--cc-danger)' : '#e3e3e6',
                display: 'flex', alignItems: 'center', gap: 3,
              }}
            >
              {docPrefix && (
                <span style={{ color: '#8a887f', flexShrink: 0 }}>{docPrefix}</span>
              )}
              <input
                id="doc_number"
                value={docNumeric}
                onChange={(e) => { setDocNumeric(e.target.value); setDocNumberError(null) }}
                onBlur={(e) => setDocNumberError(validateDocNumeric(e.target.value))}
                placeholder="001/2026"
                style={{
                  border: 'none', outline: 'none', width: '100%', fontSize: 14,
                  background: 'transparent', fontFamily: 'inherit',
                  color: docNumberError ? 'var(--cc-danger)' : '#161616',
                }}
              />
            </div>
            {docNumberError ? (
              <p style={{ fontSize: 12, color: 'var(--cc-danger)', marginTop: 6 }}>{docNumberError}</p>
            ) : (
              <div style={HELP_TEXT}>Assegnato automaticamente alla creazione — modificabile a mano.</div>
            )}
          </div>

          {/* Causale (title) */}
          <div style={{ marginBottom: 14 }}>
            <div style={FIELD_LABEL}>Causale</div>
            <input id="title" name="title" placeholder="es. Rifacimento bagno completo…" style={{ ...FIELD_BOX, color: '#161616' }} />
          </div>

          {/* Template */}
          <div style={{ marginBottom: 14 }}>
            <div style={FIELD_LABEL}>Template</div>
            <Select name="template_id" defaultValue={defaultTemplateId ?? '__classico__'}>
              <SelectTrigger style={{ ...FIELD_BOX, height: 'auto' }} className="w-full [&>span]:truncate">
                <SelectValue placeholder="Default (Classico)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__classico__">Default (Classico)</SelectItem>
                {templates.filter(t => t.name !== 'Template predefinito').map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Link href="/template" style={{ marginTop: 7, display: 'flex', alignItems: 'center', gap: 5, textDecoration: 'none' }}>
              <Settings size={15} style={{ color: '#1a1a2e' }} />
              <span style={{ fontSize: 13, color: '#1a1a2e', fontWeight: 500 }}>Gestisci i template &rarr;</span>
            </Link>
          </div>

          {/* Note pubbliche */}
          <div style={{ marginBottom: 14 }}>
            <div style={FIELD_LABEL}>Note (visibili al cliente)</div>
            <textarea id="notes" name="notes" placeholder="Condizioni, note aggiuntive…" rows={2} style={{ ...FIELD_BOX, color: '#161616', resize: 'vertical' }} />
          </div>

          {/* Note interne */}
          <div style={{ marginBottom: 14 }}>
            <div style={FIELD_LABEL}>Note interne (non visibili al cliente)</div>
            <textarea id="internal_notes" name="internal_notes" placeholder="Appunti personali, costi, margini…" rows={2} style={{ ...FIELD_BOX, color: '#161616', resize: 'vertical' }} />
          </div>

          {/* Scadenza pagamento (giorni) */}
          <div style={{ marginBottom: 14 }}>
            <div style={FIELD_LABEL}>Scadenza pagamento (giorni)</div>
            <input id="validity_days" name="validity_days" type="number" min="1" max="365" defaultValue={30} style={{ ...FIELD_BOX, color: '#161616' }} />
          </div>

          {/* Termini di pagamento */}
          <div style={{ marginBottom: 14 }}>
            <div style={FIELD_LABEL}>Termini di pagamento</div>
            <Select name="payment_terms" value={paymentTerms} onValueChange={setPaymentTerms}>
              <SelectTrigger style={{ ...FIELD_BOX, height: 'auto' }} className="w-full [&>span]:truncate">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_TERMS.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {dueDateHint(paymentTerms, docDate) && (
              <div style={HELP_TEXT}>{dueDateHint(paymentTerms, docDate)}</div>
            )}
          </div>

          {/* Bonus edilizio: interruttore + percentuale (come nel preventivo) */}
          <div>
            <div style={FIELD_LABEL}>Bonus edilizio</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Switch
                id="bonus-edilizio-toggle-fatt"
                checked={bonusAttivo}
                className="data-[state=checked]:bg-[#c9a44c]"
                onCheckedChange={(on) => {
                  setBonusAttivo(on)
                  setVatRateDefault(on ? 10 : null)
                }}
              />
              <label
                htmlFor="bonus-edilizio-toggle-fatt"
                style={{ fontSize: 14, cursor: 'pointer', userSelect: 'none' }}
              >
                Attiva bonus edilizio
              </label>
            </div>
            {bonusAttivo && (
              <div style={{ marginTop: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ position: 'relative', width: 118 }}>
                    <input
                      type="number"
                      min={1}
                      max={110}
                      value={bonusPerc}
                      onChange={(e) => setBonusPerc(e.target.value)}
                      style={{ ...FIELD_BOX, width: 118, padding: '11px 28px 11px 12px' }}
                    />
                    <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: '#8a887f', pointerEvents: 'none' }}>%</span>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#b08d3e', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <BadgePercent size={16} /> Bonus attivo
                  </span>
                </div>
                <div style={{ ...HELP_TEXT, maxWidth: 320 }}>
                  Percentuale di detrazione, indicata al cliente solo a titolo informativo (non è obbligatoria).
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quando il pannello sconto è chiuso, invia comunque i valori correnti */}
      {!discountOpen && (
        <>
          <input type="hidden" name="discount_pct" value={discountPct} />
          <input type="hidden" name="discount_fixed" value={discountFixed} />
        </>
      )}

      {/* ── Riepilogo fiscale (con slot sconto integrato, come nel preventivo) ── */}
      <FiscalSummary
        voci={voci}
        fiscalOpts={fiscalOpts}
        bonusEdilizio={bonusEdilizio}
        docType="fattura"
        discountSlot={
          !discountOpen ? (
            <button
              type="button"
              onClick={() => setDiscountOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 14, fontWeight: 500, color: 'var(--cc-navy)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
            >
              <Plus size={14} /> Aggiungi sconto
            </button>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--cc-text)' }}>Sconto</span>
                <button
                  type="button"
                  onClick={() => { setDiscountPct(''); setDiscountFixed(''); setDiscountOpen(false) }}
                  aria-label="Rimuovi sconto"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--cc-text-3)', padding: 2 }}
                >
                  <X size={18} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="discount_pct" style={{ fontSize: 14 }}>Sconto %</Label>
                  <div className="relative">
                    <Input id="discount_pct" name="discount_pct" type="number" min="0" max="100" step="0.01" placeholder="0" value={discountPct} onChange={(e) => setDiscountPct(e.target.value)} onKeyDown={(e) => { if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault() }} style={{ border: '1px solid #e3e3e6', borderRadius: 10, padding: '11px 28px 11px 12px', fontSize: 15 }} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="discount_fixed" style={{ fontSize: 14 }}>Sconto in €</Label>
                  <div className="relative">
                    <Input id="discount_fixed" name="discount_fixed" type="number" min="0" step="0.01" placeholder="0.00" value={discountFixed} onChange={(e) => setDiscountFixed(e.target.value)} onKeyDown={(e) => { if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault() }} style={{ border: '1px solid #e3e3e6', borderRadius: 10, padding: '11px 28px 11px 12px', fontSize: 15 }} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">€</span>
                  </div>
                </div>
              </div>
            </div>
          )
        }
      />

      {/* ── * Campo obbligatorio ─────────────────────────────────── */}
      <div style={{ fontSize: 14, color: '#b08d3e', margin: '14px 0 10px' }}>* Campo obbligatorio</div>

      {/* ── Azioni ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 11, marginTop: 16 }}>
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
          style={{ flex: 1, height: 50, boxSizing: 'border-box', borderRadius: 12, border: '1px solid #e3e3e6', fontSize: 14, fontWeight: 500 }}
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
            flex: 1.2, height: 50, boxSizing: 'border-box', borderRadius: 12,
            background: '#1a1a2e', color: '#fff', fontSize: 14, fontWeight: 600,
            boxShadow: '0 6px 16px -6px rgba(26,26,46,.5)',
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
