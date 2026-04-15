'use client'

import { useState } from 'react'
import { Wand2, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AiImportModal } from './AiImportModal'
import type { ExtractedItem } from '@/lib/ai/types'

interface AiImportButtonProps {
  isProPlan: boolean
  /** Callback quando l'utente conferma le voci estratte dall'AI */
  onItemsExtracted: (
    items: ExtractedItem[],
    suggestedTitle?: string,
    suggestedNotes?: string
  ) => void
}

export function AiImportButton({ isProPlan, onItemsExtracted }: AiImportButtonProps) {
  const [open, setOpen] = useState(false)

  if (!isProPlan) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        asChild
        title="Disponibile nel piano Pro"
      >
        <a href="/abbonamento" className="flex items-center gap-2">
          <Lock className="size-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">Importa con AI</span>
          <span className="ml-1 rounded-full bg-amber-100 text-amber-700 text-[10px] font-semibold px-1.5 py-0.5">
            PRO
          </span>
        </a>
      </Button>
    )
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <Wand2 className="size-4" />
        Importa con AI
      </Button>

      <AiImportModal
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={onItemsExtracted}
      />
    </>
  )
}
