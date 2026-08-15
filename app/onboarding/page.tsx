'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import confetti from 'canvas-confetti'
import { Upload, Rocket, CheckCircle2, ArrowRight, ChevronRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { updateWorkspaceData, uploadLogo } from '@/lib/actions/workspace'
import { createClient } from '@/lib/supabase/client'
import { AtecoMultiSelect } from '@/components/shared/AtecoMultiSelect'
import { useComuneLookup } from '@/hooks/useComuneLookup'

// ── Stili condivisi mockup ──────────────────────────────────
const fieldLabel: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: '.05em',
  textTransform: 'uppercase',
  color: 'var(--cc-muted)',
  marginBottom: 7,
}
const fieldBox: React.CSSProperties = {
  width: '100%',
  border: '1px solid #e3e3e6',
  borderRadius: 10,
  padding: '11px 12px',
  fontSize: 14,
  color: '#161616',
  background: '#fff',
  outline: 'none',
}
const primaryBtn: React.CSSProperties = {
  width: '100%',
  background: '#1a1a2e',
  color: '#fff',
  border: 'none',
  borderRadius: 12,
  height: 50,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  fontSize: 15,
  fontWeight: 600,
  marginTop: 16,
  boxShadow: '0 6px 16px -6px rgba(26,26,46,.5)',
  cursor: 'pointer',
}
const cardStyle: React.CSSProperties = {
  margin: '16px 18px 0',
  background: '#fff',
  borderRadius: 14,
  boxShadow: '0 1px 2px rgba(20,20,40,.05), 0 8px 24px -10px rgba(20,20,40,.15)',
  padding: '16px 16px',
}

// ============================================================
// PROGRESS BAR — 3 punti (mockup)
// ============================================================
function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 10 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{
            width: 26,
            height: 4,
            borderRadius: 2,
            background: i < step ? '#1a1a2e' : '#e3e3e6',
          }}
        />
      ))}
    </div>
  )
}

// ============================================================
// STEP 1 — DATI AZIENDA
// ============================================================
function Step1({ onSuccess }: { onSuccess: () => void }) {
  const [state, formAction, isPending] = useActionState(updateWorkspaceData, null)
  const [fiscalRegime, setFiscalRegime] = useState('forfettario')
  const { cap, citta, provincia, onCapChange, onCittaChange, onProvinciaChange } = useComuneLookup()

  useEffect(() => {
    if (state?.success) {
      onSuccess()
    }
  }, [state, onSuccess])

  return (
    <form action={formAction}>
      <input type="hidden" name="fiscal_regime" value={fiscalRegime} />

      <div style={cardStyle}>
        {state?.error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}

        {/* Ragione sociale — l'unico campo OBBLIGATORIO: senza, i documenti non
            hanno intestazione e l'app rimanda comunque qui. Per questo il passo
            non si salta (Eli, #0): si segna l'obbligatorietà con l'asterisco. */}
        <div style={fieldLabel}>Ragione sociale <span style={{ color: '#c0392b' }}>*</span></div>
        <input
          id="ragione_sociale"
          name="ragione_sociale"
          placeholder="Edil Demo srl"
          required
          autoFocus
          style={fieldBox}
        />

        <div style={{ height: 14 }} />

        {/* Regime fiscale */}
        <div style={fieldLabel}>Regime fiscale</div>
        <Select value={fiscalRegime} onValueChange={setFiscalRegime}>
          <SelectTrigger
            className="w-full h-auto rounded-[10px] border-[#e3e3e6] px-3 py-[11px] text-sm text-[#161616] [&_svg]:size-[18px] [&_svg]:text-[var(--cc-muted)]"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="forfettario">Forfettario</SelectItem>
            <SelectItem value="ordinario">Ordinario</SelectItem>
          </SelectContent>
        </Select>
        {/* ⚠️ Il regime decide IVA, marca da bollo e diciture di legge su OGNI
            documento, e la scelta di partenza è «forfettario»: chi scorre
            senza guardare si porta dietro numeri sbagliati per sempre. Qui si
            dice cosa cambia, così la scelta è consapevole. */}
        <p style={{ fontSize: 12, color: 'var(--cc-muted)', marginTop: 6, lineHeight: 1.45 }}>
          Decide l&rsquo;IVA, la marca da bollo e le diciture di legge sui tuoi documenti.
          In forfettario non si addebita IVA. Se non ne sei certo, chiedi al tuo
          commercialista: si cambia in ogni momento dalle Impostazioni.
        </p>

        <div style={{ height: 14 }} />

        {/* P.IVA / Codice Fiscale */}
        <div style={fieldLabel}>P.IVA / Codice Fiscale</div>
        <input
          id="piva"
          name="piva"
          placeholder="01234567890"
          maxLength={16}
          style={fieldBox}
        />

        {/* Campi opzionali aggiuntivi (ATECO + indirizzo) */}
        <div style={{ height: 14 }} />
        <div style={fieldLabel}>Codici ATECO</div>
        <AtecoMultiSelect />

        <div style={{ height: 14 }} />
        <div style={fieldLabel}>Indirizzo</div>
        <input id="indirizzo" name="indirizzo" placeholder="Via Roma 1" style={fieldBox} />

        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={fieldLabel}>Città</div>
            <input
              id="citta"
              name="citta"
              placeholder="Milano"
              value={citta}
              onChange={(e) => onCittaChange(e.target.value)}
              style={fieldBox}
            />
          </div>
          <div style={{ width: 90 }}>
            <div style={fieldLabel}>Prov.</div>
            <input
              id="provincia"
              name="provincia"
              placeholder="MI"
              maxLength={2}
              value={provincia}
              onChange={(e) => onProvinciaChange(e.target.value)}
              style={{ ...fieldBox, textTransform: 'uppercase' }}
            />
          </div>
          <div style={{ width: 100 }}>
            <div style={fieldLabel}>CAP</div>
            <input
              id="cap"
              name="cap"
              placeholder="20100"
              maxLength={5}
              value={cap}
              onChange={(e) => onCapChange(e.target.value)}
              style={fieldBox}
            />
          </div>
        </div>

        <p style={{ fontSize: 12, color: 'var(--cc-muted)', margin: '14px 0 0' }}>
          <span style={{ color: '#c0392b' }}>*</span> Campo obbligatorio. Gli altri puoi
          aggiungerli ora o più avanti dalle Impostazioni.
        </p>

        <button type="submit" disabled={isPending} style={{ ...primaryBtn, opacity: isPending ? 0.7 : 1 }}>
          {isPending ? (
            <><Loader2 className="size-[18px] animate-spin" /> Salvataggio…</>
          ) : (
            <><ArrowRight className="size-[18px]" /> Continua</>
          )}
        </button>
      </div>
    </form>
  )
}

