'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
  const [state, formAction, isPending] = useActionState(saveDefaultSettingsAction, null)
  const [showWatermark, setShowWatermark] = useState(defaultShowWatermark)
  const [legalNotice,   setLegalNotice]   = useState(defaultLegalNotice)

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="show_watermark" value={String(showWatermark)} />

      {state?.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      {/* Branding switch */}
      <div className="flex items-center justify-between gap-4 rounded-xl border p-4">
        <div>
          <p className="text-sm font-medium">Branding &quot;Generato con Carta Canta&quot;</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Filigrana diagonale e riga nel piè di pagina del documento
          </p>
        </div>
        <Switch checked={showWatermark} onCheckedChange={setShowWatermark} />
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
        <Button type="submit" disabled={isPending}>
          {isPending
            ? <><Loader2 className="size-4 animate-spin" />Salvataggio…</>
            : 'Salva'}
        </Button>
        <Button variant="outline" asChild>
          <Link href="/template">Annulla</Link>
        </Button>
      </div>
    </form>
  )
}
