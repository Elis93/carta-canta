'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useComuneLookup } from '@/hooks/useComuneLookup'
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
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

// ── Errori campo singolo ───────────────────────────────────────
type FieldKey = 'name' | 'email' | 'piva' | 'codice_fiscale' | 'cap' | 'provincia'
type FieldErrors = Partial<Record<FieldKey, string>>

function validateField(key: FieldKey, value: string): string {
  if (!value) return ''
  switch (key) {
    case 'name':
      return value.trim().length < 2 ? 'Min. 2 caratteri' : ''
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? '' : 'Email non valida'
    case 'piva':
      return /^\d{11}$/.test(value.replace(/\s/g, '')) ? '' : '11 cifre (es. 12345678901)'
    case 'codice_fiscale':
      return /^[A-Z0-9]{16}$/i.test(value.replace(/\s/g, '')) ? '' : '16 caratteri alfanumerici'
    case 'cap':
      return /^\d{5}$/.test(value) ? '' : '5 cifre (es. 20100)'
    case 'provincia':
      return /^[A-Za-z]{2}$/.test(value.replace(/\s/g, '')) ? '' : '2 lettere (es. MI)'
    default:
      return ''
  }
}

export function ClientForm({ mode, clientId, defaultValues }: ClientFormProps) {
  const router = useRouter()

  const action =
    mode === 'edit' && clientId
      ? updateClientAction.bind(null, clientId)
      : createClientAction

  const [state, formAction, isPending] = useActionState(action, null)

  // ── Controlled state — i valori NON vengono mai azzerati dalla server action
  const [name,           setName]           = useState(defaultValues?.name           ?? '')
  const [email,          setEmail]          = useState(defaultValues?.email          ?? '')
  const [phone,          setPhone]          = useState(defaultValues?.phone          ?? '')
  const [piva,           setPiva]           = useState(defaultValues?.piva           ?? '')
  const [codiceFiscale,  setCodiceFiscale]  = useState(defaultValues?.codice_fiscale ?? '')
  const [indirizzo,      setIndirizzo]      = useState(defaultValues?.indirizzo      ?? '')
  const [notes,          setNotes]          = useState(defaultValues?.notes          ?? '')

  // ── Errori blur per i campi con formato specifico ─────────────
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  function setFieldError(key: FieldKey, value: string) {
    setFieldErrors((prev) => ({ ...prev, [key]: validateField(key, value) }))
  }

  // ── CAP / Città / Provincia — già controllati dall'hook ───────
  const { cap, citta, provincia, onCapChange, onCittaChange, onProvinciaChange } =
    useComuneLookup({
      cap:       defaultValues?.cap       ?? '',
      citta:     defaultValues?.citta     ?? '',
      provincia: defaultValues?.provincia ?? '',
    })

  // ── Navigazione dopo create ────────────────────────────────────
  useEffect(() => {
    if (state?.success === 'created' && state.clientId) {
      router.push(`/clienti/${state.clientId}`)
    }
  }, [state, router])

  // ── Render ────────────────────────────────────────────────────
  const hasWarnings = (state?.warnings?.length ?? 0) > 0

  return (
    <form action={formAction} className="space-y-4">

      {/* Errore bloccante (solo name mancante o errore DB) */}
      {state?.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      {/* Avvisi non bloccanti: campi opzionali con formato errato saltati */}
      {hasWarnings && (
        <div className="flex gap-3 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-medium">Alcuni campi non sono stati salvati:</p>
            <ul className="list-disc list-inside space-y-0.5">
              {state!.warnings!.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
            <p className="mt-1 text-yellow-700">Puoi correggerli e risalvare.</p>
          </div>
        </div>
      )}

      {/* Successo edit mode */}
      {state?.success === 'updated' && !hasWarnings && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <CheckCircle2 className="size-4 shrink-0" />
          Cliente aggiornato correttamente.
        </div>
      )}

      {/* ── Nome ─────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <Label htmlFor="name">
          Nome / Ragione sociale <span className="text-destructive">*</span>
        </Label>
        <Input
          id="name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={(e) => setFieldError('name', e.target.value)}
          autoFocus={mode === 'create'}
          placeholder="Mario Rossi"
          className={fieldErrors.name ? 'border-destructive' : ''}
        />
        {fieldErrors.name && (
          <p className="text-xs text-destructive">{fieldErrors.name}</p>
        )}
      </div>

      {/* ── Email + Telefono ─────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={(e) => setFieldError('email', e.target.value)}
            placeholder="mario@esempio.it"
            className={fieldErrors.email ? 'border-yellow-400' : ''}
          />
          {fieldErrors.email && (
            <p className="text-xs text-yellow-600">{fieldErrors.email}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">Telefono</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+39 333 1234567"
          />
        </div>
      </div>

      {/* ── P.IVA + Codice fiscale ───────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="piva">Partita IVA</Label>
          <Input
            id="piva"
            name="piva"
            value={piva}
            onChange={(e) => setPiva(e.target.value)}
            onBlur={(e) => setFieldError('piva', e.target.value)}
            placeholder="12345678901"
            maxLength={11}
            className={fieldErrors.piva ? 'border-yellow-400' : ''}
          />
          {fieldErrors.piva && (
            <p className="text-xs text-yellow-600">{fieldErrors.piva}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="codice_fiscale">Codice fiscale</Label>
          <Input
            id="codice_fiscale"
            name="codice_fiscale"
            value={codiceFiscale}
            onChange={(e) => setCodiceFiscale(e.target.value.toUpperCase())}
            onBlur={(e) => setFieldError('codice_fiscale', e.target.value)}
            placeholder="RSSMRA80A01H501U"
            maxLength={16}
            className={`uppercase ${fieldErrors.codice_fiscale ? 'border-yellow-400' : ''}`}
          />
          {fieldErrors.codice_fiscale && (
            <p className="text-xs text-yellow-600">{fieldErrors.codice_fiscale}</p>
          )}
        </div>
      </div>

      {/* ── Indirizzo ────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <Label htmlFor="indirizzo">Indirizzo</Label>
        <Input
          id="indirizzo"
          name="indirizzo"
          value={indirizzo}
          onChange={(e) => setIndirizzo(e.target.value)}
          placeholder="Via Roma 1"
        />
      </div>

      {/* ── CAP / Città / Provincia ──────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="cap">CAP</Label>
          <Input
            id="cap"
            name="cap"
            placeholder="20100"
            maxLength={5}
            value={cap}
            onChange={(e) => { onCapChange(e.target.value); setFieldError('cap', e.target.value) }}
            onBlur={(e) => setFieldError('cap', e.target.value)}
            className={fieldErrors.cap ? 'border-yellow-400' : ''}
          />
          {fieldErrors.cap && (
            <p className="text-xs text-yellow-600">{fieldErrors.cap}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="citta">Città</Label>
          <Input
            id="citta"
            name="citta"
            placeholder="Milano"
            value={citta}
            onChange={(e) => onCittaChange(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="provincia">Prov.</Label>
          <Input
            id="provincia"
            name="provincia"
            placeholder="MI"
            maxLength={2}
            className={`uppercase ${fieldErrors.provincia ? 'border-yellow-400' : ''}`}
            value={provincia}
            onChange={(e) => { onProvinciaChange(e.target.value); setFieldError('provincia', e.target.value) }}
            onBlur={(e) => setFieldError('provincia', e.target.value)}
          />
          {fieldErrors.provincia && (
            <p className="text-xs text-yellow-600">{fieldErrors.provincia}</p>
          )}
        </div>
      </div>

      {/* ── Note interne ─────────────────────────────────────── */}
      <div className="space-y-1.5">
        <Label htmlFor="notes">Note interne</Label>
        <Textarea
          id="notes"
          name="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Note visibili solo a te…"
          rows={3}
        />
      </div>

      {/* ── Azioni ───────────────────────────────────────────── */}
      <div className="flex gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
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
