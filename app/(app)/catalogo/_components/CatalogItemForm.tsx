'use client'

import { useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { createCatalogItemAction, updateCatalogItemAction } from '../actions'

const UNITS = ['pz', 'h', 'gg', 'kg', 'ml', 'm', 'm²', 'm³', 'lotto', 'servizio']

interface CatalogItemFormProps {
  item?: {
    id: string
    name: string
    description: string | null
    unit: string
    unit_price: number
    vat_rate: number | null
    category: string | null
  }
  onDone?: () => void
}

export function CatalogItemForm({ item, onDone }: CatalogItemFormProps) {
  const formRef = useRef<HTMLFormElement>(null)
  const [isPending, startTransition] = useTransition()
  const [unit, setUnit] = useState(item?.unit ?? 'pz')

  async function handleSubmit(formData: FormData) {
    formData.set('unit', unit)

    startTransition(async () => {
      const result = item
        ? await updateCatalogItemAction(item.id, formData)
        : await createCatalogItemAction(formData)

      if ('error' in result && result.error) {
        toast.error(result.error)
        return
      }

      toast.success(item ? 'Voce aggiornata' : 'Voce aggiunta al catalogo')
      formRef.current?.reset()
      setUnit('pz')
      onDone?.()
    })
  }

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="ci-name">Nome *</Label>
          <Input
            id="ci-name"
            name="name"
            defaultValue={item?.name}
            placeholder="es. Sostituzione rubinetto"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ci-category">Categoria</Label>
          <Input
            id="ci-category"
            name="category"
            defaultValue={item?.category ?? ''}
            placeholder="es. Idraulica, Muratura…"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ci-desc">Descrizione</Label>
        <Input
          id="ci-desc"
          name="description"
          defaultValue={item?.description ?? ''}
          placeholder="Descrizione che apparirà nel preventivo"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label>Unità di misura</Label>
          <Select value={unit} onValueChange={setUnit}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ci-price">Prezzo unit. (€) *</Label>
          <Input
            id="ci-price"
            name="unit_price"
            type="number"
            min="0"
            step="0.01"
            defaultValue={item?.unit_price ?? 0}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ci-vat">IVA %</Label>
          <Input
            id="ci-vat"
            name="vat_rate"
            type="number"
            min="0"
            max="100"
            step="0.1"
            defaultValue={item?.vat_rate ?? ''}
            placeholder="22"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        {onDone && (
          <Button type="button" variant="outline" size="sm" onClick={onDone}>
            Annulla
          </Button>
        )}
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? 'Salvataggio…' : item ? 'Aggiorna' : 'Aggiungi al catalogo'}
        </Button>
      </div>
    </form>
  )
}
