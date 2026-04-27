'use client'

// ============================================================
// CARTA CANTA — SendEmailDialog
// Dialog di conferma per l'invio email del preventivo.
// Chiama POST /api/documents/[id]/send-email e, in caso
// di successo, aggiorna la pagina per riflettere il nuovo
// stato "inviato".
// ============================================================

import { useState } from 'react'
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
}

// ── Messaggio default ──────────────────────────────────────────────────────

function buildDefaultMessage(
  senderName: string,
  docNumber: string | null,
  docType: 'preventivo' | 'fattura' = 'preventivo',
): string {
  const label = docType === 'fattura' ? 'la fattura n.' : 'il preventivo n.'
  const ref = docNumber ? `${label} ${docNumber}` : (docType === 'fattura' ? 'la fattura allegata' : 'il preventivo allegato')
  return `Le invio in allegato ${ref} come da nostra intesa.\n\nResto a disposizione per qualsiasi chiarimento o modifica.\n\nCordiali saluti,\n${senderName}`
}

// ── Componente ─────────────────────────────────────────────────────────────

export function SendEmailDialog({
  documentId,
  docNumber,
  clientEmail,
  senderName,
  isResend = false,
  docType = 'preventivo',
}: SendEmailDialogProps) {
  const router = useRouter()

  const [open, setOpen]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [sent, setSent]       = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

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
    if (next) {
      setTo(clientEmail ?? '')
      setSubject(defaultSubject)
      setMessage(buildDefaultMessage(senderName, docNumber, docType))
      setApiError(null)
      setSent(false)
    }
    setOpen(next)
  }

  async function handleSend() {
    setApiError(null)
    setLoading(true)

    try {
      const res = await fetch(`/api/documents/${documentId}/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, message }),
      })

      const data = await res.json() as { ok?: boolean; error?: string }

      if (!res.ok || !data.ok) {
        setApiError(data.error ?? 'Errore durante l\'invio. Riprova.')
        return
      }

      // Successo
      setSent(true)

      // Chiudi il dialog dopo 1.5s e aggiorna la pagina per mostrare
      // il nuovo stato "Inviato" nel badge
      setTimeout(() => {
        setOpen(false)
        router.refresh()
      }, 1500)
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Errore di rete. Riprova.')
    } finally {
      setLoading(false)
    }
  }

  const canSend = to.trim().length > 0 && subject.trim().length > 0 && message.trim().length > 0

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant={isResend ? 'outline' : 'default'}>
          {isResend ? <RefreshCw className="size-4" /> : <Send className="size-4" />}
          {isResend ? 'Reinvia al cliente' : 'Invia al cliente'}
        </Button>
      </DialogTrigger>

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
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 className="size-10 text-green-500" />
            <p className="font-medium">Email inviata con successo!</p>
            <p className="text-sm text-muted-foreground">
              {docLabel} inviata a <strong>{to}</strong>.
            </p>
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

            {/* Email destinatario */}
            <div className="space-y-1.5">
              <Label htmlFor="send-to">
                Destinatario <span className="text-destructive">*</span>
              </Label>
              <Input
                id="send-to"
                type="email"
                placeholder="cliente@esempio.it"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                disabled={loading}
              />
              {!clientEmail && (
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
