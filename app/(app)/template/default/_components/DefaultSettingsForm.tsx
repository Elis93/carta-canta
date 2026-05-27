'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { saveDefaultSettingsAction } from '@/lib/actions/templates'

interface DefaultSettingsFormProps {
  defaultShowWatermark: boolean
  defaultLegalNotice: string
}

export function DefaultSettingsForm({
  defaultShowWatermark,
  defaultLegalNotice,
}: DefaultSettingsFormProps) {
  const [showWatermark, setShowWatermark] = useState(defaultShowWatermark)
  const [legalNotice,   setLegalNotice]   = useState(defaultLegalNotice)

  return (
    <form action={saveDefaultSettingsAction} className="space-y-5">
      <input type="hidden" name="show_watermark" value={String(showWatermark)} />

      {/* Branding switch */}
      <div className="rounded-xl border p-4 space-y-3">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium leading-snug">
              Branding &quot;Generato con Carta Canta&quot;
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Filigrana diagonale e riga nel piè di pagina del documento
            </p>
          </div>
          <Switch
            id="show_watermark_switch"
            checked={showWatermark}
            onCheckedChange={setShowWatermark}
            className="mt-0.5 shrink-0"
          />
        </div>
      </div>

      <Separator />

      {/* Nota legale */}
      <div className="space-y-1.5">
        <Label htmlFor="legal_notice">Nota legale in calce</Label>
        <Textarea
          id="legal_notice"
          name="legal_notice"
          value={legalNotice}
          onChange={(e) => setLegalNotice(e.target.value)}
          placeholder="Es. Operazione effettuata ai sensi dell'art. 1, commi 54-89, L. 190/2014…"
          rows={4}
        />
        <p className="text-xs text-muted-foreground">
          Per i forfettari viene aggiunta automaticamente la stringa obbligatoria se questo campo è vuoto.
        </p>
      </div>

      <div className="flex gap-3 pt-1">
        <Button type="submit">Salva</Button>
        <Button variant="outline" asChild>
          <Link href="/template">Annulla</Link>
        </Button>
      </div>
    </form>
  )
}
