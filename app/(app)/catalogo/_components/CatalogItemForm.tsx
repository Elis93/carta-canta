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

const UNITS: { value: string; label: string }[] = [
  { value: 'pz',       label: 'pz (pezzi)'         },
  { value: 'h',        label: 'h (ore)'             },
  { value: 'gg',       label: 'gg (giorni)'         },
  { value: 'kg',       label: 'kg (chilogrammi)'    },
  { value: 'ml',       label: 'ml (millilitri)'     },
  { value: 'm',        label: 'm (metri)'           },
  { value: 'm²',       label: 'm² (metri quadri)'   },
  { value: 'm³',       label: 'm³ (metri cubi)'     },
  { value: 'lotto',    label: 'lotto'               },
  { value: 'servizio', label: 'servizio'             },
]

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
  const [unit, setUnit] = useState(item?.unit ?? UNITS[0].value)
  const [unitPrice, setUnitPrice] = useState(String(item?.unit_price ?? 0))
  // Per le nuove voci (item undefined) default a '22' — corrisponde al placeholder.
  // Per le voci esistenti si usa il valore salvato (o '' se null — campo opzionale).
  const [vatRate, setVatRate] = useState(
    item ? (item.vat_rate != null ? String(item.vat_rate) : '') : '22'
  )

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
      setUnitPrice('0')
      setVatRate('22')
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
        <div className="flex flex-col justify-end gap-1.5">
          <Label>Unità di misura</Label>
          <Select value={unit} onValueChange={setUnit}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UNITS.map((u) => (
                <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col justify-end gap-1.5">
          <Label htmlFor="ci-price">Prezzo unit. (€) *</Label>
          <Input
            id="ci-price"
            name="unit_price"
            type="text"
            inputMode="decimal"
            value={unitPrice}
            onChange={(e) => {
              let raw = e.target.value
              if (unitPrice === '0' && raw.length > 1 && raw.startsWith('0') && !raw.startsWith('0.')) {
                raw = raw.slice(1)
              }
              setUnitPrice(raw)
            }}
            onBlur={() => {
              const num = parseFloat(unitPrice.replace(',', '.'))
              setUnitPrice(isNaN(num) || unitPrice.trim() === '' ? '0' : String(num))
            }}
            required
          />
        </div>
        <div className="flex flex-col justify-end gap-1.5">
          <Label htmlFor="ci-vat">IVA %</Label>
          <Input
            id="ci-vat"
            name="vat_rate"
            type="text"
            inputMode="decimal"
            value={vatRate}
            onChange={(e) => {
              let raw = e.target.value
              if (vatRate === '0' && raw.length > 1 && raw.startsWith('0') && !raw.startsWith('0.')) {
                raw = raw.slice(1)
              }
              setVatRate(raw)
            }}
            onBlur={() => {
              if (vatRate.trim() === '') { setVatRate(''); return }
              const num = parseFloat(vatRate.replace(',', '.'))
              setVatRate(isNaN(num) ? '' : String(num))
            }}
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
