'use client'

// ============================================================
// SegnaPagataButton — dialog "Segna come pagata" (Pagamenti F1,
// mockup ciclo incasso 2c): importo ricevuto + data incasso.
// Un importo più basso del totale = acconto (payment_status 'partial',
// lo stato della fattura non cambia). L'incasso entra nel Bilancio.
// ============================================================

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Banknote } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { parseImportoIt } from '@/lib/utils'

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


export function SegnaPagataButton({ documentId, total }: { documentId: string; total?: number | null }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [amount, setAmount] = useState(
    (total ?? 0) > 0
      ? (total as number).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : ''
  )
  const [date, setDate] = useState(new Date().toLocaleDateString('sv-SE'))
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm() {
    setError(null)
    const parsed = parseImportoIt(amount)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('Inserisci un importo valido (es. 1.830,00).')
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/fatture/${documentId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'accepted', paid_amount: parsed, paid_date: date || undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Impossibile aggiornare lo stato. Riprova.')
        return
      }
      if (data.partial) {
        toast.success('Acconto registrato', {
          description: 'La fattura resta da incassare per il saldo. L’incasso entra nel Bilancio.',
          duration: 10_000,
          closeButton: true,
        })
      } else {
        toast.success('Fattura segnata come pagata', {
          description: 'L’incasso entra nelle Entrate del Bilancio.',
          duration: 10_000,
          closeButton: true,
        })
      }
      setOpen(false)
      router.refresh()
    } catch {
      setError('Errore di rete. Controlla la connessione e riprova.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          boxSizing: 'border-box', flex: 1, minWidth: 0, height: 48, borderRadius: 13,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          fontSize: 14, fontWeight: 600, border: 'none',
          background: '#1a1a2e', color: '#fff', cursor: 'pointer',
          boxShadow: '0 6px 16px -6px rgba(26,26,46,.5)', whiteSpace: 'nowrap',
        }}
      >
        <Banknote size={18} />
        Segna pagata
      </button>

      <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setError(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle style={{ fontSize: 17, fontWeight: 600 }}>Segna come pagata</DialogTitle>
            <DialogDescription style={{ fontSize: 13 }}>
              Registra l&rsquo;incasso: finirà anche nel Bilancio del mese.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label style={labelStyle} htmlFor="paid-amount">Importo ricevuto</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="paid-amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  autoComplete="off"
                  style={{ ...fieldStyle, paddingRight: 28 }}
                  onKeyDown={(e) => { if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault() }}
                />
                <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#8a887f', fontSize: 14 }}>€</span>
              </div>
              <p style={{ fontSize: 12, color: '#767676', lineHeight: 1.5, marginTop: 6 }}>
                Un importo più basso del totale viene registrato come <b>acconto</b>: la fattura resta da incassare per il saldo.
              </p>
            </div>

            <div>
              <label style={labelStyle} htmlFor="paid-date">Data incasso</label>
              <input
                id="paid-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={fieldStyle}
              />
            </div>

            {error && <p style={{ fontSize: 13, color: '#dc2626', fontWeight: 500 }}>{error}</p>}

            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading}
              style={{
                width: '100%', height: 48, border: 'none', borderRadius: 12,
                background: '#1a1a2e', color: '#fff', fontSize: 14, fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: '0 6px 16px -6px rgba(26,26,46,.5)',
                opacity: loading ? 0.6 : 1, cursor: loading ? 'wait' : 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : null}
              Conferma
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
