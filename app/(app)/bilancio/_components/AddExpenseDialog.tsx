'use client'

// ============================================================
// AddExpenseDialog — "Nuova spesa" del Bilancio (mockup ciclo incasso 1c)
// Importo · Categoria (preset + personalizzata) · Data · Descrizione (+ mic)
// ============================================================

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Camera, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { VoiceInput } from '@/components/shared/VoiceInput'
import { createExpenseAction } from '@/lib/actions/expenses'
import { EXPENSE_CATEGORIES } from '@/lib/constants/expense-categories'

const CUSTOM_VALUE = '__custom__'
const AI_IMPORT_ENABLED = process.env.NEXT_PUBLIC_AI_IMPORT_ENABLED === 'true'
const PRESET_CATEGORIES = new Set<string>(EXPENSE_CATEGORIES)

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  color: 'var(--cc-muted)',
  marginBottom: 6,
}

const fieldStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid #e3e3e6',
  borderRadius: 10,
  padding: '0 12px',
  height: 44,
  boxSizing: 'border-box',
  fontSize: 14,
  fontFamily: 'inherit',
  color: '#161616',
  background: '#fff',
}

export interface LavoroOption { id: string; title: string }

export function AddExpenseDialog({ lavori = [], defaultLavoroId }: { lavori?: LavoroOption[]; defaultLavoroId?: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [category, setCategory] = useState<string>('Materiali')
  const [description, setDescription] = useState('')
  const [lavoroId, setLavoroId] = useState<string>(defaultLavoroId ?? '')

  const today = new Date().toLocaleDateString('sv-SE') // YYYY-MM-DD locale
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(today)

  // ── Foto scontrino (AI) ──────────────────────────────────────────────────
  const [scanning, setScanning] = useState(false)
  const scanInputRef = useRef<HTMLInputElement>(null)

  async function handleReceiptFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (e.currentTarget) e.currentTarget.value = '' // consente di riscattare la stessa foto
    if (!file) return
    setScanning(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/ai/scan-receipt', { method: 'POST', body: fd })
      const data = await res.json() as {
        amount?: number; date?: string | null; category?: string | null
        vendor?: string | null; description?: string | null; error?: string
      }
      if (!res.ok) {
        setError(data.error ?? 'Non sono riuscito a leggere lo scontrino. Inserisci a mano.')
        return
      }
      if (data.amount && data.amount > 0) {
        setAmount(data.amount.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
      }
      if (data.date && /^\d{4}-\d{2}-\d{2}$/.test(data.date)) setDate(data.date)
      if (data.category && PRESET_CATEGORIES.has(data.category)) setCategory(data.category)
      else if (data.category) setCategory('Altro')
      const desc = data.description || data.vendor
      if (desc) setDescription(desc)
      toast.success('Scontrino letto', { description: 'Controlla i dati e salva.', duration: 8_000, closeButton: true })
    } catch {
      setError('Errore di rete durante la lettura. Riprova o inserisci a mano.')
    } finally {
      setScanning(false)
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await createExpenseAction(formData)
      if (result?.error) {
        setError(result.error)
        return
      }
      toast.success('Spesa salvata', { description: 'La trovi nel Bilancio del mese.', duration: 10_000, closeButton: true })
      setOpen(false)
      setDescription('')
      setAmount('')
      setDate(today)
      setCategory('Materiali')
      setLavoroId(defaultLavoroId ?? '')
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setError(null) }}>
      <DialogTrigger asChild>
        <button
          type="button"
          style={{
            width: '100%',
            height: 48,
            border: 'none',
            borderRadius: 12,
            background: '#1a1a2e',
            color: '#fff',
            fontSize: 14,
            fontWeight: 600,
            boxShadow: '0 6px 16px -6px rgba(26,26,46,.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <Plus size={18} /> Aggiungi spesa
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle style={{ fontSize: 17, fontWeight: 600, color: '#161616' }}>
            Nuova spesa
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {AI_IMPORT_ENABLED && (
            <div>
              <button
                type="button"
                onClick={() => scanInputRef.current?.click()}
                disabled={scanning}
                style={{
                  width: '100%', height: 44, borderRadius: 10,
                  border: '1px solid #e6d3a4', background: '#fdf9ef', color: '#8a6d1f',
                  fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', gap: 8, cursor: scanning ? 'default' : 'pointer',
                  fontFamily: 'inherit', opacity: scanning ? 0.7 : 1,
                }}
              >
                {scanning
                  ? <><Loader2 size={16} className="animate-spin" /> Lettura in corso…</>
                  : <><Camera size={16} /> Scatta foto allo scontrino</>}
              </button>
              <input
                ref={scanInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleReceiptFile}
              />
              <p style={{ fontSize: 11, color: 'var(--cc-muted)', marginTop: 6, lineHeight: 1.4 }}>
                L&rsquo;AI compila importo, data e categoria. Controlla sempre prima di salvare.
              </p>
            </div>
          )}

          <div>
            <label style={labelStyle} htmlFor="expense-amount">
              Importo <span style={{ color: '#b08d3e' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="expense-amount"
                name="amount"
                inputMode="decimal"
                placeholder="0,00"
                required
                autoComplete="off"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                style={{ ...fieldStyle, paddingRight: 28 }}
                onKeyDown={(e) => {
                  if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault()
                }}
              />
              <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--cc-muted)', fontSize: 14 }}>€</span>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Categoria</label>
            <Select value={category} onValueChange={setCategory} name="category">
              <SelectTrigger className="w-full" style={{ border: '1px solid #e3e3e6', borderRadius: 10, padding: '0 12px', height: 44, boxSizing: 'border-box', fontSize: 14 }}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPENSE_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
                <SelectItem value={CUSTOM_VALUE}>Altra categoria…</SelectItem>
              </SelectContent>
            </Select>
            {category === CUSTOM_VALUE && (
              <input
                name="category_custom"
                placeholder="Nome categoria (es. Assicurazione)"
                maxLength={40}
                autoComplete="off"
                style={{ ...fieldStyle, marginTop: 8 }}
              />
            )}
          </div>

          {lavori.length > 0 && (
            <div>
              <label style={labelStyle} htmlFor="expense-lavoro">Lavoro collegato <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>(facoltativo)</span></label>
              <select
                id="expense-lavoro"
                name="lavoro_id"
                value={lavoroId}
                onChange={(e) => setLavoroId(e.target.value)}
                style={{ ...fieldStyle, appearance: 'auto' }}
              >
                <option value="">Nessuno</option>
                {lavori.map((l) => (
                  <option key={l.id} value={l.id}>{l.title}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label style={labelStyle} htmlFor="expense-date">Data</label>
            <input
              id="expense-date"
              name="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={fieldStyle}
            />
          </div>

          <div>
            <label style={labelStyle} htmlFor="expense-description">
              Descrizione <span style={{ color: '#b08d3e' }}>*</span>
            </label>
            <div style={{ ...fieldStyle, display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px' }}>
              <input
                id="expense-description"
                name="description"
                placeholder="Es. Piastrelle cantiere Rossi"
                required
                autoComplete="off"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, fontFamily: 'inherit', color: '#161616', background: 'transparent', padding: 0 }}
              />
              <VoiceInput
                compact
                className="flex-none text-[var(--cc-muted)]"
                onTranscript={(text) => setDescription((prev) => (prev ? `${prev} ${text}` : text))}
              />
            </div>
          </div>

          {error && (
            <p style={{ fontSize: 13, color: '#dc2626', fontWeight: 500 }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={pending}
            style={{
              width: '100%',
              height: 48,
              border: 'none',
              borderRadius: 12,
              background: '#1a1a2e',
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              boxShadow: '0 6px 16px -6px rgba(26,26,46,.5)',
              opacity: pending ? 0.6 : 1,
              cursor: pending ? 'default' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {pending ? 'Salvataggio…' : 'Salva spesa'}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
