'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, ArrowRight, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
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
}

interface Props {
  preventivi: PreventivoOption[]
}

export function CreateFromPreventivoButton({ preventivi }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  async function handleSelect(preventivoId: string) {
    setLoadingId(preventivoId)
    try {
      const res = await fetch(`/api/preventivi/${preventivoId}/converti-fattura`, {
        method: 'POST',
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        toast.error(data.error ?? 'Errore nella conversione')
        return
      }

      setOpen(false)
      router.push(`/fatture/${data.fattura_id}`)
    } catch {
      toast.error('Errore di rete — riprova')
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" type="button">
          <FileText className="size-4" />
          Crea da preventivo
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Scegli un preventivo accettato</DialogTitle>
          <DialogDescription>
            La fattura verrà creata come bozza con le stesse voci e dati del preventivo.
          </DialogDescription>
        </DialogHeader>

        {preventivi.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Nessun preventivo accettato disponibile.
          </p>
        ) : (
          <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
            {preventivi.map((p) => {
              const label = p.doc_number ? `#${p.doc_number}` : (p.title ?? '—')
              const isLoading = loadingId === p.id
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelect(p.id)}
                  disabled={loadingId !== null}
                  className="w-full text-left rounded-lg border px-4 py-3 hover:bg-muted/50 transition-colors disabled:opacity-50 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{label}</p>
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
      </DialogContent>
    </Dialog>
  )
}
