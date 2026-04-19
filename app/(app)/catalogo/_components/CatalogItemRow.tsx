'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Pencil, Trash2, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CatalogItemForm } from './CatalogItemForm'
import { deleteCatalogItemAction, toggleCatalogItemAction } from '../actions'
import type { Database } from '@/types/database'

type CatalogItem = Database['public']['Tables']['catalog_items']['Row']

export function CatalogItemRow({ item }: { item: CatalogItem }) {
  const [editing, setEditing] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    if (!confirm(`Eliminare "${item.name}"?`)) return
    startTransition(async () => {
      const res = await deleteCatalogItemAction(item.id)
      if ('error' in res && res.error) toast.error(res.error)
      else toast.success('Voce eliminata')
    })
  }

  function handleToggle() {
    startTransition(async () => {
      await toggleCatalogItemAction(item.id, !item.is_active)
    })
  }

  if (editing) {
    return (
      <div className="px-4 py-3 bg-muted/30 border-b">
        <CatalogItemForm item={item} onDone={() => setEditing(false)} />
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b last:border-0 group hover:bg-muted/30 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`font-medium text-sm ${!item.is_active ? 'line-through text-muted-foreground' : ''}`}>
            {item.name}
          </span>
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
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.description}</p>
        )}
      </div>

      <div className="flex items-center gap-4 shrink-0 text-sm">
        <span className="text-muted-foreground text-xs">{item.unit}</span>
        <span className="font-semibold tabular-nums">
          €{Number(item.unit_price).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
        </span>
        {item.vat_rate != null && (
          <span className="text-muted-foreground text-xs">IVA {item.vat_rate}%</span>
        )}
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
          onClick={handleDelete}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}
