'use client'

// ============================================================
// CARTA CANTA — SendEmailDialog
// Dialog di conferma per l'invio email del preventivo.
//
// Quando hasClient=false (nessun cliente associato):
//   - I campi "Nome" ed "Email" mostrano autocomplete dai clienti
//     registrati nell'app (via searchClientsAction).
//   - Selezionando un suggerimento si compilano nome + email.
//   - Se l'utente digita un nuovo nome non presente, alla conferma
//     viene creato automaticamente un nuovo contatto.
// ============================================================

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { searchClientsAction } from '@/lib/actions/clients'

// ── Tipi ──────────────────────────────────────────────────────────────────

type ClientSuggestion = {
  id: string
  name: string
  email: string | null
  phone: string | null
  piva: string | null
}

// ── Props ──────────────────────────────────────────────────────────────────

interface SendEmailDialogProps {
  documentId: string
  docNumber: string | null
  /** Email del cliente pre-compilata (può essere null) */
  clientEmail: string | null
  /** Nome workspace per la firma nel messaggio default */
  senderName: string
  /** Se true: reinvio del link (doc già inviato/visto), non primo invio */
  isResend?: boolean
  docType?: 'preventivo' | 'fattura'
  /** Modalità controlled: nessun DialogTrigger interno, open/onOpenChange gestiti dall'esterno */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Se true: il dialog si apre automaticamente al mount (es. redirect da "Invia al cliente") */
  initialOpen?: boolean
  /**
   * Se false: nessun cliente è ancora associato al documento.
   * Il dialog mostrerà i campi nome/email con autocomplete dai clienti registrati.
   */
  hasClient?: boolean
  /**
   * Se false: il documento non ha voci compilate.
   * Il dialog bloccherà l'invio mostrando un errore chiaro.
   */
  hasVoci?: boolean
}

// ── Messaggio default ──────────────────────────────────────────────────────

function buildDefaultMessage(
  senderName: string,
  docNumber: string | null,
  docType: 'preventivo' | 'fattura' = 'preventivo',
): string {
  const label = docType === 'fattura' ? 'la fattura n.' : 'il preventivo n.'
  const ref = docNumber ? `${label} ${docNumber}` : (docType === 'fattura' ? 'la fattura' : 'il preventivo')
  return `Le invio in allegato ${ref} come da nostra intesa.\n\nResto a disposizione per qualsiasi chiarimento.\n\nCordiali saluti,\n${senderName}`
}

// ── Componente interno: input con suggerimenti cliente ────────────────────

interface ClientSearchInputProps {
  id: string
  value: string
  onChange: (val: string) => void
  onSelectClient: (client: ClientSuggestion) => void
  placeholder?: string
  type?: string
  disabled?: boolean
  autoFocus?: boolean
  /** Se true, mostra solo i clienti che hanno un'email */
  emailRequired?: boolean
}

