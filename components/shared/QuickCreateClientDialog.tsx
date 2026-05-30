'use client'

// ============================================================
// CARTA CANTA — QuickCreateClientDialog
// Dialog minima per creare un cliente inline dal form preventivo/fattura,
// senza abbandonare la pagina corrente.
// ============================================================

import { useActionState, useEffect, useRef, useState } from 'react'
import { AlertTriangle, Loader2, UserCheck, UserPlus } from 'lucide-react'
import { createClientAction } from '@/lib/actions/clients'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// Stesso tipo usato da ClientAutocomplete
export type ClientHit = {
  id: string
  name: string
  surname?: string | null
  email: string | null
  phone: string | null
  piva: string | null
}

interface QuickCreateClientDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (client: ClientHit) => void
}

/** Rileva se il valore inserito è una P.IVA (11 cifre) o un CF (16 alfanumerici) */
function detectPivaCf(raw: string): { piva: string; codiceFiscale: string } {
  const clean = raw.replace(/\s/g, '').toUpperCase()
  if (/^\d{11}$/.test(clean)) return { piva: clean, codiceFiscale: '' }
  if (/^[A-Z0-9]{16}$/.test(clean)) return { piva: '', codiceFiscale: clean }
  return { piva: '', codiceFiscale: '' }
}

