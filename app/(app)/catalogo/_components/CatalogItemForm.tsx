'use client'

import type { CSSProperties } from 'react'
import { useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { createCatalogItemAction, updateCatalogItemAction } from '../actions'
import { UNIT_OPTIONS } from '@/lib/constants/units'
import { parseImportoIt } from '@/lib/utils'

// Usa UNIT_OPTIONS dalla fonte di verità condivisa per coerenza con il form preventivo.
// Le label estese (con la descrizione) sono mostrate solo nel catalogo per chiarezza.
const UNITS: { value: string; label: string }[] = UNIT_OPTIONS.map((u) => ({
  value: u.value,
  label: u.value === 'pz'       ? 'pz — pezzi'
       : u.value === 'ore'      ? 'ore — ore lavorate'
       : u.value === 'gg'       ? 'gg — giorni'
       : u.value === 'mq'       ? 'mq — m²'
       : u.value === 'ml'       ? 'ml — metrilineari'
       : u.value === 'mc'       ? 'mc — m³'
       : u.value === 'kg'       ? 'kg — chilogrammi'
       : u.value === 'lt'       ? 'lt — litri'
       : u.value,
}))

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

// FIX-20 (sessione FIX-05): alcune voci di catalogo storiche hanno un'unità
// di misura "libera" (es. "h") che NON è presente nell'elenco predefinito
// UNITS — <SelectValue> non trova corrispondenza e il select appare vuoto in
// modifica, anche se `unit` è correttamente precaricato nello state. Fix:
// se il valore salvato non è tra le opzioni standard, lo si aggiunge
// dinamicamente alla lista (così resta visibile e selezionato in modifica).
function buildUnitOptions(savedUnit: string | undefined): { value: string; label: string }[] {
  if (savedUnit && !UNITS.some((u) => u.value === savedUnit)) {
    return [...UNITS, { value: savedUnit, label: savedUnit }]
  }
  return UNITS
}

export function CatalogItemForm({ item, onDone }: CatalogItemFormProps) {
  const formRef = useRef<HTMLFormElement>(null)
  const [isPending, startTransition] = useTransition()
  // Tutti i campi sono controllati per evitare il reset automatico di React 19
  // su <form action={fn}> in caso di errore.
  const [name, setName]           = useState(item?.name ?? '')
  const [category, setCategory]   = useState(item?.category ?? '')
  const [description, setDescription] = useState(item?.description ?? '')
  const [unit, setUnit]           = useState(item?.unit ?? UNITS[0].value)
  // FIX-20: include l'unità salvata nell'elenco anche se "libera"/legacy (es. "h")
  const [unitOptions]             = useState(() => buildUnitOptions(item?.unit))
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
      // Reset manuale di tutti gli state (non usare formRef.reset() con campi controllati)
      setName('')
      setCategory('')
      setDescription('')
      setUnit('pz')
      setUnitPrice('0')
      setVatRate('22')
      onDone?.()
    })
  }

  return (
    <form ref={formRef} action={handleSubmit}>
      {/* Nome / Categoria */}
      <div className="flex" style={{ gap: 10, marginBottom: 14 }}>
        <div style={{ flex: 1 }}>
          <Label htmlFor="ci-name" style={labelStyle}>
            Nome <span style={{ color: '#b08d3e' }}>*</span>
          </Label>
          <Input
            id="ci-name"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="es. Sostituzione rubinetto"
            style={fieldStyle}
            required
          />
        </div>
        <div style={{ flex: 1 }}>
          <Label htmlFor="ci-category" style={labelStyle}>Categoria</Label>
          <Input
            id="ci-category"
            name="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="es. Idraulica"
            style={fieldStyle}
          />
        </div>
      </div>

      {/* Descrizione */}
      <div style={{ marginBottom: 14 }}>
        <Label htmlFor="ci-desc" style={labelStyle}>Descrizione</Label>
        <Input
          id="ci-desc"
          name="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descrizione che apparirà nel preventivo"
          style={fieldStyle}
        />
      </div>

      {/* Unità / Prezzo / IVA */}
      <div className="flex" style={{ gap: 10, marginBottom: 16 }}>
        <div style={{ flex: 1.2 }}>
          <Label style={labelStyle}>Unità</Label>
          <Select value={unit} onValueChange={setUnit}>
            <SelectTrigger className="w-full" style={fieldStyle}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {unitOptions.map((u) => (
                <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div style={{ flex: 1 }}>
          <Label htmlFor="ci-price" style={labelStyle}>
            Prezzo <span style={{ color: '#b08d3e' }}>*</span>
          </Label>
          <Input
            id="ci-price"
            name="unit_price"
            type="text"
            inputMode="decimal"
            value={unitPrice}
            style={fieldStyle}
            onChange={(e) => {
              let raw = e.target.value
              if (unitPrice === '0' && raw.length > 1 && raw.startsWith('0') && !raw.startsWith('0.')) {
                raw = raw.slice(1)
              }
              setUnitPrice(raw)
            }}
            onBlur={() => {
              const num = parseImportoIt(unitPrice)
              setUnitPrice(isNaN(num) || unitPrice.trim() === '' ? '0' : String(num))
            }}
            required
          />
        </div>
        <div style={{ width: 70 }}>
          <Label htmlFor="ci-vat" style={labelStyle}>IVA %</Label>
          <Input
            id="ci-vat"
            name="vat_rate"
            type="text"
            inputMode="decimal"
            value={vatRate}
            style={fieldStyle}
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

      {onDone ? (
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onDone}>
            Annulla
          </Button>
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? 'Salvataggio…' : 'Aggiorna'}
          </Button>
        </div>
      ) : (
        <Button
          type="submit"
          disabled={isPending}
          className="w-full text-white hover:bg-[#1a1a2e]/95"
          style={{
            background: '#1a1a2e', borderRadius: 12, height: 50, boxSizing: 'border-box',
            fontSize: 14, fontWeight: 600, boxShadow: '0 6px 16px -6px rgba(26,26,46,.5)',
          }}
        >
          {isPending ? 'Salvataggio…' : 'Aggiungi al catalogo'}
        </Button>
      )}
    </form>
  )
}

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: '.05em',
  textTransform: 'uppercase',
  color: 'var(--cc-muted)',
  marginBottom: 7,
}

const fieldStyle: CSSProperties = {
  border: '1px solid #e3e3e6',
  borderRadius: 10,
  padding: '11px 12px',
  fontSize: 14,
  height: 'auto',
}
