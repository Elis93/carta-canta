'use client'

import { useState, useEffect, useTransition } from 'react'
import { BookOpen, Search, Plus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database'

type CatalogItem = Database['public']['Tables']['catalog_items']['Row']

interface CatalogPickerProps {
  onSelect: (item: {
    description: string
    unit: string
    unit_price: number
    vat_rate: number | null
  }) => void
}

export function CatalogPicker({ onSelect }: CatalogPickerProps) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  // Carica catalogo la prima volta che si apre il dialog
  useEffect(() => {
    if (!open || items.length > 0) return
    setLoading(true)
    const supabase = createClient()
    supabase
      .from('catalog_items')
      .select('*')
      .eq('is_active', true)
      .order('category', { nullsFirst: false })
      .order('name')
      .then(({ data }) => {
        setItems(data ?? [])
        setLoading(false)
      })
  }, [open, items.length])

  const filtered = search.trim()
    ? items.filter((it) =>
        it.name.toLowerCase().includes(search.toLowerCase()) ||
        (it.description ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (it.category ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : items

  // Raggruppa per categoria
  const grouped = filtered.reduce<Record<string, CatalogItem[]>>((acc, item) => {
    const key = item.category ?? '—'
    if (!acc[key]) acc[key] = []
    acc[key]!.push(item)
    return acc
  }, {})

  const categories = Object.keys(grouped).sort((a, b) =>
    a === '—' ? 1 : b === '—' ? -1 : a.localeCompare(b, 'it')
  )

  function handleSelect(item: CatalogItem) {
    onSelect({
      description: item.description ?? item.name,
      unit: item.unit,
      unit_price: Number(item.unit_price),
      vat_rate: item.vat_rate != null ? Number(item.vat_rate) : null,
    })
    setOpen(false)
    setSearch('')
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSearch('') }}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="gap-1.5">
          <BookOpen className="size-3.5" />
          Dal catalogo
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-lg p-0 gap-0">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="text-base">Seleziona dal catalogo</DialogTitle>
        </DialogHeader>

        {/* Ricerca */}
        <div className="px-4 pb-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Cerca voce…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
              autoFocus
            />
          </div>
        </div>

        {/* Lista */}
        <div className="overflow-y-auto max-h-96 border-t">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              {search ? `Nessun risultato per "${search}"` : 'Catalogo vuoto. Aggiungilo da /catalogo.'}
            </div>
          ) : (
            categories.map((cat) => (
              <div key={cat}>
                {/* Header categoria */}
                <div className="px-4 py-1.5 bg-muted/50 border-b sticky top-0">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {cat === '—' ? 'Senza categoria' : cat}
                  </span>
                </div>
                {/* Voci */}
                {(grouped[cat] ?? []).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelect(item)}
                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/40 transition-colors text-left border-b last:border-0 group"
                  >
                    <div className="min-w-0 flex-1 pr-4">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      {item.description && item.description !== item.name && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{item.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
                      <span>{item.unit}</span>
                      <span className="font-semibold text-foreground tabular-nums">
                        €{Number(item.unit_price).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                      </span>
                      <Plus className="size-3.5 opacity-0 group-hover:opacity-100 text-primary transition-opacity" />
                    </div>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>

        <div className="px-4 py-2 border-t bg-muted/20">
          <p className="text-xs text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? 'voce' : 'voci'} ·{' '}
            <a href="/catalogo" target="_blank" className="underline underline-offset-2 hover:text-foreground">
              Gestisci catalogo
            </a>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
