'use client'

import { useState, useActionState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, Plus, X, Trash2, Save, Send, AlertCircle, Hash, CheckCircle2, Info, ChevronDown, BadgePercent, Settings, Camera, Wand2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ClientAutocomplete } from '@/components/shared/ClientAutocomplete'
import { QuickCreateClientDialog } from '@/components/shared/QuickCreateClientDialog'
import type { ClientHit as QuickClientHit } from '@/components/shared/QuickCreateClientDialog'
import { VoiceInput } from '@/components/shared/VoiceInput'
import { FiscalSummary } from './FiscalSummary'
import { VociTable } from './VociTable'
import { AiImportButton } from './AiImportButton'
import { createDocumentAction, saveDraftAction } from '@/lib/actions/documents'
import { roundFiscale, calcolaDocumento } from '@/lib/fiscal/calcoli'
import { ResendReminderDialog } from './ResendReminderDialog'
import type { FiscalOptions } from '@/types/index'
import type { Database } from '@/types/database'
import type { ExtractedItem } from '@/lib/ai/types'
import { UNIT_VALUES } from '@/lib/constants/units'
import { parseImportoIt, formatDocNumber } from '@/lib/utils'

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
  bonus_tipo?: string | null
  /** Opzioni a livelli (041): proposta di appartenenza della voce */
  option_tier?: 'base' | 'consigliata' | 'premium' | null
}

export type OptionTier = 'base' | 'consigliata' | 'premium'
export const OPTION_TIER_LABELS: Record<OptionTier, string> = {
  base: 'Base',
  consigliata: 'Consigliata',
  premium: 'Premium',
}

// Regex formato numero documento: [Prefisso]NNN/YYYY — es. Prev001/2026, Fatt001/2026, 001/2026
const DOC_NUMBER_RE = /^[A-Za-z]*\d{1,6}\/\d{4}$/

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
  /** Validità di default dal workspace (usata in create mode come default del campo) */
  defaultValidityDays?: number
  /** Cliente pre-selezionato (es. da ?client_id= nell'URL o da "Usa come modello") */
  defaultClient?: { id: string; name: string; email: string | null; phone: string | null; piva: string | null } | null
  /** Prefill in create mode (es. da una richiesta del marketplace) */
  initialTitle?: string
  initialInternalNotes?: string
}

