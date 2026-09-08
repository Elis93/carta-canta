'use client'

import Link from 'next/link'
import { useState, useActionState, useEffect, useRef, useCallback } from 'react'
import { QuickCreateClientDialog } from '@/components/shared/QuickCreateClientDialog'
import type { ClientHit as QuickClientHit } from '@/components/shared/QuickCreateClientDialog'
import { Hash, Loader2, AlertCircle, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import { SezioneForm } from '@/components/shared/SezioneForm'
import { RigaTendina } from '@/components/shared/RigaTendina'

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
  // ── Righe a tendina di «Note e condizioni» (riordino 7 set): tutte
  // chiuse alla creazione; si apre solo quella da cambiare. I campi sono
  // controllati per mostrare il valore a destra da chiusi.
  const [righeAperte, setRigheAperte] = useState<Set<string>>(() => new Set())
  const toggleRiga = (id: string) => setRigheAperte((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })
  const [notes, setNotes] = useState('')
  const [internalNotes, setInternalNotes] = useState('')
  const [validityDays, setValidityDays] = useState('30')
  const [templateId, setTemplateId] = useState<string>(defaultTemplateId ?? '__classico__')

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

  // Una voce «compilata» ha una descrizione o un prezzo. ⚠️ NON la quantità:
  // sulla fattura parte da 1 e una voce ancora vuota diceva «1 voce»
  // (screenshot Eli, 8 set).
  const vociCompilate = voci.filter((v) => v.description.trim() !== '' || (v.unit_price ?? 0) > 0).length
  const riepiloghi = {
    note: notes.trim() ? (notes.trim().length > 42 ? `${notes.trim().slice(0, 42)}…` : notes.trim()) : 'nessuna',
    noteInterne: internalNotes.trim() ? 'scritte · solo per te' : 'nessuna',
    validita: `${validityDays || 30} giorni`,
    pagamento: paymentTerms,
    template: templateId === '__classico__' ? 'Classico' : (templates.find((t) => t.id === templateId)?.name ?? 'Classico'),
  }

  // ── Stili pixel-perfect (mockup 06) ──
  const CARD_SHADOW = '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)'
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
      className="space-y-3"
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

      {/* ══ RIORDINO 7 set 2026 — stessa struttura del preventivo: QUATTRO
          SEZIONI con l'etichetta fuori dalla card (Intestazione · Voci ·
          Note e condizioni · Riepilogo). Per le fatture il numero NON si tocca
          (numerazione fiscale, B.3): chip grigio informativo. ══ */}
      <SezioneForm label="Intestazione">
      <div style={{ background: '#fff', borderRadius: 14, boxShadow: CARD_SHADOW, padding: '4px 15px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            id="title"
            name="title"
            placeholder="Inserire qui il titolo"
            style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', padding: '8px 0', fontSize: 15, color: '#161616', fontFamily: 'inherit' }}
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

        <div style={{ borderTop: '1px solid #ededea', paddingTop: 9, display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span className="cc-section-label" style={{ marginBottom: 0 }}>Cliente</span>
        <ClientAutocomplete
          value={selectedClient}
          onChange={(c: ClientHit | null) => setSelectedClient(c)}
          onCreateNew={() => setQuickCreateOpen(true)}
        />
        </div>
      </div>
      </SezioneForm>

      <SezioneForm label="Voci" right={`${vociCompilate} ${vociCompilate === 1 ? 'voce' : 'voci'}`}>
      <div style={{ background: '#fff', borderRadius: 14, boxShadow: CARD_SHADOW, overflow: 'hidden' }}>
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
      </SezioneForm>

      {/* ── Note e condizioni: una riga a tendina per cosa, valore a destra.
          I campi restano nel DOM da chiusi (hidden): viaggiano nella submit. ── */}
      <SezioneForm label="Note e condizioni">
      <div style={{ background: '#fff', borderRadius: 14, boxShadow: CARD_SHADOW, padding: '0 15px' }}>
        <RigaTendina id="note" label="Note al cliente" summary={riepiloghi.note} open={righeAperte.has('note')} onToggle={() => toggleRiga('note')}>
          <textarea id="notes" name="notes" placeholder="esempio: condizioni di pagamento, note aggiuntive" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} style={{ ...FIELD_BOX, color: '#161616', resize: 'vertical' }} />
        </RigaTendina>
        <RigaTendina id="note-interne" label="Note interne" summary={riepiloghi.noteInterne} open={righeAperte.has('note-interne')} onToggle={() => toggleRiga('note-interne')}>
          <textarea id="internal_notes" name="internal_notes" placeholder="esempio: appunti personali, costi, margini" rows={2} value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} style={{ ...FIELD_BOX, color: '#161616', resize: 'vertical' }} />
          <p className="cc-t-sub" style={{ margin: '6px 0 0' }}>Solo per te: il cliente non le vede.</p>
        </RigaTendina>
        <RigaTendina id="validita" label="Scadenza pagamento" summary={riepiloghi.validita} open={righeAperte.has('validita')} onToggle={() => toggleRiga('validita')}>
          <p className="cc-t-sub" style={{ margin: '0 0 6px' }}>Da pagare entro (giorni)</p>
          <input id="validity_days" name="validity_days" type="number" min="1" max="365" value={validityDays} onChange={(e) => setValidityDays(e.target.value)} style={{ ...FIELD_BOX, color: '#161616' }} />
        </RigaTendina>
        <RigaTendina id="pagamento" label="Pagamento" summary={riepiloghi.pagamento} open={righeAperte.has('pagamento')} onToggle={() => toggleRiga('pagamento')}>
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

        </RigaTendina>
        <RigaTendina id="template" label="Template" summary={riepiloghi.template} open={righeAperte.has('template')} onToggle={() => toggleRiga('template')} last>
            <Select name="template_id" value={templateId} onValueChange={setTemplateId}>
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

        </RigaTendina>
      </div>
      </SezioneForm>

      {/* Quando il pannello sconto è chiuso, invia comunque i valori correnti */}
      {!discountOpen && (
        <>
          <input type="hidden" name="discount_pct" value={discountPct} />
          <input type="hidden" name="discount_fixed" value={discountFixed} />
        </>
      )}


      <SezioneForm label="Riepilogo">
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
              hideTitle
        margineSlot={
          <MargineBox
            bare
        voci={voci}
        discountPct={discountPct}
        discountFixed={discountFixed}
        // Dal 17 ago (Eli) il costo si vede e si corregge qui, non più nella
        // card della voce.
        onUpdateVoce={(key, updates) =>
          setVoci((prev) => prev.map((v) => (v._key === key ? { ...v, ...updates } : v)))
        }
      />
        }
      />
      </SezioneForm>

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
