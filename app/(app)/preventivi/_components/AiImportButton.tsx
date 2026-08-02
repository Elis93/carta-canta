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
  /** Vestito "mattonella" oro (pannello Opzioni, 2 ago): stesso stile del
   *  gemello "Dalle foto" — testo e foto sono due strade della stessa cosa. */
  tile?: boolean
}

// Stessa mattonella del bottone foto-AI in PreventivoForm: se cambi una,
// cambia anche l'altra (devono restare gemelle).
const TILE_STYLE: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
  width: '100%', border: '1px solid #e8d6ad', borderRadius: 11, background: '#fdf9ef',
  color: '#b0863e', fontSize: 13, fontWeight: 600, padding: '11px 8px',
  cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none', boxSizing: 'border-box',
}

export function AiImportButton({ isProPlan, onItemsExtracted, tile = false }: AiImportButtonProps) {
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
    if (tile) {
      return (
        <a href="/abbonamento" title="Disponibile nel piano Pro" style={{ ...TILE_STYLE, opacity: 0.75 }}>
          <Lock size={14} />
          Da un testo
          <span style={{ background: '#f5e9d0', color: '#b0863e', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 999 }}>PRO</span>
        </a>
      )
    }
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
      {tile ? (
        <button type="button" onClick={() => setOpen(true)} style={TILE_STYLE}>
          <Wand2 size={15} />
          Da un testo
        </button>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
        >
          <Wand2 className="size-4" />
          Importa con AI
        </Button>
      )}

      <AiImportModal
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={onItemsExtracted}
      />
    </>
  )
}