const VAT_RATES = [22, 10, 5, 4, 0]
const UNITA = UNIT_VALUES
// Estrazione AI voci dalle note (stesso flag dell'AI import, inlined a build)
const AI_VOCI_ENABLED = process.env.NEXT_PUBLIC_AI_IMPORT_ENABLED === 'true'

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
    quantity: 0,
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
  defaultValidityDays,
  defaultClient = null,
  initialTitle,
  initialInternalNotes,
}: PreventivoFormProps) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const autoSaveRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastSaveRef = useRef<Date | null>(null)
  const isDirtyRef = useRef(false)

  // ── Stato form ─────────────────────────────────────────────
  const [selectedClient, setSelectedClient] = useState<ClientHit | null>(defaultClient ?? null)

  // Sincronizza selectedClient quando defaultClient diventa valorizzato dopo
  // un router.refresh() (es. subito dopo l'invio di una bozza senza cliente:
  // send-email/route.ts associa client_id, ma useState(defaultClient) lo
  // catturava una sola volta al mount e restava null finché non si ricaricava
  // a mano la pagina). Non sovrascriviamo una selezione manuale dell'utente.
  useEffect(() => {
    if (defaultClient && !selectedClient) {
      setSelectedClient(defaultClient)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultClient])
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
          bonus_tipo: item.bonus_tipo ?? null,
        }))
      : [newVoce(0)]
  )
  // Stato controllato per i campi note (serve per appendere testo dalla dettatura vocale)
  const [notesValue, setNotesValue] = useState(defaultValues?.notes ?? '')
  const [internalNotesValue, setInternalNotesValue] = useState(defaultValues?.internal_notes ?? initialInternalNotes ?? '')

  const [discountPct, setDiscountPct] = useState<string>(
    defaultValues?.discount_pct != null ? String(defaultValues.discount_pct) : ''
  )
  const [discountFixed, setDiscountFixed] = useState<string>(
    defaultValues?.discount_fixed != null ? String(defaultValues.discount_fixed) : ''
  )
  const [discountOpen, setDiscountOpen] = useState(
    (defaultValues?.discount_pct != null && Number(defaultValues.discount_pct) > 0) ||
    (defaultValues?.discount_fixed != null && Number(defaultValues.discount_fixed) > 0)
  )
  const _savedPaymentTerms = defaultValues?.payment_terms ?? '30 giorni'
  const _isCustomPayment = PAYMENT_TERMS.indexOf(_savedPaymentTerms) === -1
  const [paymentTerms, setPaymentTerms] = useState<string>(
    _isCustomPayment ? 'Personalizzati' : _savedPaymentTerms
  )
  const [paymentTermsCustom, setPaymentTermsCustom] = useState<string>(
    _isCustomPayment ? _savedPaymentTerms : ''
  )
  // FIX-26: la scadenza stimata si calcola da sent_at (data effettiva invio),
  // non da created_at. Fallback a oggi se il documento non è ancora stato inviato.
  const docDate = defaultValues?.sent_at
    ? new Date(defaultValues.sent_at)
    : new Date()
  // bonus_edilizio ora è la percentuale come stringa ('50', '65', …) oppure '' se disattivo
  const existingBonus = defaultValues?.bonus_edilizio ?? ''
  const [bonusAttivo, setBonusAttivo] = useState(!!existingBonus)
  const [bonusPerc,   setBonusPerc]   = useState(existingBonus || '50')
  // Valore derivato inviato come hidden field: '' se disattivo, altrimenti la percentuale
  const bonusEdilizio = bonusAttivo ? bonusPerc : ''
  // ── Acconto alla conferma (Acconti, migration 038) — solo preventivi ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 038 non ancora in types/database.ts
  const _dvDeposit = defaultValues as any
  const _existingDepositType: 'percent' | 'amount' | null =
    _dvDeposit?.deposit_type === 'percent' || _dvDeposit?.deposit_type === 'amount'
      ? _dvDeposit.deposit_type
      : null
  const [depositAttivo, setDepositAttivo] = useState(
    !!_existingDepositType && _dvDeposit?.deposit_value != null
  )
  const [depositType, setDepositType] = useState<'percent' | 'amount'>(_existingDepositType ?? 'percent')
  // Default 30% (prassi comune per lavori piccoli — decisione Eli), modificabile
  const [depositValue, setDepositValue] = useState<string>(
    _dvDeposit?.deposit_value != null ? String(_dvDeposit.deposit_value).replace('.', ',') : '30'
  )
  // ── Opzioni a livelli (041, SOLO Pro, solo preventivi) — nomi fissi ──
  const [optionsOn, setOptionsOn] = useState<boolean>(_dvDeposit?.options_enabled === true)
  const [activeTier, setActiveTier] = useState<OptionTier>('base')
  const [recommendedTier, setRecommendedTier] = useState<OptionTier | null>(
    _dvDeposit?.recommended_tier === 'base' || _dvDeposit?.recommended_tier === 'consigliata' || _dvDeposit?.recommended_tier === 'premium'
      ? _dvDeposit.recommended_tier
      : 'consigliata'
  )
  const [vatRateDefault, setVatRateDefault] = useState<number | null>(
    defaultVatRate ?? null
  )
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const formErrorRef = useRef<HTMLDivElement>(null)
  // Counter: incrementato ad ogni chiamata di showFormError — garantisce lo scroll anche
  // quando il messaggio di errore è identico a quello precedente (React bailout).
  const [formErrorScrollKey, setFormErrorScrollKey] = useState(0)
  // Indica se l'errore corrente è legato alle voci (consente l'auto-rimozione al cambio voci).
  const isVociErrorRef = useRef(false)
  // T-14: errore sconto globale (mostrato vicino ai campi sconto, non nel banner voci)
  const [discountError, setDiscountError] = useState<string | null>(null)
  const discountSectionRef = useRef<HTMLDivElement>(null)
  const [draftSaved, setDraftSaved] = useState(false)
  const [overlayVariant, setOverlayVariant] = useState<'draft' | 'update' | null>(null)
  // Estrazione AI voci dalle note del sopralluogo (solo create mode)
  const [aiExtracting, setAiExtracting] = useState(false)
  const [showResendDialog, setShowResendDialog] = useState(false)
  // Traccia quale bottone di submit è stato cliccato (create mode) per mostrare lo spinner solo su quello
  const [pendingIntent, setPendingIntent] = useState<string | null>(null)

  // M1: "Altre opzioni" — aperto di default in edit mode se ci sono valori non-standard
  const [altreOpzioniOpen, setAltreOpzioniOpen] = useState(() => {
    // In create mode: aperto se c'è un prefill (es. richiesta marketplace), così si vede
    if (mode !== 'edit') return !!(initialTitle || initialInternalNotes)
    return (
      !!(defaultValues?.title) ||
      !!(defaultValues?.notes) ||
      !!(defaultValues?.internal_notes) ||
      !!(defaultValues?.bonus_edilizio) ||
      !!_existingDepositType ||
      _isCustomPayment ||
      (defaultValues?.payment_terms ?? '30 giorni') !== '30 giorni' ||
      (docType !== 'fattura' && !!(defaultValues?.doc_number))
    )
  })

  // ── Numero documento (controllato) ────────────────────────
  // FIX-22: in create mode per i preventivi non pre-popa il numero (assegnato all'invio).
  // Per le fatture e in edit mode si usa il valore attuale del documento.
  // FIX-8: alcuni documenti legacy hanno ancora il prefisso "Prev"/"Fatt" salvato nel DB
  // (es. "Prev009/2026"). Il campo numero è editabile e va popolato col valore "pulito"
  // (senza prefisso letterale) — altrimenti l'utente vedrebbe/salverebbe "Prev009/2026".
  const [docNumber, setDocNumber] = useState<string>(
    defaultValues?.doc_number?.replace(/^[A-Za-z]+/, '') ??
    (docType === 'fattura' ? (nextDocNumber ?? '') : '')
  )
  const [docNumberError, setDocNumberError] = useState<string | null>(null)

  function validateDocNumber(value: string): string | null {
    // FIX-22: per i preventivi il numero è opzionale (assegnato all'invio)
    // Per le fatture rimane obbligatorio
    if (!value.trim()) {
      return docType === 'fattura' ? 'Il numero è obbligatorio' : null
    }
    if (!DOC_NUMBER_RE.test(value.trim())) return 'Formato non valido (es. 001/2026)'
    return null
  }

  // ── Titolo opzionale ──────────────────────────────────────
  const [titleValue, setTitleValue] = useState(defaultValues?.title ?? initialTitle ?? '')

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
  // In edit mode il form non viene mai submitted (nessun pulsante type="submit" in edit mode);
  // useActionState serve solo per il create mode ("Crea preventivo").
  const [state, formAction, isPending] = useActionState(createDocumentAction, null)

  // Helper: imposta il messaggio di errore e forza sempre lo scroll al banner.
  // isVoci=true → il banner viene rimosso automaticamente quando le voci tornano valide.
  // Usa useCallback con [] perché chiude solo su state setter stabili.
  const showFormError = useCallback((msg: string, isVoci = false) => {
    setFormError(msg)
    isVociErrorRef.current = isVoci
    setFormErrorScrollKey(k => k + 1)
  }, [])

  // ── Salvataggio bozza ──────────────────────────────────────
  // doSave: salva sempre — usato dall'auto-save e da "Aggiorna preventivo".
  // Ritorna { ok, wasAlreadySent } in modo che i click handler manuali possano gestire redirect e dialog.
  const doSave = useCallback(async (): Promise<{ ok: boolean; wasAlreadySent?: boolean; error?: string }> => {
    if (!documentId || !formRef.current) return { ok: false }
    setSaving(true)
    setSaveError(null)
    const fd = new FormData(formRef.current)
    fd.set('items_json', JSON.stringify(voci.map(({ _key, ...v }) => v)))
    fd.set('client_id', selectedClient?.id ?? '')
    fd.set('doc_number', docNumber)
    const result = await saveDraftAction(documentId, fd)
    if (result?.error) {
      // Non chiamare setSaveError qui: i caller decidono come mostrare l'errore
      // (auto-save: silenzioso in basso; salvataggio manuale: banner in cima con scroll)
      setSaving(false)
      return { ok: false, error: result.error }
    }
    lastSaveRef.current = new Date()
    setLastSaved(new Date())
    isDirtyRef.current = false
    setSaving(false)
    return { ok: true, wasAlreadySent: result?.wasAlreadySent }
  }, [documentId, voci, selectedClient, docNumber])

  // doSaveDraft: usato dal click manuale "Salva bozza" su draft → mostra overlay → redirect
  // Per preventivi già inviati (sent/viewed): mostra overlay poi apre ResendReminderDialog
  const doSaveDraft = useCallback(async () => {
    if (!runPreSubmitValidation()) return
    setFormError(null)
    if (!documentId || !formRef.current) return
    setSaving(true)
    setSaveError(null)
    const fd = new FormData(formRef.current)
    fd.set('items_json', JSON.stringify(voci.map(({ _key, ...v }) => v)))
    fd.set('client_id', selectedClient?.id ?? '')
    fd.set('doc_number', docNumber)
    const result = await saveDraftAction(documentId, fd)
    if (result?.error) {
      showFormError(result.error)
      setSaving(false)
      return
    }
    lastSaveRef.current = new Date()
    setLastSaved(new Date())
    isDirtyRef.current = false
    setSaving(false)
    setDraftSaved(true)
    setOverlayVariant('draft')
    if (mode === 'edit' && result?.wasAlreadySent) {
      // Mostra overlay per 1.5s, poi apri il dialog "reinvia?"
      setTimeout(() => {
        setOverlayVariant(null)
        setShowResendDialog(true)
      }, 1500)
    } else {
      // Richiesta Eli (11 lug): l'overlay deve restare leggibile — 4s, col numero in evidenza
      setTimeout(() => router.push(docType === 'fattura' ? '/fatture' : '/preventivi'), 4000)
    }
  }, [documentId, voci, selectedClient, docNumber, router, docType, mode]) // eslint-disable-line react-hooks/exhaustive-deps

  // doSendFromDraft: usato dal click "Invia al cliente" in edit mode su bozza.
  // Valida, salva la bozza (così le modifiche non salvate finiscono nell'invio),
  // poi apre il pop-up canali (ShareButton montato nella pagina di dettaglio)
  // via evento — l'icona Email lì dentro apre il popup email.
  const doSendFromDraft = useCallback(async () => {
    if (!runPreSubmitValidation()) return
    setFormError(null)
    const { ok, error } = await doSave()
    if (!ok) {
      if (error) showFormError(error)
      return
    }
    window.dispatchEvent(new CustomEvent('cartacanta:open-share-dialog', { detail: { documentId } }))
  }, [doSave, showFormError, documentId]) // eslint-disable-line react-hooks/exhaustive-deps

  // doSaveAndRedirect: usato dal click manuale "Aggiorna" su sent/viewed/rejected
  // Se il doc era già inviato: mostra overlay, poi apre ResendReminderDialog (come doSaveDraft)
  // Se non era inviato (rejected/expired): overlay → redirect
  const doSaveAndRedirect = useCallback(async () => {
    if (!runPreSubmitValidation()) return
    const { ok, wasAlreadySent, error } = await doSave()
    if (!ok) {
      if (error) showFormError(error)
      return
    }
    setOverlayVariant('update')
    if (wasAlreadySent) {
      setTimeout(() => {
        setOverlayVariant(null)
        setShowResendDialog(true)
      }, 1500)
    } else {
      setTimeout(() => router.push(docType === 'fattura' ? '/fatture' : '/preventivi'), 1500)
    }
  }, [doSave, router, docType, showFormError]) // eslint-disable-line react-hooks/exhaustive-deps

  // doAutoSave: salva solo se ci sono modifiche (usato dall'interval)
  const doAutoSave = useCallback(async () => {
    if (!isDirtyRef.current) return
    const { ok, error } = await doSave()
    // Auto-save: errori mostrati silenziosamente in basso (non interrompono l'utente)
    if (!ok && error) setSaveError(error)
  }, [doSave])

  useEffect(() => {
    if (mode !== 'edit' || !documentId) return
    autoSaveRef.current = setInterval(doAutoSave, 30_000)
    return () => { if (autoSaveRef.current) clearInterval(autoSaveRef.current) }
  }, [mode, documentId, doAutoSave])

  // Marca dirty su ogni cambio
  const markDirty = () => { isDirtyRef.current = true }

  // Esponi doSave globalmente → ShareButton chiama questo prima di registerManualSendAction
  // così le voci aggiunte ma non salvate vengono salvate automaticamente prima della condivisione.
  useEffect(() => {
    type SaveFn = () => Promise<{ ok: boolean; error?: string }>
    const w = window as typeof window & { __cc_doSave?: SaveFn }
    w.__cc_doSave = doSave
    return () => { delete w.__cc_doSave }
  }, [doSave])

  // Notifica ShareButton del conteggio voci corrente (evita il guard stale sulla prop server-side).
  useEffect(() => {
    const hasVociInForm = voci.some((v) =>
      String(v.description ?? '').trim() !== '' &&
      Number(v.unit_price ?? 0) > 0 &&
      Number(v.quantity ?? 0) > 0
    )
    window.dispatchEvent(new CustomEvent('cartacanta:voci-changed', { detail: { hasVoci: hasVociInForm } }))
  }, [voci])

  // ── Fiscal options per il riepilogo ────────────────────────

  // Reset pendingIntent quando l'action di create mode termina
  useEffect(() => {
    if (!isPending) setPendingIntent(null)
  }, [isPending])

  // Aggiorna/pulisce il formError mentre l'utente modifica le voci,
  // MA solo se l'errore corrente è relativo alle voci (non per errori di server/piano).
  useEffect(() => {
    if (formError && isVociErrorRef.current) {
      const err = getVociError(voci)
      if (!err) { setFormError(null); isVociErrorRef.current = false }
      else if (err !== formError) setFormError(err)
    }
  }, [voci, formError]) // eslint-disable-line react-hooks/exhaustive-deps

  // T-14: ricalcola l'errore sconto man mano che l'utente modifica voci/sconti,
  // così il messaggio sparisce non appena lo sconto torna valido.
  useEffect(() => {
    if (discountError) {
      const err = getDiscountError(voci)
      if (!err) setDiscountError(null)
      else if (err !== discountError) setDiscountError(err)
    }
  }, [voci, discountPct, discountFixed, discountError]) // eslint-disable-line react-hooks/exhaustive-deps

  // Ascolta l'evento emesso da SendEmailDialog quando blocca l'apertura per voci mancanti
  useEffect(() => {
    function handleVociMancanti() {
      const err = getVociError(voci)
      showFormError(err ?? 'Verifica che le voci abbiano quantità e prezzo compilati prima di inviare.', true)
    }
    window.addEventListener('cartacanta:voci-mancanti', handleVociMancanti)
    return () => window.removeEventListener('cartacanta:voci-mancanti', handleVociMancanti)
  }, [showFormError]) // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll garantito al banner errore ogni volta che showFormError viene chiamata,
  // anche quando il messaggio è identico al precedente (React bailout workaround).
  useEffect(() => {
    if (formErrorScrollKey > 0 && formErrorRef.current) {
      formErrorRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
      formErrorRef.current.focus()
    }
  }, [formErrorScrollKey])

  // Propaga gli errori della Server Action (create mode) al banner unificato con scroll.
  // state cambia riferimento ad ogni action call, quindi questo effect si attiva correttamente
  // anche se il messaggio di errore è lo stesso della chiamata precedente.
  useEffect(() => {
    if (state?.error) showFormError(state.error)
  }, [state, showFormError])

  // Restituisce il messaggio di errore voci contestuale, oppure null se tutto è ok.
  //
  // Una voce è "inserita" se l'utente ha compilato almeno uno tra descrizione, prezzo o quantità.
  // Le righe vuote di default vengono ignorate (il form parte sempre con una riga vuota).
  //
  // Controlla le combinazioni prima dei singoli campi: se in voci diverse mancano campi
  // diversi (es. voce1 senza prezzo, voce2 senza quantità) il messaggio riflette entrambi.
  function getVociError(items: VoceItem[]): string | null {
    const meaningfulVoci = items.filter(v =>
      v.description.trim() !== '' || (v.unit_price ?? 0) > 0 || (v.quantity ?? 0) > 0
    )
    if (meaningfulVoci.length === 0) {
      return 'Il preventivo non ha voci. Aggiungi almeno una voce prima di salvare o inviare.'
    }

    const noDesc  = meaningfulVoci.some(v => v.description.trim() === '')
    const noPrice = meaningfulVoci.some(v => (v.unit_price ?? 0) === 0)
    const noQty   = meaningfulVoci.some(v => (v.quantity ?? 0) === 0)

    // Combinazioni a due campi
    if (noDesc && noPrice) return 'La descrizione e il prezzo in una o più voci preventivo devono essere diversi da zero per salvare o inviare.'
    if (noDesc && noQty)   return 'La descrizione e la quantità in una o più voci preventivo devono essere diversi da zero per salvare o inviare.'
    if (noPrice && noQty)  return 'Il prezzo e la quantità in una o più voci preventivo devono essere diversi da zero per salvare o inviare.'

    // Campo singolo
    if (noDesc)  return 'La descrizione in una o più voci preventivo deve essere inserita per poter salvare o inviare il preventivo.'
    if (noPrice) return 'Il prezzo in una o più voci preventivo deve essere diverso da zero per salvare o inviare.'
    if (noQty)   return 'La quantità in una o più voci preventivo deve essere diversa da zero per salvare o inviare.'

    return null
  }

  // T-14: lo sconto globale (% + fisso) non può superare il subtotale delle voci —
  // in tal caso il documento avrebbe un totale negativo. Ritorna un messaggio
  // specifico da mostrare vicino ai campi sconto, oppure null se tutto ok.
  function getDiscountError(items: VoceItem[]): string | null {
    const subtotal = roundFiscale(
      items.reduce((s, v) => s + v.quantity * v.unit_price * (1 - ((v.discount_pct ?? 0) / 100)), 0)
    )
    const pct = parseFloat(discountPct) || 0
    const fixed = parseFloat(discountFixed) || 0
    if (pct === 0 && fixed === 0) return null
    const afterDiscount = roundFiscale(subtotal * (1 - pct / 100) - fixed)
    if (afterDiscount < 0) {
      const fmt = (v: number) => v.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      return `Lo sconto globale (€ ${fmt(subtotal - afterDiscount)}) supera il totale delle voci (€ ${fmt(subtotal)}). Riduci lo sconto.`
    }
    return null
  }

  // Esegue le validazioni client-side comuni a submit/salvataggio.
  // Ritorna true se tutto ok, false se ha bloccato (e mostrato l'errore appropriato).
  function runPreSubmitValidation(): boolean {
    const vociErr = getVociError(voci)
    if (vociErr) {
      showFormError(vociErr, true)
      return false
    }
    const discErr = getDiscountError(voci)
    if (discErr) {
      setDiscountError(discErr)
      discountSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return false
    }
    setDiscountError(null)
    return true
  }

  // Validazione client-side prima della submit in create mode
  function handleFormSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!runPreSubmitValidation()) {
      e.preventDefault()
      return
    }
    setFormError(null)
  }

  const fiscalOpts: FiscalOptions = {
    fiscal_regime: fiscalRegime,
    currency: 'EUR',
    discount_pct: parseFloat(discountPct) || undefined,
    discount_fixed: parseFloat(discountFixed) || undefined,
    vat_rate_default: vatRateDefault ?? undefined,
  }

  // ── Opzioni a livelli: voci della proposta attiva + gestione tier ──
  const optionsActive = docType !== 'fattura' && optionsOn
  const activeVoci = optionsActive
    ? voci.filter((v) => (v.option_tier ?? 'base') === activeTier)
    : voci

  // Appunti del sopralluogo → voci compilate (POST /api/ai/extract-voci).
  // Le voci estratte SOSTITUISCONO solo le righe vuote; prezzi e quantità
  // restano da verificare (l'AI abbassa la confidence quando non è sicura).
  async function handleAiExtractVoci() {
    const text = (internalNotesValue ?? '').trim()
    if (text.length < 5 || aiExtracting) return
    setAiExtracting(true)
    try {
      const res = await fetch('/api/ai/extract-voci', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data?.error ?? 'Estrazione non riuscita.', { duration: 10_000, closeButton: true })
        return
      }
      const known = new Set(UNITA.map((u) => u.toLowerCase()))
      const extracted: VoceItem[] = (data.items ?? []).map((it: { description: string; unit?: string; quantity?: number; unit_price?: number }, i: number) => ({
        _key: `ai-${Date.now()}-${i}`,
        sort_order: i,
        description: String(it.description ?? '').slice(0, 500),
        unit: known.has(String(it.unit ?? '').toLowerCase()) ? String(it.unit).toLowerCase() : 'pz',
        quantity: Number(it.quantity ?? 1) > 0 ? Number(it.quantity ?? 1) : 1,
        unit_price: Number(it.unit_price ?? 0) >= 0 ? Number(it.unit_price ?? 0) : 0,
        discount_pct: null,
        vat_rate: null,
      }))
      if (extracted.length === 0) {
        toast.info('Nelle note non ho trovato voci da compilare.', { duration: 10_000, closeButton: true })
        return
      }
      // Tieni le righe già compilate a mano, rimpiazza solo quelle vuote
      const manual = activeVoci.filter((v) => v.description.trim() !== '')
      handleVociChange([...manual, ...extracted].map((v, i) => ({ ...v, sort_order: i })))
      if (!titleValue && data.suggested_title) setTitleValue(String(data.suggested_title).slice(0, 200))
      toast.success(`${extracted.length} ${extracted.length === 1 ? 'voce compilata' : 'voci compilate'} dalle note — controlla descrizioni, prezzi e quantità.`, { duration: 10_000, closeButton: true })
    } catch {
      toast.error('Estrazione non riuscita. Riprova tra qualche istante.', { duration: 10_000, closeButton: true })
    } finally {
      setAiExtracting(false)
    }
  }

  function handleVociChange(updated: VoceItem[]) {
    if (!optionsActive) { setVoci(updated); markDirty(); return }
    // Le voci nuove/modificate appartengono alla proposta attiva;
    // le voci delle altre proposte restano intatte.
    const stamped = updated.map((v) => ({ ...v, option_tier: v.option_tier ?? activeTier }))
    const others = voci.filter((v) => (v.option_tier ?? 'base') !== activeTier)
    setVoci([...others, ...stamped])
    markDirty()
  }

  function enableOptions() {
    // Le voci correnti diventano la Base e si DUPLICANO nelle altre proposte
    // come punto di partenza (cancellabili una a una — decisione Eli).
    const base = voci.map((v) => ({ ...v, option_tier: 'base' as const }))
    const duplicate = (tier: OptionTier) =>
      base
        .filter((v) => v.description.trim() !== '' || v.unit_price > 0)
        .map((v, i) => ({ ...v, _key: `${tier}-${Date.now()}-${i}-${Math.random()}`, id: undefined, option_tier: tier }))
    setVoci([...base, ...duplicate('consigliata'), ...duplicate('premium')])
    setOptionsOn(true)
    setActiveTier('base')
    if (!recommendedTier) setRecommendedTier('consigliata')
    markDirty()
  }

  function disableOptions() {
    // Spegnendo il toggle restano SOLO le voci della Base
    const base = voci
      .filter((v) => (v.option_tier ?? 'base') === 'base')
      .map((v, i) => ({ ...v, option_tier: null, sort_order: i }))
    setVoci(base.length > 0 ? base : voci.slice(0, 1).map((v) => ({ ...v, option_tier: null })))
    setOptionsOn(false)
    markDirty()
  }

  // Anteprima acconto: fa i conti da sola sul totale corrente (come FiscalSummary)
  const depositCalcVoci = optionsActive
    ? voci.filter((v) => (v.option_tier ?? 'base') === (recommendedTier ?? 'base'))
    : voci
  const depositPreview = (() => {
    if (docType === 'fattura' || !depositAttivo) return null
    const itemsForCalc = depositCalcVoci.map((v) => ({
      id: v.id ?? '',
      document_id: '',
      sort_order: v.sort_order,
      description: v.description,
      unit: v.unit,
      quantity: v.quantity,
      unit_price: v.unit_price,
      discount_pct: v.discount_pct,
      vat_rate: v.vat_rate,
      bonus_tipo: v.bonus_tipo ?? null,
      total: 0,
      ai_generated: false as boolean | null,
      ai_confidence: null as number | null,
    }))
    const total = calcolaDocumento(itemsForCalc, fiscalOpts).total
    const raw = parseImportoIt(depositValue)
    if (total <= 0 || !Number.isFinite(raw) || raw <= 0) return null
    const acconto = depositType === 'percent'
      ? roundFiscale((total * Math.min(raw, 100)) / 100)
      : roundFiscale(Math.min(raw, total))
    if (acconto <= 0) return null
    return { acconto, saldo: roundFiscale(total - acconto) }
  })()
  const fmtEuro = (v: number) =>
    `€ ${v.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <>
    <form
      ref={formRef}
      action={formAction}
      onSubmit={handleFormSubmit}
      onChange={markDirty}
      noValidate
      className="space-y-4"
    >
      {/* Hidden: items, client, bonus, vat default */}
      <input type="hidden" name="items_json" value={JSON.stringify(voci.map(({ _key, ...v }) => v))} />
      <input type="hidden" name="client_id" value={selectedClient?.id ?? ''} />
      <input type="hidden" name="bonus_edilizio" value={bonusEdilizio} />
      {/* Acconto: '' = disattivo (azzera i campi al salvataggio) */}
      <input type="hidden" name="deposit_type" value={docType !== 'fattura' && depositAttivo ? depositType : ''} />
      <input type="hidden" name="deposit_value" value={docType !== 'fattura' && depositAttivo ? depositValue : ''} />
      {/* Opzioni a livelli (041): 'true' quando attive */}
      <input type="hidden" name="options_enabled" value={optionsActive ? 'true' : ''} />
      <input type="hidden" name="recommended_tier" value={optionsActive ? (recommendedTier ?? '') : ''} />
      {vatRateDefault != null && (
        <input type="hidden" name="vat_rate_default" value={vatRateDefault} />
      )}
      {/* Quando il pannello sconto è chiuso, invia i valori correnti (anche vuoti) */}
      {!discountOpen && (
        <>
          <input type="hidden" name="discount_pct" value={discountPct} />
          <input type="hidden" name="discount_fixed" value={discountFixed} />
        </>
      )}

      {/* Banner errore unificato — client-side e server-side passano tutti da qui.
          Il ref + formErrorScrollKey garantiscono lo scroll ad ogni click, anche
          se il messaggio è lo stesso del tentativo precedente. */}
      {formError && (
        <div
          ref={formErrorRef}
          tabIndex={-1}
          className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive outline-none"
        >
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          {formError}
        </div>
      )}

      {/* ── Card 1: Cliente / Fattura ─────────────────────────── */}
      <div className="cc-card-md" data-tour="cliente" style={{ padding: '15px 15px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="cc-section-label" style={{ marginBottom: 0 }}>
          {docType === 'fattura' ? 'Fattura' : 'Cliente'}
        </div>

        {/* ── Numero fattura (sempre visibile per le fatture) ── */}
        {docType === 'fattura' && (
          <div className="space-y-1.5">
            <Label htmlFor="doc_number">
              Numero fattura <span style={{ color: '#b08d3e' }}>*</span>
            </Label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:flex-none">
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
                  placeholder="es. 001/2026"
                  className={`pl-7 font-mono w-full sm:w-44 ${docNumberError ? 'border-destructive' : ''}`}
                />
              </div>
            </div>
            {docNumberError && (
              <p className="text-xs text-destructive">{docNumberError}</p>
            )}
            {!docNumberError && (
              <p className="text-xs text-muted-foreground">
                Modifica la parte numerica se necessario.
              </p>
            )}
          </div>
        )}

        {/* ── Cliente — sempre visibile ── */}
        <div className="space-y-1.5">
          <ClientAutocomplete
            value={selectedClient}
            onChange={(c: ClientHit | null) => {
              setSelectedClient(c)
              markDirty()
              // Notifica SendEmailDialogController del cambio cliente in tempo reale
              if (typeof window !== 'undefined') {
                const displayName = c ? [c.name, (c as { surname?: string | null }).surname].filter(Boolean).join(' ') : null
                window.dispatchEvent(new CustomEvent('cartacanta:client-changed', {
                  detail: { email: c?.email ?? null, hasClient: !!c, name: displayName }
                }))
              }
            }}
            onCreateNew={() => setQuickCreateOpen(true)}
          />
        </div>
      </div>

      {/* ── Card 2: Voci ─────────────────────────────────────── */}
      {/* padding: 0 → l'header (15px) e le righe (15px) danno il rientro; così titolo e
          riquadri sono allineati a 15px come le card Cliente/Altre opzioni, e la linea
          divisoria sotto il titolo va a tutta larghezza. */}
      <div className="cc-card-md" style={{ overflow: 'hidden', padding: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 15px', borderBottom: '0.5px solid var(--cc-border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="cc-section-label" style={{ marginBottom: 0 }}>{docType === 'fattura' ? 'Voci fattura' : 'Voci preventivo'}</div>
          </div>
          <AiImportButton
            isProPlan={isProPlan}
            onItemsExtracted={handleAiItems}
          />
        </div>
        {/* ── Opzioni a livelli (mockup cantiere §3.1) — solo preventivi ── */}
        {docType !== 'fattura' && (
          <div style={{ padding: '12px 15px', borderBottom: '0.5px solid var(--cc-border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 14, fontWeight: 500, color: '#161616' }}>
                  Proponi più opzioni
                  {!isProPlan && (
                    <span style={{ background: '#f5e9d0', color: '#b0863e', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, letterSpacing: '.03em' }}>
                      🔒 PRO
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: '#8a887f', marginTop: 2, lineHeight: 1.4 }}>
                  Il cliente sceglie tra 2-3 proposte con prezzi diversi
                </div>
              </div>
              {isProPlan ? (
                <Switch
                  checked={optionsOn}
                  className="data-[state=checked]:bg-[#c9a44c]"
                  onCheckedChange={(on) => (on ? enableOptions() : disableOptions())}
                />
              ) : (
                <Link href="/abbonamento" style={{ fontSize: 12, fontWeight: 600, color: 'var(--cc-navy)', textDecoration: 'none', flexShrink: 0 }}>
                  Passa a Pro
                </Link>
              )}
            </div>

            {optionsActive && (
              <div style={{ marginTop: 12 }}>
                {/* Tab con i tre nomi FISSI */}
                <div style={{ display: 'flex', gap: 4, background: '#f2f2f4', borderRadius: 999, padding: '3px 4px' }}>
                  {(['base', 'consigliata', 'premium'] as const).map((tier) => (
                    <button
                      key={tier}
                      type="button"
                      onClick={() => setActiveTier(tier)}
                      style={{
                        flex: tier === 'consigliata' ? 1.2 : 1, textAlign: 'center', fontSize: 12, fontWeight: 600,
                        padding: '6px 0', borderRadius: 999, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                        background: activeTier === tier ? '#fff' : 'transparent',
                        color: activeTier === tier ? '#1a1a2e' : '#55534b',
                        boxShadow: activeTier === tier ? '0 1px 3px rgba(20,20,40,.12)' : 'none',
                      }}
                    >
                      {OPTION_TIER_LABELS[tier]}{recommendedTier === tier ? ' ★' : ''}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 11 }}>
                  <span style={{ fontSize: 13, color: '#161616' }}>
                    Segna come &ldquo;Consigliata&rdquo; <span style={{ color: '#b08d3e' }}>★</span>
                  </span>
                  <Switch
                    checked={recommendedTier === activeTier}
                    className="data-[state=checked]:bg-[#c9a44c]"
                    onCheckedChange={(on) => { setRecommendedTier(on ? activeTier : null); markDirty() }}
                  />
                </div>
                <p style={{ fontSize: 12, color: '#767676', lineHeight: 1.5, marginTop: 8 }}>
                  Le voci della Base sono state copiate nelle altre proposte: cancella quelle che non
                  servono e adatta prezzi e descrizioni. I nomi Base / Consigliata / Premium sono fissi.
                </p>
              </div>
            )}
          </div>
        )}
        {/* Estrazione AI: appunti del sopralluogo → voci (solo create, flag AI attivo) */}
        {mode === 'create' && AI_VOCI_ENABLED && (internalNotesValue ?? '').trim().length >= 5 && (
          <button
            type="button"
            onClick={() => void handleAiExtractVoci()}
            disabled={aiExtracting}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              width: '100%', border: '1px solid #e8d6ad', borderRadius: 11, background: '#fdf9ef',
              color: '#b0863e', fontSize: 13, fontWeight: 600, padding: '11px 0', marginBottom: 12,
              cursor: 'pointer', fontFamily: 'inherit', opacity: aiExtracting ? 0.65 : 1,
            }}
          >
            {aiExtracting ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />}
            {aiExtracting ? 'Sto leggendo le note…' : 'Compila le voci dalle note (AI)'}
          </button>
        )}
        <VociTable
          voci={activeVoci}
          onChange={handleVociChange}
          fiscalRegime={fiscalRegime}
          defaultVatRate={vatRateDefault}
          vatRates={VAT_RATES}
          units={UNITA}
          bonusEdilizio={bonusEdilizio}
          autoFocusFirst={mode === 'create'}
        />
        {mode === 'create' && (
          <p style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12, color: '#767676', lineHeight: 1.5, margin: '10px 2px 4px' }}>
            <Camera size={14} style={{ flexShrink: 0, marginTop: 2, color: '#8a887f' }} aria-hidden />
            <span>
              Vuoi allegare delle <b style={{ color: '#55534b' }}>foto</b>? Salva la bozza: nel
              dettaglio trovi la card &laquo;Foto lavoro&raquo; (le foto di un sopralluogo
              trasformato si collegano da sole).
            </span>
          </p>
        )}
      </div>

      {/* ── Card 3: Altre opzioni ────────────────────────────── */}
      <div className="cc-card-md" style={{ padding: '4px 15px' }}>
        <button
          type="button"
          onClick={() => setAltreOpzioniOpen(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            width: '100%', padding: '13px 0', background: 'none', border: 'none',
            cursor: 'pointer', textAlign: 'left',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: '#6f6d64' }}>Altre opzioni</span>
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
        <div className={altreOpzioniOpen ? 'space-y-5 pb-4 pt-3' : 'hidden'}>

          {/* Numero preventivo (per i preventivi: opzionale) */}
          {docType !== 'fattura' && (
            <div className="space-y-1.5">
              <Label htmlFor="doc_number" style={{ fontSize: 12, fontWeight: 600, color: '#8a887f', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Numero preventivo
              </Label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1 sm:flex-none">
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
                    placeholder="es. 001/2026"
                    className={`pl-7 font-mono w-full sm:w-44 ${docNumberError ? 'border-destructive' : ''}`}
                    style={{ border: docNumberError ? undefined : '1px solid #e3e3e6', borderRadius: 10, padding: '11px 12px', paddingLeft: 28, fontSize: 15 }}
                  />
                </div>
              </div>
              {docNumberError && (
                <p className="text-xs text-destructive">{docNumberError}</p>
              )}
              {!docNumberError && (
                <p className="text-[12px]" style={{ color: '#767676' }}>
                  Assegnato automaticamente alla creazione.
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">

            {/* ── Titolo del lavoro ── */}
            <div className="space-y-1.5">
              <Label htmlFor="title" style={{ fontSize: 12, fontWeight: 600, color: '#8a887f', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Titolo del lavoro
              </Label>
              <Input
                id="title"
                name="title"
                placeholder="es. Impianto elettrico abitazione…"
                value={titleValue}
                onChange={(e) => { setTitleValue(e.target.value); markDirty() }}
                style={{ border: '1px solid #e3e3e6', borderRadius: 10, padding: '11px 12px', fontSize: 15 }}
              />
            </div>

            {/* Template */}
            <div className="space-y-1.5">
              <Label htmlFor="template_id" style={{ fontSize: 12, fontWeight: 600, color: '#8a887f', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Template</Label>
              <Select
                name="template_id"
                defaultValue={
                  ((defaultValues as Record<string, unknown> | undefined)?.template_id as string | undefined)
                  ?? defaultTemplateId
                  ?? '__classico__'
                }
              >
                <SelectTrigger style={{ border: '1px solid #e3e3e6', borderRadius: 10, padding: '11px 12px', fontSize: 15, height: 'auto' }}>
                  <SelectValue placeholder="Default (Classico)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__classico__">Default (Classico)</SelectItem>
                  {templates.filter(t => t.name !== 'Template predefinito').map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 2 }}>
                <Link href="/template" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 14, color: '#1a1a2e', fontWeight: 500, textDecoration: 'none' }}>
                  <Settings size={15} />
                  Gestisci i template →
                </Link>
              </div>
            </div>
          </div>

          {/* Note pubbliche */}
          <div className="space-y-2">
            <Label htmlFor="notes" style={{ fontSize: 12, fontWeight: 600, color: '#8a887f', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Note <span>(visibili al cliente)</span>
            </Label>
            <div className="relative">
              <Textarea
                id="notes"
                name="notes"
                placeholder="Condizioni, note aggiuntive…"
                value={notesValue}
                className="resize-none overflow-hidden"
                style={{ minHeight: '40px', fontSize: 15, border: '1px solid #e3e3e6', borderRadius: 10, padding: '11px 36px 11px 12px' }}
                ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' } }}
                onChange={(e) => {
                  e.target.style.height = 'auto'
                  e.target.style.height = e.target.scrollHeight + 'px'
                  setNotesValue(e.target.value)
                }}
              />
              <VoiceInput
                compact
                onTranscript={(t) =>
                  setNotesValue((prev) => prev ? `${prev} ${t}` : t)
                }
                className="absolute right-[11px] top-[11px] text-[#8a887f]"
              />
            </div>
          </div>

          {/* Note interne */}
          <div className="space-y-2">
            <Label htmlFor="internal_notes" style={{ fontSize: 12, fontWeight: 600, color: '#8a887f', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Note interne <span>(non visibili al cliente)</span>
            </Label>
            <div className="relative">
              <Textarea
                id="internal_notes"
                name="internal_notes"
                placeholder="Appunti personali, costi, margini…"
                value={internalNotesValue}
                className="resize-none overflow-hidden"
                style={{ minHeight: '40px', fontSize: 15, border: '1px solid #e3e3e6', borderRadius: 10, padding: '11px 36px 11px 12px' }}
                ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' } }}
                onChange={(e) => {
                  e.target.style.height = 'auto'
                  e.target.style.height = e.target.scrollHeight + 'px'
                  setInternalNotesValue(e.target.value)
                }}
              />
              <VoiceInput
                compact
                onTranscript={(t) =>
                  setInternalNotesValue((prev) => prev ? `${prev} ${t}` : t)
                }
                className="absolute right-[11px] top-[11px] text-[#8a887f]"
              />
            </div>
          </div>

          {/* Il preventivo vale (giorni) + Pagamento + Bonus edilizio */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="validity_days" style={{ fontSize: 12, fontWeight: 600, color: '#8a887f', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                {docType === 'fattura' ? 'Scadenza pagamento (giorni)' : 'Il preventivo vale (giorni)'}
              </Label>
              <Input
                id="validity_days"
                name="validity_days"
                type="number"
                min="1"
                max="365"
                defaultValue={defaultValues?.validity_days ?? defaultValidityDays ?? 30}
                style={{ border: '1px solid #e3e3e6', borderRadius: 10, padding: '11px 12px', fontSize: 15 }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payment_terms" style={{ fontSize: 12, fontWeight: 600, color: '#8a887f', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Termini di pagamento</Label>
              {/* Hidden: invia il valore computato (custom text se Personalizzati) */}
              <input
                type="hidden"
                name="payment_terms"
                value={paymentTerms === 'Personalizzati' ? paymentTermsCustom : paymentTerms}
              />
              <Select
                value={paymentTerms}
                onValueChange={(v) => { setPaymentTerms(v); markDirty() }}
              >
                <SelectTrigger style={{ border: '1px solid #e3e3e6', borderRadius: 10, padding: '11px 12px', fontSize: 15, height: 'auto' }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_TERMS.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {paymentTerms === 'Personalizzati' && (
                <Textarea
                  placeholder="Scrivi tu le condizioni: appariranno sul preventivo…"
                  value={paymentTermsCustom}
                  className="resize-none overflow-hidden"
                  style={{ minHeight: '40px', fontSize: 15, border: '1px solid #e3e3e6', borderRadius: 10, padding: '11px 12px' }}
                  ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' } }}
                  onChange={(e) => {
                    e.target.style.height = 'auto'
                    e.target.style.height = e.target.scrollHeight + 'px'
                    setPaymentTermsCustom(e.target.value)
                    markDirty()
                  }}
                />
              )}
              {docType === 'fattura' && dueDateHint(paymentTerms, docDate) && (
                <p className="text-xs text-muted-foreground">
                  {dueDateHint(paymentTerms, docDate)}
                </p>
              )}
            </div>
            {/* ── Bonus edilizio: toggle + percentuale ── */}
            <div className="space-y-2">
              <Label style={{ fontSize: 12, fontWeight: 600, color: '#8a887f', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Bonus edilizio</Label>
              <div className="flex items-center gap-3">
                <Switch
                  id="bonus-edilizio-toggle"
                  checked={bonusAttivo}
                  className="data-[state=checked]:bg-[#c9a44c]"
                  onCheckedChange={(on) => {
                    setBonusAttivo(on)
                    if (on) setVatRateDefault(10)
                    else setVatRateDefault(null)
                    markDirty()
                  }}
                />
                <label
                  htmlFor="bonus-edilizio-toggle"
                  className="text-sm leading-none cursor-pointer select-none"
                >
                  Attiva bonus edilizio
                </label>
              </div>
              {bonusAttivo && (
                <div className="space-y-1.5">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div className="relative" style={{ width: 118 }}>
                      <Input
                        type="number"
                        min={1}
                        max={110}
                        value={bonusPerc}
                        onChange={(e) => { setBonusPerc(e.target.value); markDirty() }}
                        className="pr-7"
                        style={{ width: 118, border: '1px solid #e3e3e6', borderRadius: 10, padding: '11px 28px 11px 12px', fontSize: 15 }}
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                        %
                      </span>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#b08d3e', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <BadgePercent size={16} /> Bonus attivo
                    </span>
                  </div>
                  <p className="text-[12px]" style={{ color: '#767676', maxWidth: 320 }}>
                    Percentuale di detrazione, indicata al cliente solo a titolo informativo (non è obbligatoria).
                    {fiscalRegime === 'ordinario' && ' In regime ordinario le voci usano l\'IVA agevolata 10%.'}
                  </p>
                </div>
              )}
            </div>
            {/* ── Acconto alla conferma (solo preventivi) ── */}
            {docType !== 'fattura' && (
              <div className="space-y-2">
                <Label style={{ fontSize: 12, fontWeight: 600, color: '#8a887f', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Acconto</Label>
                <div className="flex items-center gap-3">
                  <Switch
                    id="deposit-toggle"
                    checked={depositAttivo}
                    className="data-[state=checked]:bg-[#c9a44c]"
                    onCheckedChange={(on) => { setDepositAttivo(on); markDirty() }}
                  />
                  <label
                    htmlFor="deposit-toggle"
                    className="text-sm leading-none cursor-pointer select-none"
                  >
                    Chiedi un acconto alla conferma
                  </label>
                </div>
                {depositAttivo && (
                  <div className="space-y-1.5">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <div style={{ display: 'flex', background: '#f2f2f4', borderRadius: 999, padding: 3, width: 110, flexShrink: 0 }}>
                        {(['percent', 'amount'] as const).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => { setDepositType(t); markDirty() }}
                            style={{
                              flex: 1, textAlign: 'center', fontSize: 12, padding: '5px 0',
                              borderRadius: 999, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                              background: depositType === t ? '#fff' : 'transparent',
                              color: depositType === t ? '#1a1a2e' : '#55534b',
                              fontWeight: depositType === t ? 600 : 400,
                              boxShadow: depositType === t ? '0 1px 3px rgba(20,20,40,.12)' : 'none',
                            }}
                          >
                            {t === 'percent' ? '%' : '€'}
                          </button>
                        ))}
                      </div>
                      <div className="relative" style={{ width: 118 }}>
                        <Input
                          inputMode="decimal"
                          value={depositValue}
                          onChange={(e) => { setDepositValue(e.target.value.replace(/[^\d.,]/g, '')); markDirty() }}
                          className="pr-7"
                          style={{ width: 118, border: '1px solid #e3e3e6', borderRadius: 10, padding: '11px 28px 11px 12px', fontSize: 15 }}
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                          {depositType === 'percent' ? '%' : '€'}
                        </span>
                      </div>
                    </div>
                    <p className="text-[12px]" style={{ color: '#767676', maxWidth: 320 }}>
                      {depositPreview
                        ? <>Su questo preventivo: <b style={{ color: '#55534b' }}>acconto {fmtEuro(depositPreview.acconto)} — saldo {fmtEuro(depositPreview.saldo)}</b>. Il cliente lo vedrà sotto il totale.</>
                        : 'Il cliente vedrà la riga acconto sotto il totale del preventivo.'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Riepilogo fiscale (con slot sconto integrato) ────── */}
      <FiscalSummary
        voci={activeVoci}
        fiscalOpts={fiscalOpts}
        bonusEdilizio={bonusEdilizio}
        docNumber={docNumber.trim() || null}
        docType={docType}
        discountSlot={
          <div ref={discountSectionRef}>
            {!discountOpen ? (
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
                    onClick={() => { setDiscountPct(''); setDiscountFixed(''); setDiscountError(null); setDiscountOpen(false); markDirty() }}
                    aria-label="Rimuovi sconto"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--cc-text-3)', padding: 2 }}
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="discount_pct" style={{ fontSize: 14 }}>Sconto %</Label>
                    <div className="relative">
                      <Input id="discount_pct" name="discount_pct" type="number" min="0" max="100" step="0.01" placeholder="0" value={discountPct} onChange={(e) => { setDiscountPct(e.target.value); markDirty() }} onKeyDown={(e) => { if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault() }} style={{ border: '1px solid #e3e3e6', borderRadius: 10, padding: '11px 28px 11px 12px', fontSize: 15 }} />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="discount_fixed" style={{ fontSize: 14 }}>Sconto in €</Label>
                    <div className="relative">
                      <Input id="discount_fixed" name="discount_fixed" type="number" min="0" step="0.01" placeholder="0.00" value={discountFixed} onChange={(e) => { setDiscountFixed(e.target.value); markDirty() }} onKeyDown={(e) => { if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault() }} style={{ border: '1px solid #e3e3e6', borderRadius: 10, padding: '11px 28px 11px 12px', fontSize: 15 }} />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">€</span>
                    </div>
                  </div>
                </div>
                {discountError && (
                  <p className="text-sm text-destructive" role="alert">{discountError}</p>
                )}
              </div>
            )}
          </div>
        }
      />

      {/* Legenda obbligatorietà */}
      <p style={{ fontSize: '14px', color: '#b08d3e', margin: '14px 15px 10px' }}>
        * Campo obbligatorio
      </p>

      {/* ── Azioni ───────────────────────────────────────────── */}
      <div>
        {(saving || saveError || lastSaved) && (
          <div className="text-xs text-muted-foreground mb-2">
            {saving && (
              <span className="flex items-center gap-1.5">
                <Loader2 className="size-3 animate-spin" /> Salvataggio…
              </span>
            )}
            {!saving && saveError && (
              <span className="text-destructive">{saveError}</span>
            )}
            {!saving && !saveError && lastSaved && (
              <span>
                Salvato alle{' '}
                {lastSaved.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 11, padding: '0 15px' }}>
          {/* Edit mode — terminal state: sola lettura */}
          {mode === 'edit' && (
            defaultValues?.status === 'accepted' ||
            (docType === 'fattura' && defaultValues?.status === 'rejected')
          ) ? (
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <CheckCircle2 className="size-4 text-green-600 shrink-0" />
              {docType === 'fattura'
                ? defaultValues?.status === 'accepted'
                  ? 'Fattura pagata — non modificabile'
                  : 'Fattura annullata — non modificabile'
                : 'Preventivo accettato — non modificabile'}
            </span>
          ) : mode === 'edit' && defaultValues?.status === 'draft' ? (
            /* Edit mode — draft: Salva bozza + Invia al cliente (apre il popup email) */
            <>
              <Button
                type="button"
                variant="outline"
                disabled={saving || draftSaved}
                onClick={doSaveDraft}
                style={{ flex: 1, border: '1px solid #e3e3e6', borderRadius: 12, fontSize: 14, fontWeight: 500, height: 50, boxSizing: 'border-box' }}
              >
                {saving
                  ? <><Loader2 className="size-4 animate-spin" /> Salvataggio…</>
                  : draftSaved
                  ? <><CheckCircle2 className="size-4 text-green-600" /> Bozza salvata</>
                  : <><Save className="size-4" /> Salva bozza</>
                }
              </Button>
              <Button
                type="button"
                disabled={saving || draftSaved}
                onClick={doSendFromDraft}
                style={{
                  flex: 1.2,
                  background: '#1a1a2e',
                  color: '#fff',
                  borderRadius: 12,
                  fontSize: 14,
                  fontWeight: 600,
                  boxShadow: '0 6px 16px -6px rgba(26,26,46,.5)',
                  height: 50,
                  boxSizing: 'border-box',
                }}
              >
                <Send className="size-4" /> Invia al cliente
              </Button>
            </>
          ) : mode === 'edit' ? (
            /* Edit mode — sent/viewed/rejected/expired: Aggiorna */
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={doSaveAndRedirect}
              style={{ flex: 1, height: 50, boxSizing: 'border-box' }}
            >
              {saving && <Loader2 className="size-4 animate-spin" />}
              <Save className="size-4" /> {docType === 'fattura' ? 'Aggiorna fattura' : 'Aggiorna preventivo'}
            </Button>
          ) : (
            /* Create mode — entrambi i bottoni sottomettono il form via createDocumentAction */
            <>
              <Button
                type="submit"
                name="intent"
                value="save_draft"
                variant="outline"
                disabled={isPending}
                onClick={() => setPendingIntent('save_draft')}
                style={{ flex: 1, border: '1px solid #e3e3e6', borderRadius: 12, fontSize: 14, fontWeight: 500, height: 50, boxSizing: 'border-box' }}
              >
                {isPending && pendingIntent === 'save_draft' && <Loader2 className="size-4 animate-spin" />}
                <Save className="size-4" /> Salva bozza
              </Button>
              <Button
                type="submit"
                name="intent"
                value={docType === 'fattura' ? 'create' : 'send'}
                data-tour="invia"
                disabled={isPending || !!docNumberError}
                onClick={() => {
                  setPendingIntent(docType === 'fattura' ? 'create' : 'send')
                  const err = validateDocNumber(docNumber)
                  if (err) setDocNumberError(err)
                }}
                style={{
                  flex: 1.2,
                  background: '#1a1a2e',
                  color: '#fff',
                  borderRadius: 12,
                  fontSize: 14,
                  fontWeight: 600,
                  boxShadow: '0 6px 16px -6px rgba(26,26,46,.5)',
                  height: 50,
                  boxSizing: 'border-box',
                }}
              >
                {isPending && pendingIntent === (docType === 'fattura' ? 'create' : 'send') && <Loader2 className="size-4 animate-spin" />}
                {docType === 'fattura'
                  ? <><Save className="size-4" /> Salva e apri</>
                  : <><Send className="size-4" /> Invia al cliente</>
                }
              </Button>
            </>
          )}
        </div>
      </div>
    </form>

    {/* Overlay "Bozza salvata" / "Modifiche salvate" — appare dopo salvataggio manuale */}
    {overlayVariant && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl px-10 py-8 flex flex-col items-center gap-3 max-w-xs w-full mx-4">
          <CheckCircle2 className="size-12 text-green-500" />
          <p className="text-lg font-semibold text-center">
            {overlayVariant === 'update' ? 'Modifiche salvate' : 'Bozza salvata'}
          </p>
          {overlayVariant === 'draft' && docNumber && (
            <div style={{ background: '#f4f4f5', borderRadius: 10, padding: '8px 18px', textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#8a887f' }}>
                Numero assegnato
              </div>
              <div className="font-mono" style={{ fontSize: 20, fontWeight: 700, color: '#161616', marginTop: 2 }}>
                {formatDocNumber(docNumber, docType)}
              </div>
            </div>
          )}
          <p className="text-sm text-muted-foreground text-center">
            {overlayVariant === 'update'
              ? (docType === 'fattura' ? 'La fattura è stata aggiornata.' : 'Il preventivo è stato aggiornato.')
              : (docType === 'fattura' ? 'La fattura è stata salvata come bozza.' : 'Il preventivo è stato salvato come bozza.')}
          </p>
        </div>
      </div>
    )}

    {/* Dialog: preventivo/fattura salvato — vuoi reinviarlo al cliente? */}
    <ResendReminderDialog
      docType={docType}
      open={showResendDialog}
      onClose={() => {
        setShowResendDialog(false)
        router.push(docType === 'fattura' ? '/fatture' : '/preventivi')
      }}
      onResend={() => {
        setShowResendDialog(false)
        if (documentId) {
          // Apre il pop-up "Invia al cliente" (canali) montato sulla pagina di
          // dettaglio — da lì l'icona Email apre il popup email di reinvio.
          window.dispatchEvent(new CustomEvent('cartacanta:open-share-dialog', { detail: { documentId } }))
        }
      }}
    />

    {/* Dialog creazione cliente inline — fuori dal <form> per evitare submit annidati */}
    <QuickCreateClientDialog
      open={quickCreateOpen}
      onOpenChange={setQuickCreateOpen}
      onCreated={(client: QuickClientHit) => {
        setSelectedClient(client)
        markDirty()
        // Aggiorna SendEmailDialogController (stesso evento di ClientAutocomplete)
        if (typeof window !== 'undefined') {
          const displayName = [client.name, client.surname].filter(Boolean).join(' ')
          window.dispatchEvent(new CustomEvent('cartacanta:client-changed', {
            detail: { email: client.email ?? null, hasClient: true, name: displayName }
          }))
        }
      }}
    />
    </>
  )
}
