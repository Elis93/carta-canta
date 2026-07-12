'use client'

import { useState, useEffect, useTransition } from 'react'
import { BookOpen, Search, Plus, Loader2, Sparkles, CheckCircle2, ArrowLeft, PackagePlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database'
import { getAtecoPreset } from '@/lib/catalog/ateco-presets'
import { importAtecoCatalogAction, createCatalogItemAction } from '@/app/(app)/catalogo/actions'
import { parseImportoIt } from '@/lib/utils'

type CatalogItem = Database['public']['Tables']['catalog_items']['Row']

const UNITS = ['pz', 'ore', 'mq', 'ml', 'kg', 'gg', 'mc', 'lt']
const VAT_RATES = [22, 10, 5, 4, 0]

interface CatalogPickerProps {
  onSelect: (item: {
    description: string
    unit: string
    unit_price: number
    vat_rate: number | null
  }) => void
}

export function CatalogPicker({ onSelect }: CatalogPickerProps) {
  const [open, setOpen]       = useState(false)
  const [view, setView]       = useState<'list' | 'create'>('list')
  const [items, setItems]     = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch]   = useState('')
  const [atecoCodes, setAtecoCodes] = useState<string[]>([])
  const [importPending, startImportTransition] = useTransition()
  const [importDone, setImportDone] = useState(false)

  // ── Stato form creazione rapida ────────────────────────────
  const [createName,     setCreateName]     = useState('')
  const [createUnit,     setCreateUnit]     = useState('pz')
  const [createPrice,    setCreatePrice]    = useState('')
  const [createVat,      setCreateVat]      = useState('22')
  const [createCategory, setCreateCategory] = useState('')
  const [createPending,  startCreateTransition] = useTransition()
  const [createError,    setCreateError]    = useState<string | null>(null)

  // Carica catalogo la prima volta che si apre il dialog
  useEffect(() => {
    if (!open || items.length > 0) return
    setLoading(true)
    const supabase = createClient()

    supabase.auth.getUser().then(({ data: { user } }) => {
      const wsQuery = user
        ? supabase.from('workspaces').select('ateco_codes').eq('owner_id', user.id).maybeSingle()
        : supabase.from('workspaces').select('ateco_codes').limit(1).maybeSingle()

      Promise.all([
        supabase
          .from('catalog_items')
          .select('*')
          .eq('is_active', true)
          .order('category', { nullsFirst: false })
          .order('name'),
        wsQuery,
      ]).then(([catalogRes, wsRes]) => {
        setItems(catalogRes.data ?? [])
        setAtecoCodes(wsRes.data?.ateco_codes ?? [])
        setLoading(false)
      })
    })
  }, [open, items.length])

  // ── Helpers ────────────────────────────────────────────────
  function resetCreateForm() {
    setCreateName('')
    setCreateUnit('pz')
    setCreatePrice('')
    setCreateVat('22')
    setCreateCategory('')
    setCreateError(null)
  }

  function handleClose() {
    setOpen(false)
    setSearch('')
    setView('list')
    resetCreateForm()
  }

  /** Apre la vista creazione, pre-compilando il nome se l'utente stava cercando qualcosa */
  function openCreate(prefill?: string) {
    setCreateName(prefill ?? '')
    setCreateError(null)
    setView('create')
  }

  function handleImportAteco() {
    startImportTransition(async () => {
      const result = await importAtecoCatalogAction()
      if (!result.error) {
        setImportDone(true)
        const supabase = createClient()
        const { data } = await supabase
          .from('catalog_items')
          .select('*')
          .eq('is_active', true)
          .order('category', { nullsFirst: false })
          .order('name')
        setItems(data ?? [])
      }
    })
  }

  /** Crea la voce nel catalogo e la aggiunge subito al preventivo */
  function handleCreate() {
    if (!createName.trim()) { setCreateError('Il nome è obbligatorio.'); return }
    const price = parseImportoIt(createPrice)
    if (isNaN(price) || price < 0) { setCreateError('Inserisci un prezzo valido.'); return }
    setCreateError(null)

    startCreateTransition(async () => {
      const fd = new FormData()
      fd.set('name',       createName.trim())
      fd.set('unit',       createUnit)
      fd.set('unit_price', String(price))
      fd.set('vat_rate',   createVat)
      if (createCategory.trim()) fd.set('category', createCategory.trim())

      const result = await createCatalogItemAction(fd)
      if (result?.error) {
        setCreateError(result.error)
        return
      }

      // Aggiunge la voce al preventivo
      onSelect({
        description: createName.trim(),
        unit:        createUnit,
        unit_price:  price,
        vat_rate:    parseFloat(createVat),
      })

      // Ricarica la lista locale del catalogo per coerenza
      const supabase = createClient()
      const { data } = await supabase
        .from('catalog_items')
        .select('*')
        .eq('is_active', true)
        .order('category', { nullsFirst: false })
        .order('name')
      setItems(data ?? [])

      handleClose()
    })
  }

  // ── Filtraggio e raggruppamento ────────────────────────────
  const filtered = search.trim()
    ? items.filter((it) =>
        it.name.toLowerCase().includes(search.toLowerCase()) ||
        (it.description ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (it.category ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : items

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
      unit:        item.unit,
      unit_price:  Number(item.unit_price),
      vat_rate:    item.vat_rate != null ? Number(item.vat_rate) : null,
    })
    handleClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(true) }}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-1.5 shrink-0">
          <BookOpen className="size-4" />
          Da catalogo
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-lg p-0 gap-0">

        {/* ══════════════════════════════════════════════════════
            VISTA LISTA
        ══════════════════════════════════════════════════════ */}
        {view === 'list' && (
          <>
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
            <div className="overflow-y-auto max-h-80 border-t">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </div>

              ) : filtered.length === 0 && !search ? (
                // ── Empty state ──────────────────────────────
                (() => {
                  const preset = getAtecoPreset(atecoCodes)
                  return (
                    <div className="p-4 space-y-3">
                      {preset && !importDone ? (
                        <div className="rounded-lg border bg-muted/10 overflow-hidden">
                          <div className="px-4 pt-3 pb-2 flex items-start gap-2.5">
                            <Sparkles className="size-4 text-primary shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm font-medium">
                                Suggerito per {preset.label.toLowerCase()}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Importa {preset.items.length} voci di esempio per iniziare subito.
                              </p>
                            </div>
                          </div>
                          <div className="px-4 pb-3 flex items-center gap-3">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleImportAteco}
                              disabled={importPending}
                              className="flex-1"
                            >
                              {importPending
                                ? <><Loader2 className="size-3.5 animate-spin" /> Importazione…</>
                                : <><Sparkles className="size-3.5" /> Importa voci suggerite</>
                              }
                            </Button>
                            <a
                              href="/catalogo"
                              target="_blank"
                              className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground shrink-0"
                            >
                              Gestisci catalogo
                            </a>
                          </div>
                        </div>
                      ) : importDone ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                          <CheckCircle2 className="size-4 text-green-600 shrink-0" />
                          Voci importate. Selezionale qui sopra.
                        </div>
                      ) : (
                        <div className="py-4 text-center text-sm text-muted-foreground space-y-1.5">
                          <p>Nessuna voce salvata nel catalogo.</p>
                          {atecoCodes.length === 0 && (
                            <p className="text-xs text-muted-foreground/70 pt-2 border-t mt-2">
                              Vuoi suggerimenti per il tuo settore?{' '}
                              <a href="/impostazioni" target="_blank" className="underline underline-offset-2 hover:text-foreground">
                                Configura il codice ATECO
                              </a>
                              {' '}nelle impostazioni.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })()

              ) : filtered.length === 0 ? (
                // ── Nessun risultato ricerca — CTA crea ──────
                <div className="py-8 px-4 text-center text-sm text-muted-foreground space-y-3">
                  <p>{`Nessun risultato per "${search}"`}</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => openCreate(search)}
                    className="gap-1.5"
                  >
                    <PackagePlus className="size-3.5" />
                    Crea &ldquo;{search}&rdquo; nel catalogo
                  </Button>
                </div>

              ) : (
                // ── Lista voci raggruppate ────────────────────
                categories.map((cat) => (
                  <div key={cat}>
                    <div className="px-4 py-1.5 border-b sticky top-0" style={{ background: '#ececef' }}>
                      <span className="text-[11px] font-bold uppercase tracking-wide text-foreground/70">
                        {cat === '—' ? 'Senza categoria' : cat}
                      </span>
                    </div>
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

            {/* Footer */}
            <div className="px-4 py-2 border-t bg-muted/20 flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                {filtered.length} {filtered.length === 1 ? 'voce' : 'voci'} ·{' '}
                <a href="/catalogo" target="_blank" className="underline underline-offset-2 hover:text-foreground">
                  Gestisci catalogo
                </a>
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => openCreate()}
                className="gap-1.5 shrink-0"
              >
                <Plus className="size-3.5" />
                Nuova voce
              </Button>
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════════════════
            VISTA CREAZIONE RAPIDA
        ══════════════════════════════════════════════════════ */}
        {view === 'create' && (
          <>
            <DialogHeader className="px-4 pt-4 pb-2">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="size-8 p-0 -ml-1 shrink-0"
                  onClick={() => { setView('list'); resetCreateForm() }}
                >
                  <ArrowLeft className="size-4" />
                </Button>
                <DialogTitle className="text-base">Nuova voce catalogo</DialogTitle>
              </div>
            </DialogHeader>

            <div className="px-4 py-3 space-y-3 border-t">
              {createError && (
                <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
                  {createError}
                </p>
              )}

              {/* Nome */}
              <div className="space-y-1.5">
                <Label htmlFor="qcc-name">
                  Nome <span style={{ color: '#b08d3e' }}>*</span>
                </Label>
                <Input
                  id="qcc-name"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreate() } }}
                  placeholder="es. Posa piastrelle"
                  autoFocus
                  disabled={createPending}
                />
              </div>

              {/* Prezzo + Unità */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="qcc-price">
                    Prezzo unit. <span style={{ color: '#b08d3e' }}>*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="qcc-price"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={createPrice}
                      onChange={(e) => setCreatePrice(e.target.value)}
                      className="pr-6"
                      disabled={createPending}
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">€</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="qcc-unit">Unità</Label>
                  <Select value={createUnit} onValueChange={setCreateUnit} disabled={createPending}>
                    <SelectTrigger id="qcc-unit">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UNITS.map((u) => (
                        <SelectItem key={u} value={u}>{u}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* IVA + Categoria */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="qcc-vat">IVA %</Label>
                  <Select value={createVat} onValueChange={setCreateVat} disabled={createPending}>
                    <SelectTrigger id="qcc-vat">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VAT_RATES.map((r) => (
                        <SelectItem key={r} value={String(r)}>{r}%</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="qcc-cat">Categoria</Label>
                  <Input
                    id="qcc-cat"
                    value={createCategory}
                    onChange={(e) => setCreateCategory(e.target.value)}
                    placeholder="es. Manodopera"
                    disabled={createPending}
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t bg-muted/20 space-y-2">
              <p className="text-xs text-muted-foreground">
                La voce verrà salvata nel catalogo e aggiunta al preventivo.
              </p>
              <Button
                type="button"
                className="w-full gap-2"
                onClick={handleCreate}
                disabled={createPending}
              >
                {createPending
                  ? <><Loader2 className="size-4 animate-spin" /> Salvataggio…</>
                  : <><PackagePlus className="size-4" /> Salva nel catalogo e aggiungi</>
                }
              </Button>
            </div>
          </>
        )}

      </DialogContent>
    </Dialog>
  )
}
