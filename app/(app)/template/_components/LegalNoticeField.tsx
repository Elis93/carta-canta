'use client'

import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FORFETTARIO_LEGAL_NOTICE, BOLLO_VIRTUALE_NOTICE } from '@/lib/fiscal/calcoli'

// ⚖️ I testi di forfettario e bollo vengono dalle costanti di calcoli.ts
// (diciture prescritte per iscritto dallo studio del commercialista, 18 set
// 2026): sono le stesse che il PDF stampa da sé quando la nota legale non è
// personalizzata — il suggerimento non deve proporre una versione diversa.
const LEGAL_PRESETS: { label: string; text: string }[] = [
  {
    label: 'Regime forfettario',
    text: FORFETTARIO_LEGAL_NOTICE,
  },
  {
    label: 'Ritenuta d\'acconto 20%',
    text: 'Soggetto a ritenuta d\'acconto del 20% ai sensi dell\'art. 25 DPR 600/73.',
  },
  {
    label: 'Marca da bollo',
    text: BOLLO_VIRTUALE_NOTICE,
  },
  {
    label: 'Reverse charge',
    text: "Inversione contabile (reverse charge) – art. 17 c. 6 DPR 633/72.",
  },
  {
    label: 'IVA esente art. 10',
    text: "Operazione esente IVA ai sensi dell'art. 10 DPR 633/72.",
  },
]

interface LegalNoticeFieldProps {
  value: string
  onChange: (v: string) => void
  /** Testo descrittivo sotto il campo */
  hint?: string
}

export function LegalNoticeField({ value, onChange, hint }: LegalNoticeFieldProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        <Label htmlFor="legal_notice">Nota legale in calce</Label>
        {/* Dropdown suggerimenti — adiacente al label */}
        <Select
          value=""
          onValueChange={(preset) => {
            const found = LEGAL_PRESETS.find((p) => p.label === preset)
            if (found) onChange(found.text)
          }}
        >
          <SelectTrigger className="h-7 w-auto text-xs px-2.5 py-0 gap-1.5 border-dashed text-muted-foreground hover:text-foreground hover:border-border">
            <SelectValue placeholder="Inserisci testo preimpostato…" />
          </SelectTrigger>
          <SelectContent align="end">
            {LEGAL_PRESETS.map((p) => (
              <SelectItem key={p.label} value={p.label} className="text-sm">
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Textarea
        id="legal_notice"
        name="legal_notice"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="esempio: RF19 - Operazione senza applicazione dell'Iva ai sensi dell'art. 1 co. 54-89…"
        rows={4}
      />
      {hint && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  )
}
