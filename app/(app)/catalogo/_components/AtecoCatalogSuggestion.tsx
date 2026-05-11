'use client'

import { useTransition, useState } from 'react'
import { Sparkles, Loader2, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { importAtecoCatalogAction } from '../actions'
import type { AtecoPreset } from '@/lib/catalog/ateco-presets'

interface AtecoCatalogSuggestionProps {
  presets: AtecoPreset[]
}

export function AtecoCatalogSuggestion({ presets }: AtecoCatalogSuggestionProps) {
  const [pending, startTransition] = useTransition()
  const [done, setDone] = useState(false)
  const [count, setCount] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  if (done) {
    return (
      <div className="rounded-xl border bg-muted/20 px-5 py-4 flex items-start gap-3">
        <CheckCircle2 className="size-5 text-green-600 shrink-0 mt-0.5" />
        <p className="text-sm text-muted-foreground">
          {count} voci importate nel catalogo. Puoi modificarle o aggiungerne di nuove.
        </p>
      </div>
    )
  }

  const allItems = presets.flatMap((p) => p.items)
  const previewItems = allItems.slice(0, 5)
  const hiddenCount = allItems.length - 5

  function handleImport() {
    setError(null)
    startTransition(async () => {
      const result = await importAtecoCatalogAction()
      if (result.error) {
        setError(result.error)
      } else {
        setCount(result.count ?? allItems.length)
        setDone(true)
      }
    })
  }

  return (
    <div className="rounded-xl border bg-muted/10 overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-4 pb-3 flex items-start gap-3">
        <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
          <Sparkles className="size-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">
            Parti con un catalogo pronto per la tua attività
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Abbiamo {allItems.length} voci suggerite per{' '}
            {presets.map((p) => p.label.toLowerCase()).join(' e ')}.
            Importale con un click e personalizzale come vuoi.
          </p>
        </div>
      </div>

      {/* Anteprima voci */}
      <div className="border-t mx-0">
        <div className="px-5 py-2 bg-muted/30">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Esempio voci incluse
          </p>
        </div>
        <div className="divide-y">
          {previewItems.map((item, i) => (
            <div key={i} className="px-5 py-2 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm truncate">{item.name}</p>
                <p className="text-xs text-muted-foreground">{item.category} · {item.unit}</p>
              </div>
              <span className="text-sm font-medium tabular-nums shrink-0">
                €{item.unit_price.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
              </span>
            </div>
          ))}

          {hiddenCount > 0 && (
            <>
              {expanded && allItems.slice(5).map((item, i) => (
                <div key={`more-${i}`} className="px-5 py-2 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.category} · {item.unit}</p>
                  </div>
                  <span className="text-sm font-medium tabular-nums shrink-0">
                    €{item.unit_price.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="w-full px-5 py-2 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {expanded
                  ? <><ChevronUp className="size-3.5" /> Mostra meno</>
                  : <><ChevronDown className="size-3.5" /> +{hiddenCount} altre voci</>
                }
              </button>
            </>
          )}
        </div>
      </div>

      {/* Footer CTA */}
      <div className="px-5 py-3 border-t bg-background flex items-center justify-between gap-4">
        {error && <p className="text-xs text-destructive flex-1">{error}</p>}
        {!error && (
          <p className="text-xs text-muted-foreground flex-1">
            Prezzi indicativi — modificabili dopo l'importazione.
          </p>
        )}
        <Button size="sm" onClick={handleImport} disabled={pending}>
          {pending ? (
            <><Loader2 className="size-4 animate-spin" /> Importazione…</>
          ) : (
            <><Sparkles className="size-4" /> Importa {allItems.length} voci</>
          )}
        </Button>
      </div>
    </div>
  )
}
