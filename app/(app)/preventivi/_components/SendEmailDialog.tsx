'use client'

// ============================================================
// CARTA CANTA — SendEmailDialog
//
// Quando hasClient=false (nessun cliente associato):
//   - All'apertura del dialog vengono caricati tutti i clienti
//     del workspace (max 200) con una sola richiesta al server.
//   - I suggerimenti vengono filtrati IN MEMORIA ad ogni tasto,
//     partendo dal 2° carattere. Nessun debounce, nessun round-trip.
//   - Selezionando un suggerimento si compilano nome, cognome ed email.
// ============================================================

import { useState, useMemo, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Send, RefreshCw, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { preloadClientsAction } from '@/lib/actions/clients'
import { useAnchorRect, useCloseOnOutsideMouseDown } from '@/components/shared/dropdown-portal'

// ── Tipi ──────────────────────────────────────────────────────────────────

type ClientSuggestion = {
  id: string
  name: string
  surname?: string | null
  email: string | null
  phone: string | null
  piva: string | null
}

// ── Filtro in-memory ──────────────────────────────────────────────────────
// FIX-20: campo 'name' cerca su nome+cognome+email (allineato a ClientAutocomplete).
// Campo 'email' rimane specifico sull'email (input email, ricerca mirata).

type SearchField = 'name' | 'email'

function filterClients(
  query: string,
  clients: ClientSuggestion[],
  field: SearchField,
): ClientSuggestion[] {
  if (query.trim().length < 1) return []
  const q = query.toLowerCase()
  return clients
    .filter((c) => {
      if (field === 'name') {
        const full = [c.name, c.surname].filter(Boolean).join(' ').toLowerCase()
        if (full.includes(q)) return true
        return c.email ? c.email.toLowerCase().includes(q) : false
      }
      // field === 'email'
      return c.email ? c.email.toLowerCase().includes(q) : false
    })
    .slice(0, 8)
}

// ── Componente interno: input con autocomplete in-memory ──────────────────

interface ClientSearchInputProps {
  id: string
  value: string
  onChange: (val: string) => void
  onSelectClient: (client: ClientSuggestion) => void
  allClients: ClientSuggestion[]
  /** 'name': filtra su nome+cognome | 'email': filtra solo su email */
  field: SearchField
  placeholder?: string
  type?: string
  disabled?: boolean
  autoFocus?: boolean
}

function ClientSearchInput({
  id,
  value,
  onChange,
  onSelectClient,
  allClients,
  field,
  placeholder,
  type = 'text',
  disabled,
  autoFocus,
}: ClientSearchInputProps) {
  // T-18 (FIX-15 + FIX-16): tendina autonoma senza Radix Popover — niente
  // dismiss/focus-layer della libreria che chiudeva i suggerimenti appena
  // comparivano. FIX-16: la lista è renderizzata via React Portal su
  // document.body (position: fixed, coordinate da getBoundingClientRect)
  // perché altrimenti viene tagliata dall'overflow-hidden/overflow-y-auto
  // del DialogContent. Vedi anche ClientAutocomplete.tsx (stesso pattern).
  const [isFocused, setIsFocused] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  // Filtraggio sincrono — nessun debounce, nessuna chiamata server
  const suggestions = useMemo(
    () => filterClients(value, allClients, field),
    [value, allClients, field],
  )

  const isOpen = isFocused && value.trim().length >= 1 && suggestions.length > 0

  const rect = useAnchorRect(wrapperRef, isOpen)
  useCloseOnOutsideMouseDown(isOpen, () => setIsFocused(false), [wrapperRef, listRef])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    onChange(e.target.value)
  }

  // Chiude la tendina solo se il focus esce davvero da wrapper+lista (portale)
  function handleBlur(e: React.FocusEvent<HTMLDivElement>) {
    const related = e.relatedTarget as Node | null
    if (wrapperRef.current?.contains(related) || listRef.current?.contains(related)) return
    setTimeout(() => {
      if (
        !wrapperRef.current?.contains(document.activeElement) &&
        !listRef.current?.contains(document.activeElement)
      ) {
        setIsFocused(false)
      }
    }, 120)
  }

  return (
    <div
      ref={wrapperRef}
      className="relative"
      onBlur={handleBlur}
      onKeyDown={(e) => { if (e.key === 'Escape') setIsFocused(false) }}
    >
      <Input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        autoComplete="off"
        onChange={handleChange}
        onFocus={() => setIsFocused(true)}
      />
      {isOpen && rect && createPortal(
        <ul
          ref={listRef}
          data-dropdown-portal
          style={{ position: 'fixed', left: rect.left, top: rect.bottom + 4, width: rect.width, zIndex: 9999, pointerEvents: 'auto' }}
          className="cc-portal-float max-h-64 overflow-y-auto rounded-md border bg-popover shadow-md"
        >
          {suggestions.map((c) => {
            const displayName = [c.name, c.surname].filter(Boolean).join(' ')
            return (
              <li key={c.id}>
                <button
                  type="button"
                  className="w-full text-left px-3 py-2.5 hover:bg-muted active:bg-muted/70 transition-colors flex flex-col gap-0.5 border-b last:border-0 cursor-pointer"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    onSelectClient(c)
                    setIsFocused(false)
                  }}
                >
                  <span className="text-sm font-medium">{displayName}</span>
                  {(c.email || c.phone) && (
                    <span className="text-xs text-muted-foreground">{c.email ?? c.phone}</span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>,
        document.body,
      )}
    </div>
  )
}

// ── Props ──────────────────────────────────────────────────────────────────

interface SendEmailDialogProps {
  documentId: string
  docNumber: string | null
  clientEmail: string | null
  /** Id del cliente associato al documento — usato per il link "modifica in rubrica" nel reinvio */
  clientId?: string | null
  /** Nome completo del cliente associato al documento — mostrato come "A: Nome Cognome" */
  recipientName?: string | null
  senderName: string
  isResend?: boolean
  docType?: 'preventivo' | 'fattura'
  open?: boolean
  onOpenChange?: (open: boolean) => void
  initialOpen?: boolean
  hasClient?: boolean
  hasVoci?: boolean
  /** true → nessun bottone trigger: il dialog si apre solo via evento
      "cartacanta:open-send-dialog" (icona Email del pop-up Invia al cliente) */
  hideTrigger?: boolean
}

// ── Messaggio default ──────────────────────────────────────────────────────

function buildDefaultMessage(
  senderName: string,
  docNumber: string | null,
  docType: 'preventivo' | 'fattura' = 'preventivo',
): string {
  const label = docType === 'fattura' ? 'la fattura n.' : 'il preventivo n.'
  const ref = docNumber
    ? `${label} ${docNumber}`
    : docType === 'fattura' ? 'la fattura' : 'il preventivo'
  return `Le faccio avere il link per visualizzare ${ref} come da nostra intesa.\n\nResto a disposizione per qualsiasi chiarimento.\n\nCordiali saluti,\n${senderName}`
}

// ── Componente principale ───────────────────────────────────────────────────

export function SendEmailDialog({
  documentId,
  docNumber,
  clientEmail,
  clientId,
  recipientName,
  senderName,
  isResend = false,
  docType = 'preventivo',
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  initialOpen = false,
  hasClient = true,
  hasVoci = true,
  hideTrigger = false,
}: SendEmailDialogProps) {
  const router = useRouter()
  const isControlled = controlledOpen !== undefined

  const [internalOpen, setInternalOpen] = useState(initialOpen)
  const open    = isControlled ? controlledOpen! : internalOpen
  const setOpen = isControlled ? controlledOnOpenChange! : setInternalOpen

  const [loading,  setLoading]  = useState(false)
  const [sent,     setSent]     = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  // Conflitto cliente: email già associata a un contatto con nome diverso
  const [clientConflict, setClientConflict] = useState<{ id: string; name: string; email: string | null } | null>(null)

  // Campi contatto (quando !hasClient)
  const [clientFirstName, setClientFirstName] = useState('')
  const [clientLastName,  setClientLastName]  = useState('')
  const clientName = [clientFirstName.trim(), clientLastName.trim()].filter(Boolean).join(' ')

  // Id del cliente selezionato esplicitamente dall'autocomplete (CHECK-1).
  // Se valorizzato, l'invio associa direttamente quel cliente (nessun controllo
  // di conflitto, perché la scelta è esplicita e non ambigua). Viene azzerato
  // se l'utente modifica manualmente nome/cognome/email dopo la selezione.
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)

  function updateFirstName(v: string) { setSelectedClientId(null); setClientFirstName(v) }
  function updateLastName(v: string)  { setSelectedClientId(null); setClientLastName(v) }
  function updateTo(v: string)        { setSelectedClientId(null); setTo(v) }

  // Lista clienti precaricata per l'autocomplete in-memory
  const [allClients, setAllClients] = useState<ClientSuggestion[]>([])

  const docLabel = docType === 'fattura' ? 'Fattura' : 'Preventivo'

  const defaultSubject = docNumber
    ? `${docLabel} n. ${docNumber} — ${senderName}`
    : `${docLabel} — ${senderName}`

  const [to,      setTo]      = useState(clientEmail ?? '')
  const [subject, setSubject] = useState(defaultSubject)
  const [message, setMessage] = useState(() => buildDefaultMessage(senderName, docNumber, docType))

  // Sync email field when clientEmail prop changes (es. utente cambia cliente
  // nel form mentre il dialog è già aperto, oppure initialOpen=true con
  // email arrivata dal server dopo l'hydration)
  useEffect(() => {
    setTo(clientEmail ?? '')
  }, [clientEmail])

  // Toast di conferma (banner in basso): auto-dismiss dopo 10 secondi, con ✕
  // per chiuderlo prima (richiesta Eli 4 lug). Il pop-up (pannello successo nel
  // dialog) resta invece aperto finché l'utente non lo chiude: il router.refresh
  // è rimandato alla CHIUSURA del dialog — se lo facessimo subito, sulla bozza il
  // controller (montato solo per status draft) verrebbe smontato dal re-render e
  // il pop-up sparirebbe dopo un attimo.
  useEffect(() => {
    if (!sent) return
    toast.success(
      docType === 'fattura' ? 'Fattura inviata al cliente!' : 'Preventivo inviato al cliente!',
      { description: 'Email inviata con successo.', duration: 10_000, closeButton: true },
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sent])

  // T-19: rimuove ?send=1 dall'URL dopo l'apertura automatica del dialog,
  // così un reload della pagina non riapre il popup. history.replaceState
  // (non router.replace) per non innescare un nuovo fetch/render del Server Component.
  useEffect(() => {
    if (!initialOpen || typeof window === 'undefined') return
    const url = new URL(window.location.href)
    if (url.searchParams.has('send')) {
      url.searchParams.delete('send')
      window.history.replaceState({}, '', url.pathname + (url.search ? url.search : '') + url.hash)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // FIX-19: precarica clienti per l'autocomplete quando il dialog è aperto e
  // !hasClient. Reagisce all'`open` state così funziona sia per apertura manuale
  // (handleOpenChange) sia per apertura automatica (initialOpen=true, ?send=1)
  // dove handleOpenChange non scatta. allClients.length === 0 evita doppie fetch.
  useEffect(() => {
    if (!open || hasClient || allClients.length > 0) return
    preloadClientsAction().then((data) => setAllClients(data as ClientSuggestion[]))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, hasClient])

  // Apertura via evento globale "cartacanta:open-send-dialog" — usata dai bottoni
  // "Invia al cliente" che vivono sulla STESSA pagina del dialog (footer del form
  // bozza, chip "Invia" mobile, dialog "reinvia?"): una soft-navigation a ?send=1
  // non riaprirebbe il dialog già montato, perché initialOpen è letto solo al mount.
  // Nessun array deps: la sottoscrizione si rinnova a ogni render così la closure
  // di handleOpenChange è sempre aggiornata.
  useEffect(() => {
    function onOpenRequest(e: Event) {
      const detail = (e as CustomEvent<{ documentId?: string }>).detail
      if (detail?.documentId && detail.documentId !== documentId) return
      handleOpenChange(true)
    }
    window.addEventListener('cartacanta:open-send-dialog', onOpenRequest)
    return () => window.removeEventListener('cartacanta:open-send-dialog', onOpenRequest)
  })

  // ── Apertura/chiusura dialog ───────────────────────────────

  function handleOpenChange(next: boolean) {
    if (next && !hasVoci && !isResend) {
      window.dispatchEvent(new CustomEvent('cartacanta:voci-mancanti'))
      return
    }
    if (next) {
      // Reset form
      setTo(clientEmail ?? '')
      setSubject(defaultSubject)
      setMessage(buildDefaultMessage(senderName, docNumber, docType))
      setApiError(null)
      setSent(false)
      setClientConflict(null)
      setClientFirstName('')
      setClientLastName('')
      setSelectedClientId(null)
      // Precarica clienti per autocomplete (una sola richiesta al server)
      if (!hasClient) {
        preloadClientsAction().then((data) => setAllClients(data as ClientSuggestion[]))
      }
    }
    setOpen(next)
    // Refresh della pagina rimandato alla chiusura del dialog dopo un invio
    // riuscito (Chiudi, ✕ o Escape) — vedi commento sull'effetto del toast.
    if (!next && sent) router.refresh()
  }

  // ── Selezione cliente dall'autocomplete ────────────────────
  // Compila nome, cognome ed email in un colpo solo

  function handleSelectClient(c: ClientSuggestion) {
    setSelectedClientId(c.id)
    setClientFirstName(c.name)
    setClientLastName(c.surname ?? '')
    if (c.email) setTo(c.email)
  }

  // ── Invio email ────────────────────────────────────────────

  // confirmMatch = true quando l'utente conferma di usare un cliente esistente
  // con la stessa email ma nome diverso (vedi clientConflict).
  async function handleSend(confirmMatch = false) {
    setApiError(null)
    if (!hasVoci) {
      setApiError('Il preventivo non ha voci. Aggiungi almeno una voce prima di inviare.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/documents/${documentId}/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to,
          subject,
          message,
          // Cliente scelto esplicitamente dall'autocomplete → associa per id,
          // nessuna ambiguità possibile (CHECK-1).
          ...(selectedClientId ? { clientId: selectedClientId } : {}),
          ...(!selectedClientId && !hasClient && clientName.trim() ? { clientName: clientName.trim() } : {}),
          ...(confirmMatch ? { confirmClientMatch: true } : {}),
        }),
      })
      const contentType = res.headers.get('content-type') ?? ''
      if (!contentType.includes('application/json')) {
        setApiError('Errore del server. Riprova tra qualche istante.')
        return
      }
      const data = await res.json() as {
        ok?: boolean
        error?: string
        clientConflict?: { id: string; name: string; email: string | null }
      }
      // Email già associata a un altro contatto → chiedi conferma
      if (data.clientConflict) {
        setClientConflict(data.clientConflict)
        return
      }
      if (!res.ok || !data.ok) {
        setApiError(data.error ?? "Errore durante l'invio. Riprova.")
        return
      }
      setSent(true)
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Errore di rete. Riprova.')
    } finally {
      setLoading(false)
    }
  }

  const canSend =
    to.trim().length > 0 &&
    subject.trim().length > 0 &&
    message.trim().length > 0 &&
    (hasClient || clientName.trim().length > 0)

  // ── Render ─────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {!isControlled && !hideTrigger && (
        <DialogTrigger asChild>
          <Button
            size="sm"
            variant={isResend ? 'outline' : 'default'}
            title={isResend ? 'Reinvia al cliente' : 'Invia al cliente'}
          >
            {isResend ? <RefreshCw className="size-4" /> : <Send className="size-4" />}
            <span className="hidden sm:inline">
              {isResend ? 'Reinvia al cliente' : 'Invia al cliente'}
            </span>
          </Button>
        </DialogTrigger>
      )}

      <DialogContent
        className="sm:max-w-[520px]"
        onPointerDownOutside={(e) => {
          // FIX click portale: il DismissableLayer di Radix vede i click sulla
          // tendina (portata su document.body) come "fuori dal dialog" e chiude
          // il dialog prima che onMouseDown possa selezionare il cliente.
          // Se il click è dentro la tendina [data-dropdown-portal], blocchiamo
          // il dismiss — l'onMouseDown del bottone lista completa la selezione.
          if ((e.target as HTMLElement).closest?.('[data-dropdown-portal]')) {
            e.preventDefault()
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {isResend
              ? `Reinvia ${docLabel.toLowerCase()} al cliente`
              : `Invia ${docLabel.toLowerCase()} al cliente`}
          </DialogTitle>
          <DialogDescription>
            Il cliente riceverà un link per visualizzare il documento nel browser.
            {docNumber && (
              <span className="font-medium text-foreground">
                {' '}{docLabel} {docNumber}.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* ── Conflitto cliente: stessa email, nome diverso ── */}
        {clientConflict ? (
          <div className="space-y-4 py-2">
            <div className="flex items-start gap-2 rounded-lg border border-[#e8d6ad] bg-[#f5e9d0] px-4 py-3 text-sm text-[#b0863e]">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Email già associata a un altro contatto</p>
                <p className="text-xs mt-0.5">
                  L&apos;indirizzo <strong>{to}</strong> appartiene già al cliente{' '}
                  <strong>{clientConflict.name}</strong>. Non è possibile avere due contatti
                  con la stessa email. Vuoi inviare a questo contatto?
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                onClick={() => handleSend(true)}
                disabled={loading}
                className="w-full"
              >
                {loading && <Loader2 className="size-4 animate-spin" />}
                Sì, invia a &ldquo;{clientConflict.name}&rdquo;
              </Button>
              <Button
                variant="outline"
                onClick={() => setClientConflict(null)}
                disabled={loading}
                className="w-full"
              >
                No, modifica i dati
              </Button>
            </div>
          </div>
        ) : sent ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <CheckCircle2 className="size-10 text-green-500" />
            <div className="space-y-1">
              <p className="font-medium">Email inviata con successo!</p>
              <p className="text-sm text-muted-foreground">
                {docType === 'fattura' ? 'Fattura inviata' : 'Preventivo inviato'} a <strong>{to}</strong>.
              </p>
            </div>
            {/* Numero assegnato al documento — ben visibile (richiesta Eli 4 lug) */}
            {docNumber && (
              <div style={{ background: '#f4f4f5', borderRadius: 10, padding: '8px 18px', textAlign: 'center' }}>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--cc-muted)' }}>
                  Numero {docType === 'fattura' ? 'fattura' : 'preventivo'}
                </div>
                <div className="font-mono" style={{ fontSize: 20, fontWeight: 700, color: '#161616', marginTop: 2 }}>
                  {docNumber}
                </div>
              </div>
            )}
            <Button onClick={() => handleOpenChange(false)} size="sm">
              Chiudi
            </Button>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {apiError && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertDescription>{apiError}</AlertDescription>
              </Alert>
            )}

            {/* ── Campi contatto (solo se !hasClient) ── */}
            {!hasClient && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 items-end">
                  <div className="space-y-1.5">
                    <Label htmlFor="send-firstname">
                      Nome / Ragione sociale <span className="text-destructive">*</span>
                    </Label>
                    <ClientSearchInput
                      id="send-firstname"
                      value={clientFirstName}
                      onChange={updateFirstName}
                      onSelectClient={handleSelectClient}
                      allClients={allClients}
                      field="name"
                      placeholder="Mario"
                      disabled={loading}
                      autoFocus
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="send-lastname">
                      Cognome{' '}
                      <span className="text-muted-foreground font-normal text-xs">(opzionale)</span>
                    </Label>
                    <Input
                      id="send-lastname"
                      placeholder="Rossi"
                      value={clientLastName}
                      onChange={(e) => updateLastName(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Digita almeno 2 lettere per cercare tra i clienti esistenti, oppure inserisci un nuovo nome.
                </p>
              </div>
            )}

            {/* ── Destinatario (nome — solo se hasClient e nome noto) ── */}
            {hasClient && recipientName && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50 text-sm">
                <span className="text-muted-foreground">A:</span>
                <span className="font-medium">{recipientName}</span>
              </div>
            )}

            {/* ── Email destinatario ──
                TASK 1: quando il documento ha un cliente associato CON email
                salvata in rubrica, il campo è precompilato e di sola lettura
                (sia primo invio sia reinvio): l'email "di verità" è quella
                della scheda cliente — modificarla qui non verrebbe comunque
                salvata (clientEmail risincronizza `to` ad ogni apertura).
                Se il cliente non ha email, il campo resta editabile. */}
            <div className="space-y-1.5">
              <Label htmlFor="send-to">
                Email destinatario <span className="text-destructive">*</span>
              </Label>
              {!hasClient ? (
                <ClientSearchInput
                  id="send-to"
                  type="email"
                  value={to}
                  onChange={updateTo}
                  onSelectClient={handleSelectClient}
                  allClients={allClients}
                  field="email"
                  placeholder="cliente@esempio.it"
                  disabled={loading}
                />
              ) : clientEmail ? (
                <Input
                  id="send-to"
                  type="email"
                  value={to}
                  readOnly
                  disabled={loading}
                  className="bg-muted/50 text-muted-foreground cursor-default"
                />
              ) : (
                <Input
                  id="send-to"
                  type="email"
                  placeholder="cliente@esempio.it"
                  value={to}
                  onChange={(e) => updateTo(e.target.value)}
                  disabled={loading}
                />
              )}
              {hasClient && !clientEmail && (
                <p className="text-xs text-muted-foreground">
                  Nessuna email salvata per questo cliente.
                </p>
              )}
              {hasClient && clientEmail && (
                <p className="text-xs text-muted-foreground">
                  Email della scheda cliente. Per inviare a un altro indirizzo, modifica l&apos;email del cliente nella{' '}
                  {clientId ? (
                    <Link href={`/clienti/${clientId}`} className="underline underline-offset-2 hover:text-foreground">
                      rubrica Clienti
                    </Link>
                  ) : (
                    'rubrica Clienti'
                  )}.
                </p>
              )}
            </div>

            {/* ── Oggetto ── */}
            <div className="space-y-1.5">
              <Label htmlFor="send-subject">
                Oggetto <span className="text-destructive">*</span>
              </Label>
              <Input
                id="send-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={loading}
              />
            </div>

            {/* ── Messaggio ── */}
            <div className="space-y-1.5">
              <Label htmlFor="send-message">
                Messaggio <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="send-message"
                rows={7}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={loading}
                className="resize-none font-mono text-xs leading-relaxed"
              />
            </div>

            <p className="text-xs text-muted-foreground">
              Il cliente riceve un link per visualizzare il documento.
              {!isResend && docNumber && (
                <> Dopo l&apos;invio lo stato passerà a <strong>{docType === 'fattura' ? 'Inviata' : 'Inviato'}</strong>.</>
              )}
              {isResend && docType !== 'fattura' && (
                <span className="block mt-2 text-[#b0863e] font-medium">
                  ⚠️ Reinviando, la scadenza del preventivo ripartirà da oggi.
                </span>
              )}
            </p>
          </div>
        )}

        {!sent && !clientConflict && (
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Annulla
            </Button>
            <Button onClick={() => handleSend()} disabled={loading || !canSend}>
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {isResend ? 'Reinvio in corso…' : 'Invio in corso…'}
                </>
              ) : isResend ? (
                <><RefreshCw className="size-4" /> Reinvia email</>
              ) : (
                <><Send className="size-4" /> Invia email</>
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
