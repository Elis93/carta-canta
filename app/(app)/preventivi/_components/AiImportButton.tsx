'use client'

import { useState } from 'react'
import { Wand2, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AiImportModal } from './AiImportModal'
import type { ExtractedItem } from '@/lib/ai/types'

// Feature flag: l'AI Import richiede le chiavi OpenAI/Mistral configurate in
// produzione. Finché non sono attive, mostriamo il bottone come "In arrivo"
// invece di farlo fallire con "AI non disponibile".
// Abilitare quando le env key sono configurate su Vercel.
const AI_IMPORT_ENABLED = process.env.NEXT_PUBLIC_AI_IMPORT_ENABLED === 'true'

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

  // Feature non ancora attiva in produzione → pillola discreta
  if (!AI_IMPORT_ENABLED) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--cc-text-3)', opacity: 0.75 }}>
        <Wand2 style={{ width: 11, height: 11, flexShrink: 0 }} />
        Importa con AI · in arrivo
      </span>
    )
  }

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
          <span className="ml-1 rounded-full bg-[#f5e9d0] text-[#b0863e] text-[10px] font-semibold px-1.5 py-0.5">
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
