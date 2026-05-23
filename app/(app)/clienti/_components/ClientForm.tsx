'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useComuneLookup } from '@/hooks/useComuneLookup'
import { AlertTriangle, CheckCircle2, Loader2, UserCheck } from 'lucide-react'
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
type FieldKey = 'name' | 'email' | 'cap' | 'provincia'
type FieldErrors = Partial<Record<FieldKey, string>>

function validateField(key: FieldKey, value: string): string {
  if (!value) return ''
  switch (key) {
    case 'name':
      return ''   // solo non-empty richiesto (check server-side)
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? '' : 'Email non valida'
    case 'cap':
      return /^\d{5}$/.test(value) ? '' : '5 cifre (es. 20100)'
    case 'provincia':
      return /^[A-Za-z]{2}$/.test(value.replace(/\s/g, '')) ? '' : '2 lettere (es. MI)'
    default:
      return ''
  }
}

/** Rileva se il valore è P.IVA (11 cifre) o CF (16 alfanumerici) */
function detectPivaCf(raw: string): { piva: string; codiceFiscale: string } {
  const clean = raw.replace(/\s/g, '').toUpperCase()
  if (/^\d{11}$/.test(clean))        return { piva: clean, codiceFiscale: '' }
  if (/^[A-Z0-9]{16}$/.test(clean))  return { piva: '', codiceFiscale: clean }
  return { piva: '', codiceFiscale: '' }
}

function validatePivaCf(val: string): string {
  if (!val.trim()) return ''
  const { piva, codiceFiscale } = detectPivaCf(val)
  if (piva || codiceFiscale) return ''
  return 'P.IVA: 11 cifre · CF: 16 caratteri alfanumerici'
}

