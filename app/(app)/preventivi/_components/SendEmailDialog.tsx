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

import { useState, useMemo, useEffect } from 'react'
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
import { preloadClientsAction } from '@/lib/actions/clients'

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
// Filtra la lista precaricata: attivo dal 2° carattere.
// 'name'  → confronta solo su nome + cognome
// 'email' → confronta solo su email (salta i clienti senza email)

type SearchField = 'name' | 'email'

function filterClients(
  query: string,
  clients: ClientSuggestion[],
  field: SearchField,
): ClientSuggestion[] {
  if (query.trim().length < 2) return []
  const q = query.toLowerCase()
  return clients
    .filter((c) => {
      if (field === 'name') {
        const full = [c.name, c.surname].filter(Boolean).join(' ').toLowerCase()
        return full.includes(q)
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
  const [open, setOpen] = useState(false)

  // Filtraggio sincrono — nessun debounce, nessuna chiamata server
  const suggestions = useMemo(
    () => filterClients(value, allClients, field),
    [value, allClients, field],
  )

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    onChange(val)
    // Apri il dropdown dal 2° carattere se ci sono risultati
    setOpen(val.trim().length >= 2)
  }

  function handleFocus() {
    if (value.trim().length >= 2 && suggestions.length > 0) setOpen(true)
  }

  const isOpen = open && suggestions.length > 0

  return (
    <Popover open={isOpen} onOpenChange={setOpen}>
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
        {suggestions.map((c) => {
          const displayName = [c.name, c.surname].filter(Boolean).join(' ')
          return (
            <button
              key={c.id}
              type="button"
              className="w-full text-left px-3 py-2.5 hover:bg-muted active:bg-muted/70 transition-colors flex flex-col gap-0.5 border-b last:border-0 cursor-pointer"
              onMouseDown={(e) => {
                e.preventDefault()
                onSelectClient(c)
                setOpen(false)
              }}
            >
              <span className="text-sm font-medium">{displayName}</span>
              {(c.email || c.phone) && (
                <span className="text-xs text-muted-foreground">{c.email ?? c.phone}</span>
              )}
            </button>
          )
        })}
      </PopoverContent>
    </Popover>
  )
}

// ── Props ──────────────────────────────────────────────────────────────────

interface SendEmailDialogProps {
  documentId: string
  docNumber: string | null
  clientEmail: string | null
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
  return `Le invio in allegato ${ref} come da nostra intesa.\n\nResto a disposizione per qualsiasi chiarimento.\n\nCordiali saluti,\n${senderName}`
}

// ── Componente principale ───────────────────────────────────────────────────

export function SendEmailDialog({
  documentId,
  docNumber,
  clientEmail,
  recipientName,
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

  const [loading,  setLoading]  = useState(false)
  const [sent,     setSent]     = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  // Campi contatto (quando !hasClient)
  const [clientFirstName, setClientFirstName] = useState('')
  const [clientLastName,  setClientLastName]  = useState('')
  const clientName = [clientFirstName.trim(), clientLastName.trim()].filter(Boolean).join(' ')

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
      setClientFirstName('')
      setClientLastName('')
      // Precarica clienti per autocomplete (una sola richiesta al server)
      if (!hasClient) {
        preloadClientsAction().then((data) => setAllClients(data as ClientSuggestion[]))
      }
    }
    setOpen(next)
  }

  // ── Selezione cliente dall'autocomplete ────────────────────
  // Compila nome, cognome ed email in un colpo solo

  function handleSelectClient(c: ClientSuggestion) {
    setClientFirstName(c.name)
    setClientLastName(c.surname ?? '')
    if (c.email) setTo(c.email)
  }

  // ── Invio email ────────────────────────────────────────────

  async function handleSend() {
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
      {!isControlled && (
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

      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>
            {isResend
              ? `Reinvia ${docLabel.toLowerCase()} al cliente`
              : `Invia ${docLabel.toLowerCase()} al cliente`}
          </DialogTitle>
          <DialogDescription>
            Il PDF verrà allegato automaticamente all&apos;email.
            {docNumber && (
              <span className="font-medium text-foreground">
                {' '}{docLabel} {docNumber}.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* ── Successo ── */}
        {sent ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <CheckCircle2 className="size-10 text-green-500" />
            <div className="space-y-1">
              <p className="font-medium">Email inviata con successo!</p>
              <p className="text-sm text-muted-foreground">
                {docType === 'fattura' ? 'Fattura inviata' : 'Preventivo inviato'} a <strong>{to}</strong>.
              </p>
            </div>
            <Button onClick={() => { setOpen(false); router.refresh() }} size="sm">
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
                      onChange={setClientFirstName}
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
                      onChange={(e) => setClientLastName(e.target.value)}
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

            {/* ── Email destinatario ── */}
            <div className="space-y-1.5">
              <Label htmlFor="send-to">
                Email destinatario <span className="text-destructive">*</span>
              </Label>
              {!hasClient ? (
                <ClientSearchInput
                  id="send-to"
                  type="email"
                  value={to}
                  onChange={setTo}
                  onSelectClient={handleSelectClient}
                  allClients={allClients}
                  field="email"
                  placeholder="cliente@esempio.it"
                  disabled={loading}
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
              Il PDF verrà allegato automaticamente.
              {!isResend && docNumber && (
                <> Dopo l&apos;invio lo stato passerà a <strong>Inviato</strong>.</>
              )}
            </p>
          </div>
        )}

        {!sent && (
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Annulla
            </Button>
            <Button onClick={handleSend} disabled={loading || !canSend}>
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