function ClientSearchInput({
  id,
  value,
  onChange,
  onSelectClient,
  placeholder,
  type = 'text',
  disabled,
  autoFocus,
  emailRequired = false,
}: ClientSearchInputProps) {
  const [suggestions, setSuggestions] = useState<ClientSuggestion[]>([])
  const [open, setOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Pulisci i suggerimenti quando il componente è disabilitato
  useEffect(() => {
    if (disabled) { setSuggestions([]); setOpen(false) }
  }, [disabled])

  async function search(q: string) {
    if (q.trim().length < 1) {
      setSuggestions([])
      setOpen(false)
      return
    }
    const results = (await searchClientsAction(q)) as ClientSuggestion[]
    const filtered = emailRequired ? results.filter(c => c.email) : results
    setSuggestions(filtered)
    setOpen(filtered.length > 0)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    onChange(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(val), 250)
  }

  function handleFocus() {
    if (suggestions.length > 0) setOpen(true)
    else if (value.trim().length >= 1) search(value)
  }

  function handleSelect(c: ClientSuggestion) {
    onSelectClient(c)
    setSuggestions([])
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <Input
          id={id}
          type={type}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          autoComplete="off"
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
      </PopoverAnchor>
      <PopoverContent
        align="start"
        sideOffset={4}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onEscapeKeyDown={() => setOpen(false)}
        onInteractOutside={() => setOpen(false)}
        className="p-0"
        style={{ width: 'var(--radix-popover-anchor-width)', zIndex: 9999 }}
      >
        {suggestions.map((c) => (
          <button
            key={c.id}
            type="button"
            className="w-full text-left px-3 py-2.5 hover:bg-muted flex flex-col gap-0.5 border-b last:border-0"
            onMouseDown={(e) => { e.preventDefault(); handleSelect(c) }}
          >
            <span className="text-sm font-medium">{c.name}</span>
            {(c.email || c.phone) && (
              <span className="text-xs text-muted-foreground">
                {c.email ?? c.phone}
              </span>
            )}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}

// ── Componente principale ───────────────────────────────────────────────────

export function SendEmailDialog({
  documentId,
  docNumber,
  clientEmail,
  senderName,
  isResend = false,
  docType = 'preventivo',
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  initialOpen = false,
  hasClient = true,
  hasVoci = true,
}: SendEmailDialogProps) {
  const router = useRouter()
  const isControlled = controlledOpen !== undefined

  const [internalOpen, setInternalOpen] = useState(initialOpen)
  const open    = isControlled ? controlledOpen! : internalOpen
  const setOpen = isControlled ? controlledOnOpenChange! : setInternalOpen

  const [loading, setLoading] = useState(false)
  const [sent, setSent]       = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  // Campi contatto — visibili solo quando non c'è ancora un cliente associato
  const [clientFirstName, setClientFirstName] = useState('')
  const [clientLastName,  setClientLastName]  = useState('')
  // Nome completo derivato: inviato alla route come clientName
  const clientName = [clientFirstName.trim(), clientLastName.trim()].filter(Boolean).join(' ')

  const docLabel = docType === 'fattura' ? 'Fattura' : 'Preventivo'

  // Campi form
  const defaultSubject = docNumber
    ? `${docLabel} n. ${docNumber} — ${senderName}`
    : `${docLabel} — ${senderName}`

  const [to, setTo]           = useState(clientEmail ?? '')
  const [subject, setSubject] = useState(defaultSubject)
  const [message, setMessage] = useState(() => buildDefaultMessage(senderName, docNumber, docType))

  // Resetta il form ogni volta che il dialog si apre
  function handleOpenChange(next: boolean) {
    if (next && !hasVoci && !isResend) {
      // Blocca l'apertura del dialog e delega l'errore al banner nella pagina
      window.dispatchEvent(new CustomEvent('cartacanta:voci-mancanti'))
      return
    }
    if (next) {
      setTo(clientEmail ?? '')
      setSubject(defaultSubject)
      setMessage(buildDefaultMessage(senderName, docNumber, docType))
      setApiError(null)
      setSent(false)
      setClientFirstName('')
      setClientLastName('')
    }
    setOpen(next)
  }

  // Selezione di un cliente dall'autocomplete: compila nome + email
  function handleSelectClientSuggestion(c: ClientSuggestion) {
    setClientFirstName(c.name)
    setClientLastName('')
    if (c.email) setTo(c.email)
  }

  async function handleSend() {
    setApiError(null)

    // Blocco client-side: documento senza voci compilate
    if (!hasVoci) {
      setApiError('Il preventivo non ha voci. Aggiungi almeno una voce prima di salvare o inviare.')
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
          // Inviato solo se il documento non ha ancora un cliente associato
          ...(!hasClient && clientName.trim() ? { clientName: clientName.trim() } : {}),
        }),
      })

      const contentType = res.headers.get('content-type') ?? ''
      if (!contentType.includes('application/json')) {
        setApiError('Errore del server. Riprova tra qualche istante.')
        return
      }

      const data = await res.json() as { ok?: boolean; error?: string }

      if (!res.ok || !data.ok) {
        setApiError(data.error ?? 'Errore durante l\'invio. Riprova.')
        return
      }

      // Successo
      setSent(true)
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Errore di rete. Riprova.')
    } finally {
      setLoading(false)
    }
  }

  const canSend = (
    to.trim().length > 0 &&
    subject.trim().length > 0 &&
    message.trim().length > 0 &&
    (hasClient || clientName.trim().length > 0)
  )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/* Trigger visibile solo in modalità non-controlled */}
      {!isControlled && (
        <DialogTrigger asChild>
          <Button size="sm" variant={isResend ? 'outline' : 'default'}>
            {isResend ? <RefreshCw className="size-4" /> : <Send className="size-4" />}
            <span className="hidden sm:inline">
              {isResend ? 'Reinvia al cliente' : 'Invia al cliente'}
            </span>
          </Button>
        </DialogTrigger>
      )}

      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>
            {isResend ? `Reinvia ${docLabel.toLowerCase()} al cliente` : `Invia ${docLabel.toLowerCase()} al cliente`}
          </DialogTitle>
          <DialogDescription>
            {isResend
              ? `Il cliente riceverà di nuovo la ${docLabel.toLowerCase()}. Lo stato del documento non cambierà.`
              : 'Il PDF verrà generato e allegato automaticamente all\'email.'}
            {docNumber && (
              <span className="font-medium text-foreground"> {docLabel} {docNumber}.</span>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Stato: inviato con successo */}
        {sent ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <CheckCircle2 className="size-10 text-green-500" />
            <div className="space-y-1">
              <p className="font-medium">Email inviata con successo!</p>
              <p className="text-sm text-muted-foreground">
                {docLabel} inviata a <strong>{to}</strong>.
              </p>
            </div>
            <Button
              onClick={() => { setOpen(false); router.refresh() }}
              size="sm"
            >
              Chiudi
            </Button>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Errore API */}
            {apiError && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertDescription>{apiError}</AlertDescription>
              </Alert>
            )}

            {/* Dati contatto — solo se non c'è ancora un cliente associato.
                I campi Nome ed Email hanno autocomplete dai clienti registrati. */}
            {!hasClient && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="send-client-firstname">
                      Nome / Ragione sociale <span className="text-destructive">*</span>
                    </Label>
                    <ClientSearchInput
                      id="send-client-firstname"
                      value={clientFirstName}
                      onChange={setClientFirstName}
                      onSelectClient={handleSelectClientSuggestion}
                      placeholder="es. Mario"
                      disabled={loading}
                      autoFocus
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="send-client-lastname">
                      Cognome{' '}
                      <span className="text-muted-foreground font-normal text-xs">(opzionale)</span>
                    </Label>
                    <Input
                      id="send-client-lastname"
                      placeholder="es. Rossi"
                      value={clientLastName}
                      onChange={(e) => setClientLastName(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Digita per cercare tra i clienti esistenti, oppure inserisci un nuovo nome — verrà aggiunto automaticamente ai tuoi contatti.
                </p>
              </div>
            )}

            {/* Email destinatario */}
            <div className="space-y-1.5">
              <Label htmlFor="send-to">
                Email destinatario <span className="text-destructive">*</span>
              </Label>
              {!hasClient ? (
                /* Quando non c'è un cliente associato: anche l'email ha autocomplete */
                <ClientSearchInput
                  id="send-to"
                  type="email"
                  value={to}
                  onChange={setTo}
                  onSelectClient={handleSelectClientSuggestion}
                  placeholder="cliente@esempio.it"
                  disabled={loading}
                  emailRequired
                />
              ) : (
                <Input
                  id="send-to"
                  type="email"
                  placeholder="cliente@esempio.it"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  disabled={loading}
                />
              )}
              {hasClient && !clientEmail && (
                <p className="text-xs text-muted-foreground">
                  Nessuna email salvata per questo cliente.
                </p>
              )}
            </div>

            {/* Oggetto */}
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

            {/* Messaggio */}
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
              {isResend
                ? `Il PDF della ${docLabel.toLowerCase()} verrà allegato automaticamente. Lo stato rimane invariato.`
                : <>Il PDF verrà allegato automaticamente.{docNumber && <> Dopo l&apos;invio lo stato passerà a <strong>Inviato</strong>.</>}</>
              }
            </p>
          </div>
        )}

        {!sent && (
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Annulla
            </Button>
            <Button
              onClick={handleSend}
              disabled={loading || !canSend}
            >
              {loading ? (
                <><Loader2 className="size-4 animate-spin" /> {isResend ? 'Reinvio in corso…' : 'Invio in corso…'}</>
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
