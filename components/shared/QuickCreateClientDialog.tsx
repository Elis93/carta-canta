'use client'

// ============================================================
// CARTA CANTA — QuickCreateClientDialog
// Dialog minima per creare un cliente inline dal form preventivo/fattura,
// senza abbandonare la pagina corrente.
// Usa createClientAction (non-blocking, torna { clientId }) — Sprint 1 #10.
// ============================================================

import { useActionState, useEffect, useState } from 'react'
import { Loader2, UserPlus } from 'lucide-react'
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
  /** Chiamata con il cliente appena creato; il chiamante lo seleziona nell'autocomplete */
  onCreated: (client: ClientHit) => void
}

export function QuickCreateClientDialog({
  open,
  onOpenChange,
  onCreated,
}: QuickCreateClientDialogProps) {
  const [state, formAction, isPending] = useActionState(createClientAction, null)

  // Controlled inputs — i valori non si perdono se il server risponde con errore
  const [name,           setName]          = useState('')
  const [surname,        setSurname]       = useState('')
  const [email,          setEmail]         = useState('')
  const [phone,          setPhone]         = useState('')
  const [piva,           setPiva]          = useState('')
  const [codiceFiscale,  setCodiceFiscale] = useState('')

  // Reset al riapri del dialog
  useEffect(() => {
    if (open) {
      setName('')
      setSurname('')
      setEmail('')
      setPhone('')
      setPiva('')
      setCodiceFiscale('')
    }
  }, [open])

  // Dopo creazione riuscita: notifica il parent e chiudi
  useEffect(() => {
    if (state?.success === 'created' && state.clientId) {
      onCreated({
        id:      state.clientId,
        name:    name.trim(),
        surname: surname.trim() || null,
        email:   email.trim() || null,
        phone:   phone.trim() || null,
        piva:    piva.trim()  || null,
      })
      onOpenChange(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="size-5" />
            Nuovo cliente
          </DialogTitle>
          <DialogDescription>
            Solo il nome è obbligatorio. Puoi completare i dettagli in seguito
            dalla scheda cliente.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4 pt-1">
          {/* Errore bloccante (solo name mancante o errore DB) */}
          {state?.error && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
              {state.error}
            </p>
          )}

          {/* Nome + Cognome */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="qc-name">
                Nome / Ragione sociale <span className="text-destructive">*</span>
              </Label>
              <Input
                id="qc-name"
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Mario"
                autoFocus
                disabled={isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qc-surname">
                Cognome{' '}
                <span className="text-muted-foreground font-normal text-xs">(opz.)</span>
              </Label>
              <Input
                id="qc-surname"
                name="surname"
                value={surname}
                onChange={(e) => setSurname(e.target.value)}
                placeholder="Rossi"
                disabled={isPending}
              />
            </div>
          </div>

          {/* Email + Telefono */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="qc-email">Email</Label>
              <Input
                id="qc-email"
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="mario@esempio.it"
                disabled={isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qc-phone">Telefono</Label>
              <Input
                id="qc-phone"
                name="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+39 333 1234567"
                disabled={isPending}
              />
            </div>
          </div>

          {/* P.IVA + Codice Fiscale */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="qc-piva">Partita IVA</Label>
              <Input
                id="qc-piva"
                name="piva"
                value={piva}
                onChange={(e) => setPiva(e.target.value)}
                placeholder="12345678901"
                maxLength={11}
                disabled={isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qc-cf">Codice Fiscale</Label>
              <Input
                id="qc-cf"
                name="codice_fiscale"
                value={codiceFiscale}
                onChange={(e) => setCodiceFiscale(e.target.value.toUpperCase())}
                placeholder="RSSMRA80A01H501Z"
                maxLength={16}
                className="uppercase"
                disabled={isPending}
              />
            </div>
          </div>

          {/* Azioni */}
          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Annulla
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <><Loader2 className="size-4 animate-spin" /> Creazione…</>
              ) : (
                'Crea cliente'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
