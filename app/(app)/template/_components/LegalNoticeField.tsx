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

const LEGAL_PRESETS: { label: string; text: string }[] = [
  {
    label: 'Regime forfettario',
    text: "Operazione effettuata ai sensi dell'art. 1, commi 54-89, Legge n. 190/2014 – Regime forfettario. Imposta non applicata.",
  },
  {
    label: 'Ritenuta d\'acconto 20%',
    text: 'Soggetto a ritenuta d\'acconto del 20% ai sensi dell\'art. 25 DPR 600/73.',
  },
  {
    label: 'Marca da bollo',
    text: "Imposta di bollo assolta sull'originale – art. 15 D.M. 17/06/2014.",
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
        placeholder="Es. Operazione effettuata ai sensi dell'art. 1, commi 54-89, L. 190/2014…"
        rows={4}
      />
      {hint && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  )
}
