'use client'

// ============================================================
// AddExpenseDialog — "Nuova spesa" del Bilancio (mockup ciclo incasso 1c)
// Importo · Categoria (preset + personalizzata) · Data · Descrizione (+ mic)
// ============================================================

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
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

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  color: '#8a887f',
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

export function AddExpenseDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [category, setCategory] = useState<string>('Materiali')
  const [description, setDescription] = useState('')

  const today = new Date().toLocaleDateString('sv-SE') // YYYY-MM-DD locale

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
                style={{ ...fieldStyle, paddingRight: 28 }}
                onKeyDown={(e) => {
                  if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault()
                }}
              />
              <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#8a887f', fontSize: 14 }}>€</span>
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

          <div>
            <label style={labelStyle} htmlFor="expense-date">Data</label>
            <input
              id="expense-date"
              name="date"
              type="date"
              defaultValue={today}
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
                className="flex-none text-[#8a887f]"
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
