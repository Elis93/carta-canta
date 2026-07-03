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

// Titoletto campo — 12px/600/.05em/UPPERCASE/#8a887f, 7px sotto (come mockup 03)
const fieldLabelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: '.05em',
  textTransform: 'uppercase',
  color: '#8a887f',
  marginBottom: 7,
}

// Riquadro campo — mockup 03: border #e3e3e6, radius 10, padding 11px 12px, font 14
const fieldBoxStyle: React.CSSProperties = {
  border: '1px solid #e3e3e6',
  borderRadius: 10,
  padding: '11px 12px',
  fontSize: 14,
  height: 'auto',
  width: '100%',
  boxSizing: 'border-box',
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
  const [paese,     setPaese]     = useState(defaultValues?.paese     ?? '')
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

  // ── Navigazione dopo create / update ──────────────────────────
  useEffect(() => {
    if (state?.success === 'created' && state.clientId) {
      router.push(`/clienti/${state.clientId}`)
    }
    if (state?.success === 'updated' && !(state.warnings?.length)) {
      router.push('/clienti')
    }
  }, [state, router])

  // ── Render ────────────────────────────────────────────────────
  const hasWarnings = (state?.warnings?.length ?? 0) > 0

  return (
    <form ref={formRef} action={formAction} className="space-y-[14px]">
      {/* Campo nascosto per forzare la creazione nonostante un duplicato */}
      {forceCreate && <input type="hidden" name="forceDuplicate" value="true" />}

      {/* Errore bloccante */}
      {state?.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      {/* Avvisi non bloccanti */}
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

      {/* ── Sezione CONTATTO ───────────────────────────────── */}
      <div className="cc-card-md" style={{ padding: '15px 15px' }}>
        <div className="cc-section-label mb-3">Contatto</div>

        {/* Nome + Cognome */}
        <div className="grid grid-cols-2 gap-x-[10px]" style={{ marginBottom: 14 }}>
          <div>
            <Label htmlFor="name" style={fieldLabelStyle}>
              Nome / Rag. sociale <span style={{ color: '#b08d3e' }}>*</span>
            </Label>
            <Input
              id="name"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={(e) => setFieldError('name', e.target.value)}
              autoFocus={mode === 'create'}
              placeholder="Mario"
              style={{ ...fieldBoxStyle, ...(fieldErrors.name ? { borderColor: '#ef4444' } : {}) }}
            />
            {fieldErrors.name && (
              <p className="text-xs text-destructive mt-1">{fieldErrors.name}</p>
            )}
          </div>
          <div>
            <Label htmlFor="surname" style={fieldLabelStyle}>Cognome</Label>
            <Input
              id="surname"
              name="surname"
              value={surname}
              onChange={(e) => setSurname(e.target.value)}
              placeholder="Rossi"
              style={fieldBoxStyle}
            />
          </div>
        </div>

        {/* Email */}
        <div style={{ marginBottom: 14 }}>
          <Label htmlFor="email" style={fieldLabelStyle}>Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={(e) => setFieldError('email', e.target.value)}
            placeholder="mario@esempio.it"
            style={{ ...fieldBoxStyle, ...(fieldErrors.email ? { borderColor: '#eab308' } : {}) }}
          />
          {fieldErrors.email && (
            <p className="text-xs text-yellow-600 mt-1">{fieldErrors.email}</p>
          )}
        </div>

        {/* Telefono */}
        <div>
          <Label htmlFor="phone" style={fieldLabelStyle}>Telefono</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+39 333 1234567"
            style={fieldBoxStyle}
          />
        </div>

        <p style={{ fontSize: 12, color: '#8a887f', marginTop: 7 }}>
          Inserisci almeno email o telefono per poter inviare i documenti.
        </p>
      </div>

      {/* ── Sezione DATI FISCALI ─────────────────────────────── */}
      {/* Hidden fields che ricevono il valore rilevato automaticamente */}
      <input type="hidden" name="piva"           value={detectPivaCf(pivaCf).piva} />
      <input type="hidden" name="codice_fiscale" value={detectPivaCf(pivaCf).codiceFiscale} />
      <div className="cc-card-md" style={{ padding: '15px 15px' }}>
        <div className="cc-section-label mb-3">Dati fiscali</div>
        <div>
          <Label htmlFor="piva-cf" style={fieldLabelStyle}>P.IVA / Codice Fiscale</Label>
          {/* value già maiuscolo da onChange → niente text-transform (evita il placeholder "ES.") */}
          <Input
            id="piva-cf"
            value={pivaCf}
            onChange={(e) => { setPivaCf(e.target.value.toUpperCase()); setPivaCfErr('') }}
            onBlur={(e) => setPivaCfErr(validatePivaCf(e.target.value))}
            placeholder="es. 12345678901"
            maxLength={16}
            style={{ ...fieldBoxStyle, ...(pivaCfErr ? { borderColor: '#eab308' } : {}) }}
          />
          {pivaCfErr && <p className="text-xs text-yellow-600 mt-1">{pivaCfErr}</p>}
          {(() => {
            const { piva, codiceFiscale } = detectPivaCf(pivaCf)
            if (piva)          return <p className="text-xs text-green-600 mt-1">P.IVA rilevata ✓</p>
            if (codiceFiscale) return <p className="text-xs text-green-600 mt-1">Codice Fiscale rilevato ✓</p>
            return null
          })()}
        </div>
      </div>

      {/* ── Sezione INDIRIZZO ─────────────────────────────────── */}
      <div className="cc-card-md" style={{ padding: '15px 15px' }}>
        <div className="cc-section-label mb-3">Indirizzo</div>

        {/* Via */}
        <div style={{ marginBottom: 14 }}>
          <Label htmlFor="indirizzo" style={fieldLabelStyle}>Indirizzo</Label>
          <Input
            id="indirizzo"
            name="indirizzo"
            value={indirizzo}
            onChange={(e) => setIndirizzo(e.target.value)}
            placeholder="Via Roma 1"
            style={fieldBoxStyle}
          />
        </div>

        {/* Città / Provincia / CAP — ordine Città→Provincia→CAP */}
        <div className="flex gap-[10px]" style={{ marginBottom: 14 }}>
          <div className="flex-1">
            <Label htmlFor="citta" style={fieldLabelStyle}>Città</Label>
            <Input
              id="citta"
              name="citta"
              placeholder="Milano"
              value={citta}
              onChange={(e) => onCittaChange(e.target.value)}
              style={fieldBoxStyle}
            />
          </div>
          <div style={{ width: 64 }}>
            <Label htmlFor="provincia" style={fieldLabelStyle}>Prov.</Label>
            <Input
              id="provincia"
              name="provincia"
              placeholder="MI"
              maxLength={2}
              value={provincia}
              onChange={(e) => { onProvinciaChange(e.target.value); setFieldError('provincia', e.target.value) }}
              onBlur={(e) => setFieldError('provincia', e.target.value)}
              style={{ ...fieldBoxStyle, textTransform: 'uppercase', ...(fieldErrors.provincia ? { borderColor: '#eab308' } : {}) }}
            />
            {fieldErrors.provincia && (
              <p className="text-xs text-yellow-600 mt-1">{fieldErrors.provincia}</p>
            )}
          </div>
          <div style={{ width: 84 }}>
            <Label htmlFor="cap" style={fieldLabelStyle}>CAP</Label>
            <Input
              id="cap"
              name="cap"
              placeholder="20100"
              maxLength={5}
              value={cap}
              onChange={(e) => { onCapChange(e.target.value); setFieldError('cap', e.target.value) }}
              onBlur={(e) => setFieldError('cap', e.target.value)}
              style={{ ...fieldBoxStyle, ...(fieldErrors.cap ? { borderColor: '#eab308' } : {}) }}
            />
            {fieldErrors.cap && (
              <p className="text-xs text-yellow-600 mt-1">{fieldErrors.cap}</p>
            )}
          </div>
        </div>

        {/* Paese */}
        <div style={{ marginBottom: 14 }}>
          <Label htmlFor="paese" style={fieldLabelStyle}>Paese</Label>
          <Input
            id="paese"
            name="paese"
            value={paese}
            onChange={(e) => setPaese(e.target.value)}
            placeholder="Italia"
            style={fieldBoxStyle}
          />
        </div>

        {/* Note interne */}
        <div>
          <Label htmlFor="notes" style={fieldLabelStyle}>Note interne</Label>
          <Textarea
            id="notes"
            name="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Note visibili solo a te…"
            style={{ ...fieldBoxStyle, minHeight: 60, resize: 'vertical' }}
          />
        </div>
      </div>

      {/* ── Avviso duplicato ─────────────────────────────────── */}
      {showDuplicateWarning && state?.potentialDuplicate && (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 space-y-3">
          <div className="flex items-start gap-2 text-yellow-800">
            <AlertTriangle className="size-4 mt-0.5 shrink-0" />
            <div className="text-sm">
              {state.duplicateField === 'email' ? (
                <p className="font-medium">
                  L&apos;email{' '}
                  <span className="font-semibold">{email}</span>{' '}
                  è già usata dal contatto{' '}
                  <span className="font-semibold">
                    {state.potentialDuplicate.name}
                    {state.potentialDuplicate.surname ? ` ${state.potentialDuplicate.surname}` : ''}
                  </span>
                  . È lo stesso?
                </p>
              ) : state.duplicateField === 'phone' ? (
                <p className="font-medium">
                  Il numero{' '}
                  <span className="font-semibold">{phone}</span>{' '}
                  è già usato dal contatto{' '}
                  <span className="font-semibold">
                    {state.potentialDuplicate.name}
                    {state.potentialDuplicate.surname ? ` ${state.potentialDuplicate.surname}` : ''}
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
              Sì, usa &ldquo;{state.potentialDuplicate!.name}{state.potentialDuplicate!.surname ? ` ${state.potentialDuplicate!.surname}` : ''}&rdquo;
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
              No, crea &ldquo;{name.trim()}{surname.trim() ? ` ${surname.trim()}` : ''}&rdquo;
              {state.duplicateField === 'email' && (
                <span className="ml-1 text-xs opacity-75">(email in comune)</span>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* ── Azioni ─────────────────────────────────── */}
      {!showDuplicateWarning && (
        <div>
          {/* Mobile: bottone full-width navy */}
          <Button
            type="submit"
            disabled={isPending}
            className="w-full"
            style={{
              background: '#1a1a2e',
              color: '#fff',
              borderRadius: 12,
              height: 50,
              boxSizing: 'border-box',
              fontSize: 14,
              fontWeight: 600,
              boxShadow: '0 6px 16px -6px rgba(26,26,46,.5)',
            }}
          >
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {mode === 'create' ? 'Creazione…' : 'Salvataggio…'}
              </>
            ) : (
              mode === 'create' ? 'Aggiungi cliente' : 'Salva modifiche'
            )}
          </Button>
          <p style={{ fontSize: 12, color: '#b08d3e', marginTop: 10 }}>
            * Campo obbligatorio
          </p>
        </div>
      )}
    </form>
  )
}
