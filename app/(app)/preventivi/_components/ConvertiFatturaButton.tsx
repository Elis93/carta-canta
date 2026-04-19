'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileCheck2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

interface ConvertiFatturaButtonProps {
  documentId: string
}

export function ConvertiFatturaButton({ documentId }: ConvertiFatturaButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleConvert() {
    if (!confirm('Creare una bozza di fattura da questo preventivo accettato?')) return
    setLoading(true)

    try {
      const res = await fetch(`/api/preventivi/${documentId}/converti-fattura`, {
        method: 'POST',
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        toast.error(data.error ?? 'Errore nella conversione')
        return
      }

      toast.success('Fattura creata come bozza!')
      router.push(`/fatture/${data.fattura_id}`)
    } catch {
      toast.error('Errore di rete — riprova')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleConvert} disabled={loading}>
      {loading
        ? <Loader2 className="size-4 animate-spin" />
        : <FileCheck2 className="size-4" />}
      Converti in fattura
    </Button>
  )
}
