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
  /** Veste del bottone (pagina A: navy pieno, l'unico della pagina). */
  triggerStyle?: React.CSSProperties
  /** Bottone a piena larghezza e prominente (mobile) — etichetta sempre visibile */
  fullWidth?: boolean
}

export function ConvertiFatturaButton({ documentId, fullWidth, triggerStyle }: ConvertiFatturaButtonProps) {
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
          // NAVY dell'app, non il nero shadcn (inventario 26 ago): è «il
          // passo successivo», nello stesso posto di «Segna pagata» sulla
          // fattura (mockup A).
          <button
            type="button"
            style={{
              boxSizing: 'border-box', width: '100%', height: 46, borderRadius: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              fontSize: 14, fontWeight: 600, border: '1px solid #1a1a2e',
              background: '#1a1a2e', color: '#fff', cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: '0 6px 16px -6px rgba(26,26,46,.5)',
              ...triggerStyle,
            }}
          >
            <FileCheck2 size={18} />
            Converti in fattura
          </button>
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
