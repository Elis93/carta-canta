'use client'

import type { CSSProperties } from 'react'
import { runAction } from '@/lib/run-action'
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
import { SpiegaCampo } from '@/components/shared/SpiegaCampo'

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
    /** Costo d'acquisto (062) — solo margine privato, mai al cliente (B.2) */
    unit_cost?: number | null
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

// Le QUATTRO aliquote IVA italiane + lo 0 (esenti/non imponibili) — le stesse
// della tendina del preventivo. Il campo libero permetteva aliquote
// inesistenti (es. 60%), che si sarebbero scoperte solo allo scarto SdI.
const VAT_OPTIONS = ['22', '10', '5', '4', '0']

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
  // Costo d'acquisto (062): facoltativo — '' = non tracciato
  const [unitCost, setUnitCost] = useState(
    item?.unit_cost != null && item.unit_cost > 0 ? String(item.unit_cost) : ''
  )

  async function handleSubmit(formData: FormData) {
    formData.set('unit', unit)
    // La tendina IVA non è un campo di form nativo: il valore va messo a mano
    // ('' = predefinita → il server salva null)
    formData.set('vat_rate', vatRate)

    startTransition(async () => {
      const result = item
        ? await runAction(() => updateCatalogItemAction(item.id, formData), 'salvare la voce')
        : await runAction(() => createCatalogItemAction(formData), 'salvare la voce')

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
      setUnitCost('')
      onDone?.()
    })
  }

  return (
    <form ref={formRef} action={handleSubmit}>
      {/* Nome / Categoria.
          ⚠️ Su telefono ognuno ha la SUA riga: affiancati, il nome della voce
          («Raccordo / fittings ottone…») si leggeva a metà dentro mezza
          colonna (foto di Eli, 12 ago). Il nome è il dato che identifica la
          voce: non si divide lo spazio con un campo facoltativo. Sopra i
          640px tornano affiancati, lì lo spazio c'è. */}
      <div className="flex flex-col sm:flex-row" style={{ gap: 10, marginBottom: 14 }}>
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
        <div style={{ width: 96 }}>
          <Label htmlFor="ci-vat" style={labelStyle}>IVA</Label>
          {/* Tendina con le SOLE aliquote italiane vere (22/10/5/4/0), come
              nel preventivo — il campo libero permetteva di scrivere
              un'aliquota inesistente (Eli, 20 ago: «ho potuto mettere IVA al
              60%»). Un valore storico fuori elenco resta visibile finché non
              lo si corregge (stesso schema FIX-20 delle unità). */}
          <Select
            value={vatRate === '' ? '__none__' : vatRate}
            onValueChange={(v) => setVatRate(v === '__none__' ? '' : v)}
          >
            <SelectTrigger id="ci-vat" className="w-full" style={fieldStyle}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Predefinita</SelectItem>
              {VAT_OPTIONS.map((r) => (
                <SelectItem key={r} value={r}>{r}%</SelectItem>
              ))}
              {vatRate !== '' && !VAT_OPTIONS.includes(vatRate) && (
                <SelectItem value={vatRate}>{vatRate}% (da correggere)</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Costo d'acquisto (F1 listino fornitore) — facoltativo.
          🔒 B.2: solo per il margine privato, mai su superfici viste dal cliente. */}
      <div style={{ marginBottom: 16 }}>
        {/* La spiegazione sta nel punto ⓘ (Eli, 11 ago) — MAI nel segnaposto,
            che non va a capo (Eli, 8 ago). Il lucchetto resta nell'etichetta:
            dice a colpo d'occhio che il dato è privato. */}
        <SpiegaCampo etichetta={<>🔒 Costo (quanto la paghi) — facoltativo</>} style={labelStyle}>
          Lo vedi <b style={{ fontWeight: 600 }}>solo tu</b>: serve a calcolare il margine. Al cliente non compare mai.
        </SpiegaCampo>
        <Input
          id="ci-cost"
          name="unit_cost"
          type="text"
          inputMode="decimal"
          value={unitCost}
          style={fieldStyle}
          placeholder="es. 40,00"
          onChange={(e) => setUnitCost(e.target.value)}
          onBlur={() => {
            if (unitCost.trim() === '') { setUnitCost(''); return }
            const num = parseImportoIt(unitCost)
            setUnitCost(isNaN(num) || num <= 0 ? '' : String(num))
          }}
        />
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
