'use client'

import { useState, useEffect, useTransition } from 'react'
import { runAction } from '@/lib/run-action'
import { BookOpen, Search, Plus, Loader2, Sparkles, CheckCircle2, ArrowLeft, PackagePlus, Lock } from 'lucide-react'
import { prezzoProposto, giorniAllaScadenza } from '@/lib/fornitori/listino'
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
    /** Costo d'acquisto (062) — viaggia nella voce SOLO per il margine privato */
    unit_cost?: number | null
    /** Listino fornitore di origine (063) — per l'aggancio scadenza */
    supplier_list_id?: string | null
  }) => void
}

// ── Listini fornitori (Fase 2) — tipi locali (tabelle 063 non nei types) ──
type SupplierList = { id: string; name: string; markup_pct: number | null; valid_until: string | null }
type SupplierItem = { id: string; list_id: string; code: string | null; description: string; unit: string; unit_cost: number }

export function CatalogPicker({ onSelect }: CatalogPickerProps) {
  const [open, setOpen]       = useState(false)
  const [view, setView]       = useState<'list' | 'create'>('list')
  const [tab, setTab]         = useState<'catalogo' | 'listini'>('catalogo')
  const [items, setItems]     = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch]   = useState('')
  const [atecoCodes, setAtecoCodes] = useState<string[]>([])
  const [importPending, startImportTransition] = useTransition()
  const [importDone, setImportDone] = useState(false)
  // Listini fornitori (Fase 2, Pro): caricati insieme al catalogo.
  // isPro=null finché non sappiamo (niente lucchetto-lampo).
  const [isPro, setIsPro] = useState<boolean | null>(null)
  const [supplierLists, setSupplierLists] = useState<SupplierList[]>([])
  const [supplierItems, setSupplierItems] = useState<SupplierItem[]>([])

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

    supabase.auth.getUser().then(() => {
      // RLS limita già ai workspace visibili all'utente (titolare O collaboratore):
      // niente filtro owner_id, che per un collaboratore tornava vuoto e faceva
      // sparire i suggerimenti ATECO.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- plan non serve nei types qui
      const wsQuery = (supabase.from('workspaces').select('ateco_codes, plan') as any).limit(1).maybeSingle()

      // Listini fornitori (063): tolleranti pre-migration con .then(ok, ko)
      // (i builder PostgREST sono PromiseLike: niente .catch diretto).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelle 063 non ancora in types/database.ts
      const listsQuery = (supabase as any)
        .from('supplier_lists')
        .select('id, name, markup_pct, valid_until')
        .order('name')
        .then((r: { data: SupplierList[] | null }) => r.data ?? [], () => [] as SupplierList[])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- vedi sopra
      const supItemsQuery = (supabase as any)
        .from('supplier_list_items')
        .select('id, list_id, code, description, unit, unit_cost')
        .order('description')
        .then((r: { data: SupplierItem[] | null }) => r.data ?? [], () => [] as SupplierItem[])

      Promise.all([
        supabase
          .from('catalog_items')
          .select('*')
          .eq('is_active', true)
          .order('category', { nullsFirst: false })
          .order('name'),
        wsQuery,
        listsQuery,
        supItemsQuery,
      ]).then(([catalogRes, wsRes, lists, supItems]) => {
        setItems(catalogRes.data ?? [])
        setAtecoCodes(wsRes.data?.ateco_codes ?? [])
        setIsPro((wsRes.data?.plan ?? 'free') !== 'free')
        setSupplierLists(lists)
        setSupplierItems(supItems)
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
    setTab('catalogo')
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
      const result = await runAction(() => importAtecoCatalogAction(), 'importare il listino')
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

      const result = await runAction(() => createCatalogItemAction(fd), 'salvare la voce')
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- unit_cost (062) non ancora in types/database.ts
    const rawCost = (item as any).unit_cost
    onSelect({
      description: item.description ?? item.name,
      unit:        item.unit,
      unit_price:  Number(item.unit_price),
      vat_rate:    item.vat_rate != null ? Number(item.vat_rate) : null,
      unit_cost:   rawCost != null ? Number(rawCost) : null,
    })
    handleClose()
  }

  // ── Linguetta "Listini fornitori" (Fase 2, Pro) ────────────────────────
  // Voce dal listino: COSTO dal fornitore, prezzo di vendita PROPOSTO
  // (costo + ricarico del fornitore, sempre modificabile). Senza ricarico
  // impostato il prezzo resta 0 = "da prezzare", mai inventato.
  function handleSelectSupplier(item: SupplierItem, list: SupplierList) {
    const proposto = prezzoProposto(Number(item.unit_cost), list.markup_pct != null ? Number(list.markup_pct) : null)
    onSelect({
      description: item.description,
      unit:        item.unit || 'pz',
      unit_price:  proposto ?? 0,
      vat_rate:    null,
      unit_cost:   Number(item.unit_cost),
      supplier_list_id: list.id,
    })
    handleClose()
  }

  const filteredSupplier = search.trim()
    ? supplierItems.filter((it) =>
        it.description.toLowerCase().includes(search.toLowerCase()) ||
        (it.code ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : supplierItems

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(true) }}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-1.5 shrink-0">
          <BookOpen className="size-4" />
          Da catalogo
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">

        {/* ══════════════════════════════════════════════════════
            VISTA LISTA
        ══════════════════════════════════════════════════════ */}
        {view === 'list' && (
          <>
            <DialogHeader className="px-4 pt-4 pb-2">
              <DialogTitle className="text-base">Seleziona dal catalogo</DialogTitle>
            </DialogHeader>

            {/* Linguette: catalogo proprio | listini fornitori (Fase 2, Pro) */}
            <div className="px-4 pb-2" style={{ display: 'flex', gap: 6 }}>
              {([['catalogo', 'Il mio catalogo'], ['listini', 'Listini fornitori']] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  style={{
                    flex: 1, padding: '7px 8px', borderRadius: 9, fontSize: 13, fontWeight: 600,
                    fontFamily: 'inherit', cursor: 'pointer',
                    border: tab === key ? 'none' : '1px solid #e3e3e6',
                    background: tab === key ? '#1a1a2e' : '#fff',
                    color: tab === key ? '#fff' : '#55534b',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  }}
                >
                  {label}
                  {key === 'listini' && isPro === false && <Lock size={12} style={{ opacity: .7 }} />}
                </button>
              ))}
            </div>

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

              ) : tab === 'listini' ? (
                // ── Linguetta LISTINI FORNITORI ─────────────────────────
                isPro === false ? (
                  <div className="p-5 text-center text-sm text-muted-foreground space-y-2">
                    <Lock className="size-5 mx-auto opacity-50" />
                    <p>I listini fornitori sono una funzione <b>Pro</b>: importi il listino, l&rsquo;app propone il prezzo col tuo ricarico e ti avvisa quando il listino scade.</p>
                    <a href="/abbonamento" target="_blank" className="inline-block underline underline-offset-2 font-semibold" style={{ color: '#b0863e' }}>
                      Scopri Pro
                    </a>
                  </div>
                ) : supplierLists.length === 0 ? (
                  <div className="p-5 text-center text-sm text-muted-foreground space-y-2">
                    <p>Nessun listino fornitore ancora.</p>
                    <a href="/catalogo?tab=listini" target="_blank" className="underline underline-offset-2 hover:text-foreground">
                      Crea il primo listino da Catalogo e listini
                    </a>
                  </div>
                ) : filteredSupplier.length === 0 ? (
                  <div className="py-8 px-4 text-center text-sm text-muted-foreground">
                    {search ? `Nessun risultato per "${search}"` : 'I tuoi listini non hanno ancora voci.'}
                  </div>
                ) : (
                  supplierLists.map((list) => {
                    const listItems = filteredSupplier.filter((it) => it.list_id === list.id)
                    if (listItems.length === 0) return null
                    const giorni = list.valid_until ? giorniAllaScadenza(list.valid_until) : null
                    return (
                      <div key={list.id}>
                        <div className="px-4 py-1.5 border-b sticky top-0 flex items-center gap-2" style={{ background: '#ececef' }}>
                          <span className="text-[11px] font-bold uppercase tracking-wide text-foreground/70">{list.name}</span>
                          {giorni != null && (
                            <span className="text-[10px] font-bold rounded-full px-2 py-px" style={giorni < 0 ? { background: '#fde8e8', color: '#b42318' } : { background: '#fdf9ef', color: '#8a6a2f' }}>
                              {giorni < 0 ? 'LISTINO SCADUTO' : `valido ${giorni} g`}
                            </span>
                          )}
                        </div>
                        {listItems.map((item) => {
                          const proposto = prezzoProposto(Number(item.unit_cost), list.markup_pct != null ? Number(list.markup_pct) : null)
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => handleSelectSupplier(item, list)}
                              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/40 transition-colors text-left border-b last:border-0 group"
                            >
                              <div className="min-w-0 flex-1 pr-3">
                                <p className="text-sm font-medium truncate">{item.description}</p>
                                <p className="text-xs text-muted-foreground truncate mt-0.5">
                                  {item.code ? `${item.code} · ` : ''}costo {Number(item.unit_cost).toLocaleString('it-IT', { minimumFractionDigits: 2 })} €/{item.unit}
                                </p>
                              </div>
                              <div className="shrink-0 text-right">
                                {proposto != null ? (
                                  <>
                                    <p className="text-sm font-semibold tabular-nums">{proposto.toLocaleString('it-IT', { minimumFractionDigits: 2 })} €</p>
                                    <p className="text-[10px] text-muted-foreground">col tuo +{Number(list.markup_pct).toLocaleString('it-IT')}%</p>
                                  </>
                                ) : (
                                  <p className="text-xs" style={{ color: '#8a6a2f' }}>prezzo da fare</p>
                                )}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    )
                  })
                )

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

            {/* Footer (adattivo per linguetta) */}
            {tab === 'listini' ? (
              <div className="px-4 py-2 border-t bg-muted/20">
                <p className="text-xs text-muted-foreground">
                  {filteredSupplier.length} {filteredSupplier.length === 1 ? 'voce' : 'voci'} ·{' '}
                  <a href="/catalogo?tab=listini" target="_blank" className="underline underline-offset-2 hover:text-foreground">
                    Gestisci i listini
                  </a>
                </p>
              </div>
            ) : (
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
            )}
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
                  aria-label="Torna alla lista"
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