export function QuickCreateClientDialog({
  open,
  onOpenChange,
  onCreated,
}: QuickCreateClientDialogProps) {
  const [state, formAction, isPending] = useActionState(createClientAction, null)

  // Controlled inputs
  const [name,    setName]    = useState('')
  const [surname, setSurname] = useState('')
  const [email,   setEmail]   = useState('')
  const [phone,   setPhone]   = useState('')
  /** Campo unificato P.IVA / Codice Fiscale — il tipo viene rilevato automaticamente */
  const [pivaCf,  setPivaCf]  = useState('')

  // Gestione duplicati
  const formRef = useRef<HTMLFormElement>(null)
  const [forceCreate,    setForceCreate]    = useState(false)
  const [showDuplicate,  setShowDuplicate]  = useState(false)

  // Reset al riapri del dialog
  useEffect(() => {
    if (open) {
      setName('')
      setSurname('')
      setEmail('')
      setPhone('')
      setPivaCf('')
      setForceCreate(false)
      setShowDuplicate(false)
    }
  }, [open])

  // Dopo creazione riuscita: notifica il parent e chiudi
  useEffect(() => {
    if (state?.success === 'created' && state.clientId) {
      const { piva } = detectPivaCf(pivaCf)
      onCreated({
        id:      state.clientId,
        name:    name.trim(),
        surname: surname.trim() || null,
        email:   email.trim() || null,
        phone:   phone.trim() || null,
        piva:    piva || null,
      })
      onOpenChange(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  // Mostra la schermata di conferma duplicato
  useEffect(() => {
    if (state?.potentialDuplicate) setShowDuplicate(true)
  }, [state])

  // Quando forceCreate diventa true, ri-sottomette il form con forceDuplicate=true
  useEffect(() => {
    if (forceCreate) formRef.current?.requestSubmit()
  }, [forceCreate])

  const { piva: detectedPiva, codiceFiscale: detectedCf } = detectPivaCf(pivaCf)
  const dup = state?.potentialDuplicate

  // Validazione client-side: email O telefono obbligatori
  const [contactError, setContactError] = useState<string | null>(null)
  function validateContact(): boolean {
    if (!email.trim() && !phone.trim()) {
      setContactError('Inserisci almeno un contatto: email o telefono.')
      return false
    }
    setContactError(null)
    return true
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="size-5" />
            Nuovo cliente
          </DialogTitle>
          {!showDuplicate && (
            <DialogDescription>
              Nome e almeno un contatto (email <strong>o</strong> telefono) sono obbligatori.
            </DialogDescription>
          )}
        </DialogHeader>

        {/* ── Vista conferma duplicato ───────────────────────── */}
        {showDuplicate && dup ? (
          <div className="space-y-4 pt-1">
            <div className="flex items-start gap-2 text-yellow-800 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3">
              <AlertTriangle className="size-4 mt-0.5 shrink-0" />
              <div className="text-sm">
                {state?.duplicateField === 'email' ? (
                  <p className="font-medium">
                    L&apos;email <span className="font-semibold">{email}</span> è già
                    usata dal contatto{' '}
                    <span className="font-semibold">
                      {dup.name}{dup.surname ? ` ${dup.surname}` : ''}
                    </span>
                    . È lo stesso?
                  </p>
                ) : state?.duplicateField === 'phone' ? (
                  <p className="font-medium">
                    Il numero <span className="font-semibold">{phone}</span> è già
                    usato dal contatto{' '}
                    <span className="font-semibold">
                      {dup.name}{dup.surname ? ` ${dup.surname}` : ''}
                    </span>
                    . È lo stesso?
                  </p>
                ) : (
                  <p className="font-medium">
                    Abbiamo trovato un contatto molto simile già registrato. È lo stesso?
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-md border bg-muted/30 px-4 py-3 text-sm space-y-0.5">
              <p className="font-semibold text-foreground">
                {dup.name}{dup.surname ? ` ${dup.surname}` : ''}
              </p>
              {dup.email && <p className="text-muted-foreground">{dup.email}</p>}
              {dup.phone && <p className="text-muted-foreground">{dup.phone}</p>}
              {dup.piva && <p className="text-muted-foreground">P.IVA: {dup.piva}</p>}
              {dup.codice_fiscale && <p className="text-muted-foreground">CF: {dup.codice_fiscale}</p>}
            </div>

            <div className="flex flex-col gap-2">
              <Button
                type="button"
                className="gap-2 w-full"
                onClick={() => {
                  onCreated({
                    id:      dup.id,
                    name:    dup.name,
                    surname: dup.surname,
                    email:   dup.email,
                    phone:   dup.phone,
                    piva:    dup.piva,
                  })
                  onOpenChange(false)
                }}
              >
                <UserCheck className="size-4" />
                Sì, usa &ldquo;{dup.name}{dup.surname ? ` ${dup.surname}` : ''}&rdquo;
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full text-left justify-start"
                disabled={isPending}
                onClick={() => { setShowDuplicate(false); setForceCreate(true) }}
              >
                {isPending ? (
                  <><Loader2 className="size-4 animate-spin mr-2" /> Creazione…</>
                ) : (
                  <>
                    No, crea &ldquo;{name.trim()}{surname.trim() ? ` ${surname.trim()}` : ''}&rdquo;
                    {state?.duplicateField === 'email' && (
                      <span className="ml-1 text-xs text-muted-foreground">(email in comune)</span>
                    )}
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full text-muted-foreground"
                onClick={() => onOpenChange(false)}
              >
                Annulla
              </Button>
            </div>
          </div>
        ) : (
          /* ── Form creazione normale ─────────────────────────── */
          <form
            ref={formRef}
            action={formAction}
            className="space-y-4 pt-1"
            onSubmit={(e) => { if (!validateContact()) e.preventDefault() }}
          >
            {forceCreate && <input type="hidden" name="forceDuplicate" value="true" />}
            {/* Campi nascosti che ricevono il valore rilevato automaticamente */}
            <input type="hidden" name="piva"           value={detectedPiva} />
            <input type="hidden" name="codice_fiscale" value={detectedCf} />

            {state?.error && (
              <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
                {state.error}
              </p>
            )}

            {/* ── Nome + Cognome ─────────────────────────────── */}
            {/* Label e input in righe CSS separate: la griglia garantisce che
                tutti i label condividano la stessa altezza di riga e tutti gli
                input siano sulla stessa linea, a prescindere dal wrapping. */}
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              <Label htmlFor="qc-name" className="self-end leading-snug">
                Nome / Ragione sociale{' '}
                <span className="text-destructive">*</span>
              </Label>
              <Label htmlFor="qc-surname" className="self-end leading-snug">Cognome</Label>
              <Input
                id="qc-name"
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Mario"
                autoFocus
                disabled={isPending}
              />
              <Input
                id="qc-surname"
                name="surname"
                value={surname}
                onChange={(e) => setSurname(e.target.value)}
                placeholder="Rossi"
                disabled={isPending}
              />
            </div>

            {/* ── Email + Telefono (almeno uno obbligatorio) ── */}
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              <Label htmlFor="qc-email" className="self-end leading-snug">
                Email <span className="text-destructive">*</span>
              </Label>
              <Label htmlFor="qc-phone" className="self-end leading-snug">
                Telefono <span className="text-destructive">*</span>
              </Label>
              <Input
                id="qc-email"
                name="email"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setContactError(null) }}
                placeholder="mario@esempio.it"
                disabled={isPending}
                aria-invalid={contactError ? true : undefined}
              />
              <Input
                id="qc-phone"
                name="phone"
                type="tel"
                value={phone}
                onChange={(e) => { setPhone(e.target.value); setContactError(null) }}
                placeholder="+39 333 1234567"
                disabled={isPending}
                aria-invalid={contactError ? true : undefined}
              />
            </div>
            {contactError && (
              <p className="text-xs text-destructive -mt-2">{contactError}</p>
            )}
            <p className="text-xs text-muted-foreground -mt-2">
              <span className="text-destructive">*</span> Almeno uno tra email e telefono è obbligatorio.
            </p>

            {/* ── P.IVA / Codice Fiscale — campo unico ──────── */}
            <div className="space-y-1.5">
              <Label htmlFor="qc-piva-cf">P.IVA / Codice Fiscale</Label>
              <Input
                id="qc-piva-cf"
                value={pivaCf}
                onChange={(e) => setPivaCf(e.target.value.toUpperCase())}
                placeholder="es. 12345678901"
                maxLength={16}
                className="uppercase"
                disabled={isPending}
              />
              {pivaCf.replace(/\s/g, '').length > 0 && !detectedPiva && !detectedCf && (
                <p className="text-xs text-muted-foreground">
                  P.IVA: 11 cifre numeriche · CF: 16 caratteri alfanumerici
                </p>
              )}
              {detectedPiva && (
                <p className="text-xs text-green-600">P.IVA rilevata ✓</p>
              )}
              {detectedCf && (
                <p className="text-xs text-green-600">Codice Fiscale rilevato ✓</p>
              )}
            </div>

            {/* ── Legenda + Azioni ─────────────────────────── */}
            <div className="space-y-2 pt-1">
              <p className="text-xs text-muted-foreground">
                <span className="text-destructive">*</span> Campo obbligatorio
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isPending}
                >
                  Annulla
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending
                    ? <><Loader2 className="size-4 animate-spin" /> Creazione…</>
                    : 'Crea cliente'
                  }
                </Button>
              </div>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