export function ClientForm({ mode, clientId, defaultValues }: ClientFormProps) {
  const router = useRouter()

  const action =
    mode === 'edit' && clientId
      ? updateClientAction.bind(null, clientId)
      : createClientAction

  const [state, formAction, isPending] = useActionState(action, null)

  // ── Rilevamento duplicati ─────────────────────────────────────
  const formRef = useRef<HTMLFormElement>(null)
  const [forceCreate, setForceCreate] = useState(false)
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false)

  useEffect(() => {
    if (state?.potentialDuplicate) setShowDuplicateWarning(true)
  }, [state])

  // Dopo aver impostato forceCreate=true il form si ri-sottomette automaticamente
  useEffect(() => {
    if (forceCreate) formRef.current?.requestSubmit()
  }, [forceCreate])

  // ── Controlled state — i valori NON vengono mai azzerati dalla server action
  const [name,      setName]      = useState(defaultValues?.name      ?? '')
  const [surname,   setSurname]   = useState((defaultValues as Record<string, unknown>)?.surname as string ?? '')
  const [email,     setEmail]     = useState(defaultValues?.email     ?? '')
  const [phone,     setPhone]     = useState(defaultValues?.phone     ?? '')
  // Campo unificato P.IVA / CF: in edit mode usa piva se presente, altrimenti codice_fiscale
  const [pivaCf,    setPivaCf]    = useState(defaultValues?.piva ?? defaultValues?.codice_fiscale ?? '')
  const [pivaCfErr, setPivaCfErr] = useState('')
  const [indirizzo, setIndirizzo] = useState(defaultValues?.indirizzo ?? '')
  const [notes,     setNotes]     = useState(defaultValues?.notes     ?? '')

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
    <form ref={formRef} action={formAction} className="space-y-4">
      {/* Campo nascosto per forzare la creazione nonostante un duplicato */}
      {forceCreate && <input type="hidden" name="forceDuplicate" value="true" />}

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

      {/* ── Nome + Cognome ───────────────────────────────────── */}
      {/* Label nella prima riga CSS, input nella seconda: garantisce allineamento
          anche quando "Nome / Ragione sociale *" va a capo su schermi stretti. */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        <Label htmlFor="name" className="self-end leading-snug">
          Nome / Ragione sociale <span className="text-destructive">*</span>
        </Label>
        <Label htmlFor="surname" className="self-end leading-snug">Cognome</Label>
        <div className="space-y-1">
          <Input
            id="name"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={(e) => setFieldError('name', e.target.value)}
            autoFocus={mode === 'create'}
            placeholder="Mario"
            className={fieldErrors.name ? 'border-destructive' : ''}
          />
          {fieldErrors.name && (
            <p className="text-xs text-destructive">{fieldErrors.name}</p>
          )}
        </div>
        <Input
          id="surname"
          name="surname"
          value={surname}
          onChange={(e) => setSurname(e.target.value)}
          placeholder="Rossi"
        />
      </div>

      {/* ── Email + Telefono ─────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        <Label htmlFor="email" className="self-end leading-snug">Email</Label>
        <Label htmlFor="phone" className="self-end leading-snug">Telefono</Label>
        <div className="space-y-1">
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
        <Input
          id="phone"
          name="phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+39 333 1234567"
        />
      </div>

      {/* ── P.IVA / Codice Fiscale — campo unico con rilevamento automatico ── */}
      {/* Hidden fields che ricevono il valore rilevato automaticamente */}
      <input type="hidden" name="piva"           value={detectPivaCf(pivaCf).piva} />
      <input type="hidden" name="codice_fiscale" value={detectPivaCf(pivaCf).codiceFiscale} />
      <div className="space-y-1.5">
        <Label htmlFor="piva-cf">
          P.IVA / Codice Fiscale{' '}
        </Label>
        <Input
          id="piva-cf"
          value={pivaCf}
          onChange={(e) => { setPivaCf(e.target.value.toUpperCase()); setPivaCfErr('') }}
          onBlur={(e) => setPivaCfErr(validatePivaCf(e.target.value))}
          placeholder="es. 12345678901"
          maxLength={16}
          className={`uppercase ${pivaCfErr ? 'border-yellow-400' : ''}`}
        />
        {pivaCfErr && <p className="text-xs text-yellow-600">{pivaCfErr}</p>}
        {(() => {
          const { piva, codiceFiscale } = detectPivaCf(pivaCf)
          if (piva)           return <p className="text-xs text-green-600">P.IVA rilevata ✓</p>
          if (codiceFiscale)  return <p className="text-xs text-green-600">Codice Fiscale rilevato ✓</p>
          return null
        })()}
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
      <div className="grid grid-cols-3 gap-x-3 gap-y-1.5">
        <Label htmlFor="cap" className="self-end leading-snug">CAP</Label>
        <Label htmlFor="citta" className="self-end leading-snug">Città</Label>
        <Label htmlFor="provincia" className="self-end leading-snug">Prov.</Label>
        <div className="space-y-1">
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
        <Input
          id="citta"
          name="citta"
          placeholder="Milano"
          value={citta}
          onChange={(e) => onCittaChange(e.target.value)}
        />
        <div className="space-y-1">
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

      {/* ── Avviso duplicato ─────────────────────────────────── */}
      {showDuplicateWarning && state?.potentialDuplicate && (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 space-y-3">
          <div className="flex items-start gap-2 text-yellow-800">
            <AlertTriangle className="size-4 mt-0.5 shrink-0" />
            <p className="text-sm font-medium">
              Abbiamo trovato un cliente molto simile già registrato. È lo stesso?
            </p>
          </div>

          {/* Card cliente esistente */}
          <div className="rounded-md border border-yellow-200 bg-white px-4 py-3 text-sm space-y-0.5">
            <p className="font-semibold text-foreground">
              {state.potentialDuplicate.name}
              {state.potentialDuplicate.surname ? ` ${state.potentialDuplicate.surname}` : ''}
            </p>
            {state.potentialDuplicate.email && (
              <p className="text-muted-foreground">{state.potentialDuplicate.email}</p>
            )}
            {state.potentialDuplicate.phone && (
              <p className="text-muted-foreground">{state.potentialDuplicate.phone}</p>
            )}
            {state.potentialDuplicate.piva && (
              <p className="text-muted-foreground">P.IVA: {state.potentialDuplicate.piva}</p>
            )}
            {state.potentialDuplicate.codice_fiscale && (
              <p className="text-muted-foreground">CF: {state.potentialDuplicate.codice_fiscale}</p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              type="button"
              className="gap-2 flex-1"
              onClick={() => router.push(`/clienti/${state.potentialDuplicate!.id}`)}
            >
              <UserCheck className="size-4" />
              Sì, usa questo cliente
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1 text-yellow-700 border-yellow-300 hover:bg-yellow-50"
              onClick={() => {
                setShowDuplicateWarning(false)
                setForceCreate(true)
              }}
            >
              No, crea comunque
            </Button>
          </div>
        </div>
      )}

      {/* ── Legenda + Azioni ─────────────────────────────────── */}
      {!showDuplicateWarning && (
        <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          <span className="text-destructive">*</span> Campo obbligatorio
        </p>
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
        </div>
      )}
    </form>
  )
}
