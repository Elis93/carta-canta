'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileCheck2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface ConvertiFatturaButtonProps {
  documentId: string
  /** Bottone a piena larghezza e prominente (mobile) — etichetta sempre visibile */
  fullWidth?: boolean
}

export function ConvertiFatturaButton({ documentId, fullWidth }: ConvertiFatturaButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleConvert() {
    setLoading(true)

    try {
      const res = await fetch(`/api/preventivi/${documentId}/converti-fattura`, {
        method: 'POST',
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        toast.error(data.error ?? 'Errore nella conversione')
        setOpen(false)
        return
      }

      toast.success('Fattura creata come bozza!')
      setOpen(false)
      router.push(`/fatture/${data.fattura_id}`)
    } catch {
      toast.error('Errore di rete — riprova')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {fullWidth ? (
          <Button
            variant="default"
            className="w-full"
            style={{ height: 48, boxShadow: '0 6px 16px -6px rgba(26,26,46,.5)' }}
          >
            <FileCheck2 className="size-4" />
            Crea fattura
          </Button>
        ) : (
          <Button variant="default" size="sm">
            <FileCheck2 className="size-4" />
            Crea fattura
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Converti in fattura?</DialogTitle>
          <DialogDescription>
            Verrà creata una bozza di fattura a partire da questo preventivo accettato.
            Il preventivo rimarrà invariato.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            Annulla
          </Button>
          <Button onClick={handleConvert} disabled={loading}>
            {loading ? (
              <><Loader2 className="size-4 animate-spin" /> Conversione…</>
            ) : (
              <><FileCheck2 className="size-4" /> Crea fattura</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
