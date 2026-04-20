'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { SlidersHorizontal, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function AdvancedFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [open, setOpen] = useState(false)
  const [dateFrom,   setDateFrom]   = useState(searchParams.get('date_from')   ?? '')
  const [dateTo,     setDateTo]     = useState(searchParams.get('date_to')     ?? '')
  const [amountMin,  setAmountMin]  = useState(searchParams.get('amount_min')  ?? '')
  const [amountMax,  setAmountMax]  = useState(searchParams.get('amount_max')  ?? '')

  const activeCount = [
    searchParams.get('date_from'),
    searchParams.get('date_to'),
    searchParams.get('amount_min'),
    searchParams.get('amount_max'),
  ].filter(Boolean).length

  function apply() {
    const params = new URLSearchParams(searchParams.toString())
    dateFrom  ? params.set('date_from',  dateFrom)  : params.delete('date_from')
    dateTo    ? params.set('date_to',    dateTo)    : params.delete('date_to')
    amountMin ? params.set('amount_min', amountMin) : params.delete('amount_min')
    amountMax ? params.set('amount_max', amountMax) : params.delete('amount_max')
    router.push(`/preventivi?${params.toString()}`)
    setOpen(false)
  }

  function reset() {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('date_from')
    params.delete('date_to')
    params.delete('amount_min')
    params.delete('amount_max')
    setDateFrom(''); setDateTo(''); setAmountMin(''); setAmountMax('')
    router.push(`/preventivi?${params.toString()}`)
    setOpen(false)
  }

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        className="gap-1.5 shrink-0"
      >
        <SlidersHorizontal className="size-3.5" />
        <span className="hidden sm:inline">Filtri</span>
        {activeCount > 0 && (
          <span className="size-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-semibold">
            {activeCount}
          </span>
        )}
      </Button>

      {open && (
        <>
          {/* Overlay trasparente per chiudere cliccando fuori */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />

          <div className="absolute left-0 sm:left-auto sm:right-0 top-full mt-2 z-20 w-72 rounded-lg border bg-card shadow-lg p-4 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Filtri avanzati</p>
              <button
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Chiudi filtri"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Data creazione */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Data creazione
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Dal</Label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Al</Label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Importo */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Importo (€)
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Min</Label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    value={amountMin}
                    onChange={(e) => setAmountMin(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Max</Label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="∞"
                    value={amountMax}
                    onChange={(e) => setAmountMax(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Azioni */}
            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="sm" className="flex-1" onClick={reset}>
                Azzera
              </Button>
              <Button size="sm" className="flex-1" onClick={apply}>
                Applica
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
