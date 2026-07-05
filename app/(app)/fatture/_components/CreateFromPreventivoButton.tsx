'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, ArrowRight, Loader2, AlertTriangle, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { formatDocNumber } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog'

export interface PreventivoOption {
  id: string
  doc_number: string | null
  title: string | null
  total: number
  client_name: string | null
  status: string
}

const STATUS_LABEL: Record<string, { label: string; classes: string }> = {
  accepted: { label: 'Accettato', classes: 'bg-[#d4efe2] text-[#2b2b2b]' },
  sent:     { label: 'Inviato',   classes: 'bg-[#d8e8fb] text-[#2b2b2b]' },
  viewed:   { label: 'Visto',     classes: 'bg-[#fbe1ee] text-[#2b2b2b]' },
  draft:    { label: 'Bozza',     classes: 'bg-gray-100 text-gray-600' },
  rejected: { label: 'Rifiutato', classes: 'bg-[#f5dede] text-[#2b2b2b]' },
  expired:  { label: 'Scaduto',   classes: 'bg-[#f5e9d0] text-[#2b2b2b]' },
}

interface Props {
  preventivi: PreventivoOption[]
  /** Se true, il dialog si apre immediatamente al mount (es. da link diretto) */
  autoOpen?: boolean
}

export function CreateFromPreventivoButton({ preventivi, autoOpen = false }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(autoOpen)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  /** Preventivo selezionato che necessita di conferma (non ancora accettato) */
  const [pendingConfirm, setPendingConfirm] = useState<PreventivoOption | null>(null)

  async function doConvert(preventivoId: string, forceAccept = false) {
    setLoadingId(preventivoId)
    try {
      const res = await fetch(`/api/preventivi/${preventivoId}/converti-fattura`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceAccept }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        toast.error(data.error ?? 'Errore nella conversione')
        return
      }

      setOpen(false)
      setPendingConfirm(null)
      router.push(`/fatture/${data.fattura_id}`)
    } catch {
      toast.error('Errore di rete — riprova')
    } finally {
      setLoadingId(null)
    }
  }

  function handleSelect(p: PreventivoOption) {
    if (p.status !== 'accepted') {
      // Mostra schermata di conferma per preventivi non accettati
      setPendingConfirm(p)
      return
    }
    doConvert(p.id)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setPendingConfirm(null) }}>
      <DialogTrigger asChild>
        <Button variant="outline" type="button">
          <FileText className="size-4" />
          Importa da preventivo
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[480px]">
        {pendingConfirm ? (
          /* ── Schermata di conferma per preventivi non-accepted ── */
          <>
            <DialogHeader>
              <DialogTitle>Conferma conversione</DialogTitle>
              <DialogDescription>
                Questo preventivo non è ancora accettato.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg border border-[#e8d6ad] bg-[#f5e9d0] px-4 py-3 flex items-start gap-3 text-sm text-[#b0863e]">
              <AlertTriangle className="size-4 mt-0.5 shrink-0" />
              <p>
                Il preventivo{' '}
                <strong>
                  {pendingConfirm.doc_number
                    ? formatDocNumber(pendingConfirm.doc_number, 'preventivo')
                    : (pendingConfirm.title ?? '—')}
                </strong>{' '}
                è in stato <strong>{STATUS_LABEL[pendingConfirm.status]?.label ?? pendingConfirm.status}</strong>.
                Procedendo verrà automaticamente marcato come <strong>accettato</strong> e verrà creata la fattura.
              </p>
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPendingConfirm(null)}
                disabled={loadingId !== null}
              >
                <ArrowLeft className="size-3.5" />
                Indietro
              </Button>
              <Button
                size="sm"
                onClick={() => doConvert(pendingConfirm.id, true)}
                disabled={loadingId !== null}
              >
                {loadingId ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
                Procedi comunque
              </Button>
            </div>
          </>
        ) : (
          /* ── Lista preventivi ── */
          <>
            <DialogHeader>
              <DialogTitle>Scegli un preventivo</DialogTitle>
              <DialogDescription>
                La fattura verrà creata come bozza con le stesse voci e dati del preventivo.
              </DialogDescription>
            </DialogHeader>

            {preventivi.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Nessun preventivo disponibile.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {preventivi.map((p) => {
                  const label = p.doc_number ? formatDocNumber(p.doc_number, 'preventivo') : (p.title ?? '—')
                  const isLoading = loadingId === p.id
                  const statusInfo = STATUS_LABEL[p.status]
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelect(p)}
                      disabled={loadingId !== null}
                      className="w-full text-left rounded-lg border px-4 py-3 hover:bg-muted/50 transition-colors disabled:opacity-50 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm truncate">{label}</p>
                          {statusInfo && (
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${statusInfo.classes}`}>
                              {statusInfo.label}
                            </span>
                          )}
                        </div>
                        {p.client_name && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{p.client_name}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-mono text-muted-foreground">
                          {new Intl.NumberFormat('it-IT', {
                            style: 'currency',
                            currency: 'EUR',
                            minimumFractionDigits: 2,
                          }).format(p.total)}
                        </span>
                        {isLoading
                          ? <Loader2 className="size-4 animate-spin" />
                          : <ArrowRight className="size-4 text-muted-foreground" />
                        }
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
