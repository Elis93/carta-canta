// ============================================================
// OnOffPill — toggle ON/OFF stile "pill" (FIX-5)
// Stesso design del toggle Mensile/Annuale nella pagina abbonamento:
// contenitore grigio arrotondato, opzione attiva = sfondo bianco + shadow,
// opzione inattiva = testo grigio, transizione fluida.
// ============================================================

import { cn } from '@/lib/utils'

interface OnOffPillProps {
  checked: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
  className?: string
}

export function OnOffPill({ checked, onChange, disabled, className }: OnOffPillProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-full border bg-muted p-1',
        disabled && 'opacity-50 pointer-events-none',
        className
      )}
    >
      {/* Opzione ON */}
      <button
        type="button"
        onClick={() => !checked && onChange(true)}
        disabled={disabled}
        className={cn(
          'px-3 py-1 rounded-full text-xs font-medium transition-colors',
          checked
            ? 'bg-white text-foreground shadow-sm cursor-default'
            : 'text-muted-foreground hover:text-foreground cursor-pointer'
        )}
      >
        ON
      </button>

      {/* Opzione OFF */}
      <button
        type="button"
        onClick={() => checked && onChange(false)}
        disabled={disabled}
        className={cn(
          'px-3 py-1 rounded-full text-xs font-medium transition-colors',
          !checked
            ? 'bg-white text-foreground shadow-sm cursor-default'
            : 'text-muted-foreground hover:text-foreground cursor-pointer'
        )}
      >
        OFF
      </button>
    </div>
  )
}
