'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Pencil, Trash2, Eye, EyeOff, Loader2, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { CatalogItemForm } from './CatalogItemForm'
import { deleteCatalogItemAction, toggleCatalogItemAction } from '../actions'
import type { Database } from '@/types/database'

type CatalogItem = Database['public']['Tables']['catalog_items']['Row']

export function CatalogItemRow({ item }: { item: CatalogItem }) {
  const [editing, setEditing] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      const res = await deleteCatalogItemAction(item.id)
      if ('error' in res && res.error) toast.error(res.error)
      else {
        toast.success('Voce eliminata.')
        setConfirmOpen(false)
        setEditing(false)
      }
    })
  }

  function handleToggle() {
    startTransition(async () => {
      const res = await toggleCatalogItemAction(item.id, !item.is_active)
      if (res && 'error' in res && res.error) {
        toast.error(res.error)
      } else {
        toast.success(item.is_active ? 'Voce nascosta dal catalogo.' : 'Voce di nuovo visibile.')
      }
    })
  }

  return (
    <>
      {editing ? (
        <div className="px-4 py-3 bg-muted/30 border-b">
          <CatalogItemForm item={item} onDone={() => setEditing(false)} />
          {/* Nascondi / Elimina nella modifica — solo mobile (desktop ha i bottoni hover nella riga) */}
          <div className="flex items-center gap-3 mt-4 pt-3 border-t lg:hidden">
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggle}
              disabled={isPending}
              className="flex-1"
            >
              {item.is_active
                ? <><EyeOff className="size-4 mr-2" />Nascondi</>
                : <><Eye className="size-4 mr-2" />Mostra</>}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmOpen(true)}
              disabled={isPending}
              className="flex-1 text-destructive border-destructive hover:bg-destructive/10"
            >
              <Trash2 className="size-4 mr-2" />Elimina
            </Button>
          </div>
        </div>
      ) : (
        <div
          className="flex items-center gap-2.5 lg:gap-3 lg:px-4 lg:py-3 lg:border-b lg:last:border-0 group lg:hover:bg-muted/30 transition-colors cursor-pointer"
          style={{ padding: '11px 0' }}
          onClick={() => setEditing(true)}
        >
          <div className="flex-1 min-w-0">
            <div
              className={`truncate ${!item.is_active ? 'line-through' : ''}`}
              style={{ fontSize: 14, fontWeight: 600, color: item.is_active ? '#161616' : '#8a887f' }}
            >
              {item.name}
            </div>
            {/* Desktop: badge categoria + nascosta */}
            <div className="hidden lg:flex items-center gap-2 flex-wrap mt-1">
              {item.category && (
                <Badge variant="outline" className="text-xs font-normal">
                  {item.category}
                </Badge>
              )}
              {!item.is_active && (
                <Badge variant="secondary" className="text-xs">Nascosta</Badge>
              )}
            </div>
            {item.description && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate hidden lg:block">{item.description}</p>
            )}
            {/* Sottotitolo mobile: unità · IVA% */}
            <div
              className="truncate lg:hidden"
              style={{ fontSize: 12, color: '#8a887f', marginTop: 2 }}
            >
              {[item.unit, item.vat_rate != null ? `IVA ${item.vat_rate}%` : null].filter(Boolean).join(' · ')}
            </div>
          </div>

          {/* Prezzo — desktop cluster */}
          <div className="hidden lg:flex items-center gap-4 shrink-0 text-sm">
            <span className="text-muted-foreground text-xs">{item.unit}</span>
            <span className="font-semibold tabular-nums">
              €{Number(item.unit_price).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
            </span>
            {item.vat_rate != null && (
              <span className="text-muted-foreground text-xs">IVA {item.vat_rate}%</span>
            )}
          </div>

          {/* Prezzo — mobile */}
          <span
            className="whitespace-nowrap shrink-0 lg:hidden"
            style={{ fontSize: 14, fontWeight: 600, color: '#161616' }}
          >
            € {Number(item.unit_price).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>

          {/* Chevron — mobile only, segnala che la riga è tappabile */}
          <ChevronRight size={18} className="shrink-0 lg:hidden" style={{ color: '#8a887f' }} />

          {/* Pulsanti azione — desktop hover only */}
          <div
            className="hidden lg:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              title={item.is_active ? 'Nascondi' : 'Mostra'}
              disabled={isPending}
              onClick={handleToggle}
            >
              {item.is_active ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              title="Modifica"
              onClick={() => setEditing(true)}
            >
              <Pencil className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-destructive hover:text-destructive"
              title="Elimina"
              disabled={isPending}
              onClick={() => setConfirmOpen(true)}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Dialog conferma eliminazione (fuori dai rami per condividere lo stato) */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Elimina voce dal catalogo</DialogTitle>
            <DialogDescription>
              Vuoi eliminare &ldquo;{item.name}&rdquo; dal catalogo? L&apos;azione non è reversibile.
              I preventivi che la contengono non verranno modificati.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={isPending}>
              Annulla
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Elimina
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
