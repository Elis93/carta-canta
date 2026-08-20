'use client'

import Link from 'next/link'
import { useState, useActionState, useEffect, useRef, useCallback } from 'react'
import { QuickCreateClientDialog } from '@/components/shared/QuickCreateClientDialog'
import type { ClientHit as QuickClientHit } from '@/components/shared/QuickCreateClientDialog'
import { Hash, Loader2, AlertCircle, Send, ChevronDown, Plus, X, BadgePercent } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ClientAutocomplete } from '@/components/shared/ClientAutocomplete'
import { FiscalSummary } from '@/app/(app)/preventivi/_components/FiscalSummary'
import { DiscountField } from '@/app/(app)/preventivi/_components/DiscountField'
import { MargineBox } from '@/app/(app)/preventivi/_components/MargineBox'
import { VociTable } from '@/app/(app)/preventivi/_components/VociTable'
import { createInvoiceAction } from '@/lib/actions/documents'
import type { FiscalOptions } from '@/types/index'
import { RitenutaCondominio } from '@/app/(app)/preventivi/_components/RitenutaCondominio'
import { ReverseCharge } from '@/app/(app)/preventivi/_components/ReverseCharge'
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
  /** Costo d'acquisto (062) — solo margine privato, mai al cliente (B.2) */
  unit_cost?: number | null
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
  if (noDesc && noQty)   return 'Compila la descrizione e una quantità diversa da zero in ogni voce della fattura per salvare.'
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
  isProPlan = false,
}: FatturaFormProps) {
  const [selectedClient, setSelectedClient] = useState<ClientHit | null>(null)
  const [quickCreateOpen, setQuickCreateOpen] = useState(false)
  const [voci, setVoci] = useState<VoceItem[]>([newVoce(0)])
  const [discountPct, setDiscountPct] = useState('')
  const [discountFixed, setDiscountFixed] = useState('')
  const [discountOpen, setDiscountOpen] = useState(false)
  // Ritenuta del condominio (081): il riepilogo deve mostrarla mentre si
  // scrive, non solo dopo il salvataggio.
  const [ritenutaPct, setRitenutaPct] = useState(0)
  // Inversione contabile (081)
  const [reverseCharge, setReverseCharge] = useState(false)

  // Split del numero fattura in prefisso (read-only) + parte editabile
  const [docPrefix, docNumericInit] = splitDocNumber(nextInvoiceNumber ?? '')
  const [docNumeric] = useState(docNumericInit) // read-only: numero dalla sequenza fiscale (B.3)
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
    ritenuta_pct: ritenutaPct > 0 ? ritenutaPct : undefined,
    reverse_charge: reverseCharge,
    doc_type: 'fattura',
  }

  // ── Stili pixel-perfect (mockup 06) ──
  const CARD_SHADOW = '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)'
  const SECTION_LABEL: React.CSSProperties = {
    fontSize: 13, fontWeight: 600, letterSpacing: '.07em',
    textTransform: 'uppercase', color: '#6f6d64', marginBottom: 12,
  }
  const FIELD_LABEL: React.CSSProperties = {
    fontSize: 12, fontWeight: 600, letterSpacing: '.05em',
    textTransform: 'uppercase', color: 'var(--cc-muted)', marginBottom: 7,
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

      {/* ── Testata minimal (2 ago, allineata al preventivo): titolo leggero +
          numero nudo. Per le fatture il numero NON si tocca (numerazione
          fiscale, B.3): chip grigio informativo. ── */}
      <div style={{ background: '#fff', borderRadius: 14, boxShadow: CARD_SHADOW, padding: '6px 15px', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            id="title"
            name="title"
            placeholder="Metti il titolo"
            style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', padding: '9px 0', fontSize: 15, color: '#161616', fontFamily: 'inherit' }}
          />
          <input type="hidden" name="doc_number" value={docNumber} />
          {docNumber && (
            <span
              title="Assegnato automaticamente dalla numerazione fiscale"
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 14.5, fontWeight: 600, color: '#55534b', background: '#fff', border: '1.5px dashed rgba(26,26,46,.25)', borderRadius: 9, width: 122, height: 30, flexShrink: 0 }}
            >
              <Hash size={12} /> {docNumber}
            </span>
          )}
        </div>
      </div>

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
          // ⚠️ NIENTE fuoco automatico (Eli, 11 ago): faceva scorrere la
          // pagina all'apertura, nascondendo il cliente da scegliere e
          // «Importa da preventivo» — cioè le due cose che si guardano per
          // prime aprendo una fattura nuova.
          autoFocusFirst={false}
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
          {/* 2 ago sera (scelta Eli): titolo che elenca il contenuto — qui
              niente foto, quindi "Note e condizioni". */}
          <span style={{ ...SECTION_LABEL, marginBottom: 0 }}>Note e condizioni</span>
          <ChevronDown
            size={18}
            style={{
              color: 'var(--cc-muted)',
              transform: altreOpzioniOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s',
            }}
          />
        </button>

        {/* I campi restano nel DOM anche quando chiusi — hidden via className, niente
            unmount. 2 ago sera (Eli, "organizziamo anche l'Altro delle fatture"):
            stessi due blocchi del preventivo — «Note» e «Condizioni», divisori tra
            le voci, Template in fondo (il link "Gestisci i template" è già in Altro). */}
        <div className={altreOpzioniOpen ? 'divide-y divide-[#f0f0f0] pb-3 [&>*]:py-4 [&>*:first-child]:pt-1' : 'hidden'}>

          {/* Sottotitolo blocco 1: le cose che scrivi */}
          <div><span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: '#b08d3e' }}>Note</span></div>

          {/* Note pubbliche */}
          <div>
            <div style={FIELD_LABEL}>Note (visibili al cliente)</div>
            <textarea id="notes" name="notes" placeholder="Condizioni, note aggiuntive…" rows={2} style={{ ...FIELD_BOX, color: '#161616', resize: 'vertical' }} />
          </div>

          {/* Note interne */}
          <div>
            <div style={FIELD_LABEL}>Note interne (non visibili al cliente)</div>
            <textarea id="internal_notes" name="internal_notes" placeholder="Appunti personali, costi, margini…" rows={2} style={{ ...FIELD_BOX, color: '#161616', resize: 'vertical' }} />
          </div>

          {/* Sottotitolo blocco 2: le condizioni del pagamento */}
          <div><span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: '#b08d3e' }}>Condizioni</span></div>

          {/* Scadenza pagamento (giorni) */}
          <div>
            <div style={FIELD_LABEL}>Scadenza pagamento (giorni)</div>
            <input id="validity_days" name="validity_days" type="number" min="1" max="365" defaultValue={30} style={{ ...FIELD_BOX, color: '#161616' }} />
          </div>

          {/* Termini di pagamento */}
          <div>
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

          {/* ⚠️ Spunta «Bonus edilizio» TOLTA dalla UI (collaudo 17 ago, come
              nel preventivo). Stato e hidden input restano: i documenti vecchi
              conservano il valore, i nuovi nascono senza. */}

          {/* Template — in fondo, come nel preventivo */}
          <div>
            <div style={FIELD_LABEL}>Template</div>
            <Select name="template_id" defaultValue={defaultTemplateId ?? '__classico__'}>
              <SelectTrigger style={{ ...FIELD_BOX, height: 'auto' }} className="w-full [&>span]:truncate">
                <SelectValue placeholder="Default (Classico)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__classico__">Default (Classico)</SelectItem>
                {/* Free: template personalizzati (Pro) visibili ma bloccati */}
                {templates.filter(t => t.name !== 'Template predefinito').map((t) => (
                  <SelectItem key={t.id} value={t.id} disabled={!isProPlan}>{t.name}{!isProPlan ? ' · 🔒 Pro' : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!isProPlan && templates.filter(t => t.name !== 'Template predefinito').length > 0 && (
              <p style={{ fontSize: 12, color: 'var(--cc-muted)', marginTop: 6, lineHeight: 1.4 }}>
                I template personalizzati sono una funzione Pro.{' '}
                <Link href="/abbonamento" style={{ color: 'var(--cc-navy)', fontWeight: 600 }}>Torna a Pro per usarli.</Link>
              </p>
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

      {/* Margine complessivo, sopra il riepilogo come nel preventivo (feedback
          Eli 6 ago: "se per ogni voce ho un ricarico del 15%, poi del 20%,
          voglio sapere nel riepilogo finale quanto è la percentuale totale").
          C'era solo sul preventivo: sulla fattura, che è il documento su cui si
          incassa davvero, mancava. 🔒 Resta privato: non entra in nessuna
          superficie vista dal cliente (regola B.2). */}
      <MargineBox
        voci={voci}
        discountPct={discountPct}
        discountFixed={discountFixed}
        // Dal 17 ago (Eli) il costo si vede e si corregge qui, non più nella
        // card della voce.
        onUpdateVoce={(key, updates) =>
          setVoci((prev) => prev.map((v) => (v._key === key ? { ...v, ...updates } : v)))
        }
      />

      {/* ── Riepilogo fiscale (con slot sconto integrato, come nel preventivo) ── */}
      <FiscalSummary
        voci={voci}
        fiscalOpts={fiscalOpts}
        bonusEdilizio={bonusEdilizio}
        docType="fattura"
        discountSlot={
          <DiscountField
            pct={discountPct} setPct={setDiscountPct}
            fixed={discountFixed} setFixed={setDiscountFixed}
            open={discountOpen} setOpen={setDiscountOpen}
          />
        }
      />

      {/* ── Ritenuta del condominio (081) ─────────────────────────
          ⚠️ MAI ai forfettari: sono esenti (art. 1 c.67 L. 190/2014) e il
          loro PDF porta già la dicitura che impedisce al condominio di
          trattenere per sbaglio. */}
      {fiscalRegime !== 'forfettario' && (
        <>
          <RitenutaCondominio onChange={setRitenutaPct} />
          <ReverseCharge onChange={setReverseCharge} />
        </>
      )}

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
            flex: 1, height: 50, boxSizing: 'border-box', borderRadius: 12,
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