// ============================================================
// STEP 2 — LOGO UPLOAD (invariato — non nel mockup)
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
    <form action={formAction} className="space-y-5" style={{ margin: '16px 18px 0' }}>
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
// STEP 3 — COMPLETAMENTO (invariato — non nel mockup)
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
        colors: ['#1a1a2e', '#c9a44c', '#b08d3e', '#f3ede0'],
      })
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#1a1a2e', '#c9a44c', '#b08d3e', '#f3ede0'],
      })
      if (Date.now() < end) requestAnimationFrame(frame)
    }
    frame()
  }, [])

  return (
    <div className="text-center space-y-6 py-4" style={{ margin: '16px 18px 0' }}>
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
// ⚠️ DUE passi, non tre (Eli, 12 ago: «forse toglierei il logo»). Il logo non
// serve per fare un preventivo: si carica in Impostazioni quando si vuole, e
// come terzo schermo di una registrazione era un ostacolo prima del primo
// documento. Il componente `Step2` (caricamento logo) resta nel file, non più
// montato: se un giorno lo si rivuole, basta rimetterlo in fila.
const STEP_META = [
  { title: 'Configura la tua attività', subtitle: 'Servono per i tuoi preventivi e fatture.' },
  { title: 'Inizia!', subtitle: 'Crea il tuo primo preventivo' },
]

export default function OnboardingPage() {
  const [step, setStep] = useState(1)
  const router = useRouter()

  const meta = STEP_META[step - 1]!

  function handleComplete() {
    router.push('/preventivi/nuovo')
  }

  // Via d'uscita sempre presente (15 ago): senza, chi arriva qui senza poter
  // salvare (es. account in stato incoerente) resta intrappolato, come capitato
  // a Eli nel collaudo. «Esci» chiude la sessione e riporta al login.
  async function handleEsci() {
    try { await createClient().auth.signOut() } catch { /* best effort */ }
    router.push('/login')
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#fff' }}>
      <div className="w-full max-w-[420px] mx-auto">
        {/* Logo brand (icona CC navy + oro, come nelle pagine auth) */}
        <div style={{ paddingTop: 26, display: 'flex', justifyContent: 'center' }}>
          <svg viewBox="0 0 512 512" width={44} height={44} aria-label="Carta Canta" style={{ borderRadius: 11 }}>
            <rect width="512" height="512" rx="112" fill="#1a1a2e" />
            <path d="M342 133 A150 150 0 1 0 342 379" fill="none" stroke="#c9a44c" strokeWidth="38" strokeLinecap="round" />
            <path d="M307 175 A96 96 0 1 0 307 337" fill="none" stroke="#f3ede0" strokeWidth="30" strokeLinecap="round" />
          </svg>
        </div>

        {/* Header + progress */}
        <div style={{ padding: '14px 24px 4px' }}>
          <ProgressBar step={step} total={STEP_META.length} />
          <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--cc-muted)', marginBottom: 10 }}>
            Passo {step} di {STEP_META.length}
          </div>
          <div style={{ textAlign: 'center', fontSize: 20, fontWeight: 700, color: '#161616' }}>
            {meta.title}
          </div>
          <div style={{ textAlign: 'center', fontSize: 14, color: 'var(--cc-muted)', marginTop: 4 }}>
            {meta.subtitle}
          </div>
        </div>

        {/* Step content */}
        {step === 1 && <Step1 onSuccess={() => setStep(2)} />}
        {step === 2 && <Step3 onComplete={handleComplete} />}

        {/* Il «Salta per ora» del passo 1 è stato TOLTO (Eli, #0): la ragione
            sociale è obbligatoria (l'app rimanderebbe comunque qui), quindi qui
            non si salta. Al passo 2 («Tutto pronto!») resta «Vai alla dashboard»
            per chi vuole entrare subito. */}

        {/* Via d'uscita sempre presente: nessuno resta intrappolato qui. */}
        <div style={{ textAlign: 'center', padding: '18px 0 8px' }}>
          <button
            type="button"
            onClick={handleEsci}
            style={{ background: 'none', border: 'none', color: 'var(--cc-muted)', fontSize: 13, textDecoration: 'underline', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Esci e torna al login
          </button>
        </div>
      </div>
    </div>
  )
}
