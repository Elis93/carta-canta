'use client'

// ============================================================
// AccontoCard — dettaglio preventivo accettato con acconto richiesto
// (mockup ciclo incasso 3c): acconto richiesto/saldo + "Acconto ricevuto".
// Alla registrazione l'app suggerisce la fattura d'acconto (obbligo
// fiscale all'incasso — nota in DECISIONI_E_FEEDBACK.md).
// ============================================================

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { registerDepositReceivedAction } from '@/lib/actions/documents'
import { parseImportoIt } from '@/lib/utils'

const SH = '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)'

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

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  color: 'var(--cc-muted)',
  marginBottom: 6,
}

function fmtEuro(v: number): string {
  return `€ ${v.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}


export function AccontoCard({
  documentId,
  acconto,
  saldo,
  received,
}: {
  documentId: string
  acconto: number
  saldo: number
  /** Acconto già registrato: importo + data ISO (payment_status 'partial') */
  received: { amount: number; at: string | null } | null
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [amount, setAmount] = useState(
    acconto.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  )
  const [date, setDate] = useState(new Date().toLocaleDateString('sv-SE'))
  const [error, setError] = useState<string | null>(null)

  function handleConfirm() {
    setError(null)
    const parsed = parseImportoIt(amount)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('Inserisci un importo valido (es. 549,00).')
      return
    }
    startTransition(async () => {
      const result = await registerDepositReceivedAction(documentId, parsed, date || undefined)
      if (result?.error) {
        setError(result.error)
        return
      }
      toast.success('Acconto registrato', {
        description: 'L’incasso entra nelle Entrate del Bilancio. Ricorda: all’incasso di un acconto va emessa la fattura d’acconto.',
        closeButton: true,
      })
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <div style={{ background: '#fff', borderRadius: 14, boxShadow: SH, padding: '13px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#161616' }}>
            {received
              ? `Acconto ${fmtEuro(received.amount)} ricevuto${received.at ? ` il ${new Date(received.at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }).replace('.', '')}` : ''}`
              : `Acconto richiesto: ${fmtEuro(acconto)}`}
          </div>
          <div style={{ fontSize: 12, color: 'var(--cc-muted)', marginTop: 2 }}>
            Saldo restante: {fmtEuro(received ? Math.max(0, acconto + saldo - received.amount) : saldo)}
          </div>
        </div>
        {received ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#d4efe2', color: '#2b2b2b', borderRadius: 999, padding: '3px 11px', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
            <CheckCircle2 size={13} style={{ color: '#2f8a63' }} /> Acconto
          </span>
        ) : (
          <span style={{ background: '#f5e9d0', color: '#2b2b2b', borderRadius: 999, padding: '3px 11px', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
            In attesa
          </span>
        )}
      </div>

      {!received && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            width: '100%', marginTop: 11, height: 44, border: 'none', borderRadius: 12,
            background: '#1a1a2e', color: '#fff', fontSize: 13, fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            boxShadow: '0 6px 16px -6px rgba(26,26,46,.5)', cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          <CheckCircle2 size={16} /> Acconto ricevuto
        </button>
      )}

      {received && (
        <p style={{ fontSize: 12, color: '#767676', lineHeight: 1.5, marginTop: 9 }}>
          All&rsquo;incasso di un acconto va emessa la <b>fattura d&rsquo;acconto</b>: puoi crearla
          con &ldquo;Converti in fattura&rdquo; indicando l&rsquo;importo dell&rsquo;acconto.
        </p>
      )}

      <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setError(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle style={{ fontSize: 17, fontWeight: 600 }}>Acconto ricevuto</DialogTitle>
            <DialogDescription style={{ fontSize: 13 }}>
              Registra l&rsquo;incasso dell&rsquo;acconto: entra nel Bilancio del mese.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label style={labelStyle} htmlFor="deposit-amount">Importo ricevuto</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="deposit-amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  autoComplete="off"
                  style={{ ...fieldStyle, paddingRight: 28 }}
                  onKeyDown={(e) => { if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault() }}
                />
                <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--cc-muted)', fontSize: 14 }}>€</span>
              </div>
            </div>
            <div>
              <label style={labelStyle} htmlFor="deposit-date">Data incasso</label>
              <input id="deposit-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} style={fieldStyle} />
            </div>
            {error && <p style={{ fontSize: 13, color: '#dc2626', fontWeight: 500 }}>{error}</p>}
            <button
              type="button"
              onClick={handleConfirm}
              disabled={pending}
              style={{
                width: '100%', height: 48, border: 'none', borderRadius: 12,
                background: '#1a1a2e', color: '#fff', fontSize: 14, fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: '0 6px 16px -6px rgba(26,26,46,.5)',
                opacity: pending ? 0.6 : 1, cursor: pending ? 'wait' : 'pointer', fontFamily: 'inherit',
              }}
            >
              {pending ? <Loader2 size={18} className="animate-spin" /> : null}
              Conferma
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
