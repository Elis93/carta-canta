'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { createClientAction, updateClientAction } from '@/lib/actions/clients'
import type { Database } from '@/types/database'

type ClientRow = Database['public']['Tables']['clients']['Row']

interface ClientFormProps {
  mode: 'create' | 'edit'
  clientId?: string
  defaultValues?: Partial<ClientRow>
}

export function ClientForm({ mode, clientId, defaultValues }: ClientFormProps) {
  const action =
    mode === 'edit' && clientId
      ? updateClientAction.bind(null, clientId)
      : createClientAction

  const [state, formAction, isPending] = useActionState(action, null)

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      {state?.success && (
        <Alert>
          <AlertDescription>{state.success}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="name">
          Nome / Ragione sociale <span className="text-destructive">*</span>
        </Label>
        <Input
          id="name"
          name="name"
          defaultValue={defaultValues?.name ?? ''}
          required
          autoFocus={mode === 'create'}
          placeholder="Mario Rossi"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            defaultValue={defaultValues?.email ?? ''}
            placeholder="mario@esempio.it"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">Telefono</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            defaultValue={defaultValues?.phone ?? ''}
            placeholder="+39 333 1234567"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="piva">Partita IVA</Label>
          <Input
            id="piva"
            name="piva"
            defaultValue={defaultValues?.piva ?? ''}
            placeholder="12345678901"
            maxLength={11}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="codice_fiscale">Codice fiscale</Label>
          <Input
            id="codice_fiscale"
            name="codice_fiscale"
            defaultValue={defaultValues?.codice_fiscale ?? ''}
            placeholder="RSSMRA80A01H501U"
            maxLength={16}
            className="uppercase"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="indirizzo">Indirizzo</Label>
        <Input
          id="indirizzo"
          name="indirizzo"
          defaultValue={defaultValues?.indirizzo ?? ''}
          placeholder="Via Roma 1"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="cap">CAP</Label>
          <Input
            id="cap"
            name="cap"
            defaultValue={defaultValues?.cap ?? ''}
            placeholder="20100"
            maxLength={5}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="citta">Città</Label>
          <Input
            id="citta"
            name="citta"
            defaultValue={defaultValues?.citta ?? ''}
            placeholder="Milano"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="provincia">Prov.</Label>
          <Input
            id="provincia"
            name="provincia"
            defaultValue={defaultValues?.provincia ?? ''}
            placeholder="MI"
            maxLength={2}
            className="uppercase"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Note interne</Label>
        <Textarea
          id="notes"
          name="notes"
          defaultValue={defaultValues?.notes ?? ''}
          placeholder="Note visibili solo a te…"
          rows={3}
        />
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? (
            <><Loader2 className="size-4 animate-spin" />
              {mode === 'create' ? 'Creazione…' : 'Salvataggio…'}
            </>
          ) : (
            mode === 'create' ? 'Aggiungi cliente' : 'Salva modifiche'
          )}
        </Button>
        <Button variant="outline" asChild>
          <Link href="/clienti">Annulla</Link>
        </Button>
      </div>
    </form>
  )
}
