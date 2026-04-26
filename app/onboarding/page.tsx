'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import confetti from 'canvas-confetti'
import { Building2, Upload, Rocket, CheckCircle2, ChevronRight, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { updateWorkspaceData, uploadLogo } from '@/lib/actions/workspace'
import { searchAteco, type AtecoCode } from '@/lib/data/ateco'
import { useComuneLookup } from '@/hooks/useComuneLookup'

// ============================================================
// PROGRESS BAR
// ============================================================
function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
            i < step ? 'bg-primary' : 'bg-muted'
          }`}
        />
      ))}
      <span className="text-xs text-muted-foreground shrink-0 ml-1">
        {step}/{total}
      </span>
    </div>
  )
}

// ============================================================
// STEP 1 — DATI AZIENDA
// ============================================================
function Step1({
  onSuccess,
}: {
  onSuccess: () => void
}) {
  const [state, formAction, isPending] = useActionState(updateWorkspaceData, null)
  const [fiscalRegime, setFiscalRegime] = useState('forfettario')
  const { cap, citta, provincia, onCapChange, onCittaChange, onProvinciaChange } = useComuneLookup()
  const [atecoQuery, setAtecoQuery] = useState('')
  const [atecoResults, setAtecoResults] = useState<AtecoCode[]>([])
  const [selectedAteco, setSelectedAteco] = useState<AtecoCode | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const atecoRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (state?.success) {
      onSuccess()
    }
  }, [state, onSuccess])

  useEffect(() => {
    setAtecoResults(searchAteco(atecoQuery))
    setShowDropdown(atecoQuery.length > 0 && !selectedAteco)
  }, [atecoQuery, selectedAteco])

  // Chiudi dropdown cliccando fuori
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (atecoRef.current && !atecoRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <form action={formAction} className="space-y-5">
      {/* Campi hidden */}
      <input type="hidden" name="fiscal_regime" value={fiscalRegime} />
      <input type="hidden" name="ateco_code" value={selectedAteco?.code ?? ''} />

      {state?.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="ragione_sociale">
          Ragione sociale / Nome attività <span className="text-destructive">*</span>
        </Label>
        <Input
          id="ragione_sociale"
          name="ragione_sociale"
          placeholder="es. Mario Rossi Impianti Idraulici"
          required
          autoFocus
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="piva">Partita IVA</Label>
        <Input
          id="piva"
          name="piva"
          placeholder="12345678901"
          maxLength={11}
          pattern="\d{11}"
          title="Inserisci 11 cifre"
        />
        <p className="text-xs text-muted-foreground">11 cifre, senza prefisso IT</p>
      </div>

      <div className="space-y-1.5">
        <Label>Regime fiscale <span className="text-destructive">*</span></Label>
        <Select value={fiscalRegime} onValueChange={setFiscalRegime}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="forfettario">
              Regime Forfettario
              <span className="ml-2 text-xs text-muted-foreground">(no IVA)</span>
            </SelectItem>
            <SelectItem value="ordinario">
              Regime Ordinario
              <span className="ml-2 text-xs text-muted-foreground">(con IVA)</span>
            </SelectItem>
            <SelectItem value="minimi">
              Regime dei Minimi
            </SelectItem>
          </SelectContent>
        </Select>
        {fiscalRegime === 'forfettario' && (
          <p className="text-xs text-muted-foreground">
            I preventivi non includeranno IVA e avranno la stringa legale obbligatoria.
          </p>
        )}
      </div>

      {/* ATECO autocomplete */}
      <div className="space-y-1.5" ref={atecoRef}>
        <Label>Codice ATECO</Label>
        {selectedAteco ? (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs py-1 px-2 font-mono">
              {selectedAteco.code}
            </Badge>
            <span className="text-sm flex-1 truncate">{selectedAteco.label}</span>
            <button
              type="button"
              onClick={() => { setSelectedAteco(null); setAtecoQuery('') }}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <div className="relative">
            <Input
              placeholder="Cerca per attività o codice…"
              value={atecoQuery}
              onChange={(e) => setAtecoQuery(e.target.value)}
              onFocus={() => setShowDropdown(atecoQuery.length > 0)}
              autoComplete="off"
            />
            {showDropdown && atecoResults.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-popover border rounded-lg shadow-lg overflow-hidden">
                {atecoResults.map((a) => (
                  <button
                    key={a.code}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-start gap-2"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      setSelectedAteco(a)
                      setAtecoQuery('')
                      setShowDropdown(false)
                    }}
                  >
                    <span className="font-mono text-xs text-muted-foreground shrink-0 mt-0.5">
                      {a.code}
                    </span>
                    <span>{a.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="indirizzo">Indirizzo</Label>
          <Input id="indirizzo" name="indirizzo" placeholder="Via Roma 1" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cap">CAP</Label>
          <Input
            id="cap"
            name="cap"
            placeholder="20100"
            maxLength={5}
            value={cap}
            onChange={(e) => onCapChange(e.target.value)}
          />
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
          <Label htmlFor="provincia">Provincia</Label>
          <Input
            id="provincia"
            name="provincia"
            placeholder="MI"
            maxLength={2}
            className="uppercase"
            value={provincia}
            onChange={(e) => onProvinciaChange(e.target.value)}
          />
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={isPending} size="lg">
        {isPending ? (
          <><Loader2 className="size-4 animate-spin" /> Salvataggio…</>
        ) : (
          <>Continua <ChevronRight className="size-4" /></>
        )}
      </Button>
    </form>
  )
}

// ============================================================
// STEP 2 — LOGO UPLOAD
// ============================================================
function Step2({
  onSuccess,
  onSkip,
}: {
  onSuccess: () => void
  onSkip: () => void
}) {
  const [state, formAction, isPending] = useActionState(uploadLogo, null)
  const [preview, setPreview] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (state?.success) {
      onSuccess()
    }
  }, [state, onSuccess])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (ev) => setPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  return (
    <form action={formAction} className="space-y-5">
      {state?.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <div
        className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => inputRef.current?.click()}
      >
        {preview ? (
          <div className="flex flex-col items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="Anteprima logo"
              className="size-24 object-contain rounded-lg border"
            />
            <p className="text-sm text-muted-foreground">{fileName}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation()
                setPreview(null)
                setFileName(null)
                if (inputRef.current) inputRef.current.value = ''
              }}
            >
              Cambia immagine
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="size-12 rounded-full bg-muted flex items-center justify-center">
              <Upload className="size-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">Clicca per caricare il logo</p>
            <p className="text-xs text-muted-foreground">PNG, JPG, WebP o SVG — max 2MB</p>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          name="logo"
          accept="image/jpeg,image/png,image/webp,image/svg+xml"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={onSkip}
        >
          Salta per ora
        </Button>
        <Button
          type="submit"
          className="flex-1"
          disabled={isPending || !preview}
        >
          {isPending ? (
            <><Loader2 className="size-4 animate-spin" /> Caricamento…</>
          ) : (
            <>Carica logo <ChevronRight className="size-4" /></>
          )}
        </Button>
      </div>
    </form>
  )
}

// ============================================================
// STEP 3 — COMPLETAMENTO
// ============================================================
function Step3({ onComplete }: { onComplete: () => void }) {
  const hasConfetti = useRef(false)

  useEffect(() => {
    if (hasConfetti.current) return
    hasConfetti.current = true

    const duration = 3000
    const end = Date.now() + duration

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#6366f1', '#8b5cf6', '#a78bfa'],
      })
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#6366f1', '#8b5cf6', '#a78bfa'],
      })
      if (Date.now() < end) requestAnimationFrame(frame)
    }
    frame()
  }, [])

  return (
    <div className="text-center space-y-6 py-4">
      <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
        <CheckCircle2 className="size-8 text-primary" />
      </div>
      <div>
        <h2 className="text-xl font-semibold">Tutto pronto!</h2>
        <p className="text-muted-foreground mt-1.5 text-sm">
          Il tuo workspace è configurato. Crea il tuo primo preventivo in meno di 60 secondi.
        </p>
      </div>
      <Button size="lg" className="w-full" onClick={onComplete}>
        <Rocket className="size-4" />
        Crea il primo preventivo
      </Button>
      <Button variant="ghost" size="sm" onClick={() => window.location.href = '/dashboard'}>
        Vai alla dashboard
      </Button>
    </div>
  )
}

// ============================================================
// MAIN PAGE
// ============================================================
const STEPS = [
  { icon: Building2, title: 'La tua attività', subtitle: 'Configura il tuo profilo professionale' },
  { icon: Upload,    title: 'Il tuo logo',     subtitle: 'Aggiungi un tocco professionale' },
  { icon: Rocket,    title: 'Inizia!',          subtitle: 'Crea il tuo primo preventivo' },
]

export default function OnboardingPage() {
  const [step, setStep] = useState(1)
  const router = useRouter()

  const currentStep = STEPS[step - 1]!
  const Icon = currentStep.icon

  function handleComplete() {
    router.push('/preventivi/nuovo')
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="h-14 border-b flex items-center px-4 md:px-6">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-xs">CC</span>
          </div>
          <span className="font-semibold text-sm">Carta Canta</span>
        </div>
        <div className="ml-auto w-48">
          <ProgressBar step={step} total={3} />
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Step header */}
          <div className="text-center mb-8">
            <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Icon className="size-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">{currentStep.title}</h1>
            <p className="text-muted-foreground mt-1 text-sm">{currentStep.subtitle}</p>
          </div>

          {/* Step content */}
          {step === 1 && (
            <Step1 onSuccess={() => setStep(2)} />
          )}
          {step === 2 && (
            <Step2
              onSuccess={() => setStep(3)}
              onSkip={() => setStep(3)}
            />
          )}
          {step === 3 && (
            <Step3 onComplete={handleComplete} />
          )}
        </div>
      </div>
    </div>
  )
}
