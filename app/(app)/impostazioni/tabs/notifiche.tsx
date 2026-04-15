'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

// Preferenze notifiche — in Fase 1 si salveranno su DB.
// Per ora sono gestite lato client con stato locale.
const DEFAULT_PREFS = {
  preventivo_accettato: true,
  preventivo_rifiutato: true,
  preventivo_scaduto: true,
  reminder_cliente: true,
  pagamento_ok: true,
  pagamento_fallito: true,
  summary_settimanale: false,
}

type NotifPrefs = typeof DEFAULT_PREFS

export function ImpostazioniNotifiche() {
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_PREFS)
  const [saved, setSaved] = useState(false)

  function toggle(key: keyof NotifPrefs) {
    setPrefs((p) => ({ ...p, [key]: !p[key] }))
    setSaved(false)
  }

  function handleSave() {
    // TODO Fase 1: salvare su DB in tabella notification_preferences
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="space-y-6">
      {saved && (
        <Alert>
          <AlertDescription>Preferenze notifiche salvate.</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notifiche preventivi</CardTitle>
          <CardDescription>Email che ricevi quando un cliente interagisce con i tuoi preventivi.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <NotifRow
            label="Preventivo accettato"
            description="Il cliente ha cliccato 'Accetto'"
            checked={prefs.preventivo_accettato}
            onChange={() => toggle('preventivo_accettato')}
          />
          <Separator />
          <NotifRow
            label="Preventivo rifiutato"
            description="Il cliente ha cliccato 'Declino'"
            checked={prefs.preventivo_rifiutato}
            onChange={() => toggle('preventivo_rifiutato')}
          />
          <Separator />
          <NotifRow
            label="Preventivo scaduto"
            description="Un preventivo inviato è scaduto senza risposta"
            checked={prefs.preventivo_scaduto}
            onChange={() => toggle('preventivo_scaduto')}
          />
          <Separator />
          <NotifRow
            label="Reminder automatico al cliente"
            description="Email automatica al cliente dopo 7 giorni senza risposta"
            checked={prefs.reminder_cliente}
            onChange={() => toggle('reminder_cliente')}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notifiche pagamenti</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <NotifRow
            label="Pagamento andato a buon fine"
            description="Conferma attivazione/rinnovo piano"
            checked={prefs.pagamento_ok}
            onChange={() => toggle('pagamento_ok')}
          />
          <Separator />
          <NotifRow
            label="Problema con il pagamento"
            description="Notifica se il metodo di pagamento fallisce"
            checked={prefs.pagamento_fallito}
            onChange={() => toggle('pagamento_fallito')}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Report periodici</CardTitle>
        </CardHeader>
        <CardContent>
          <NotifRow
            label="Riepilogo settimanale"
            description="Email ogni lunedì con i KPI della settimana"
            checked={prefs.summary_settimanale}
            onChange={() => toggle('summary_settimanale')}
          />
        </CardContent>
      </Card>

      <Button onClick={handleSave}>Salva preferenze</Button>
    </div>
  )
}

function NotifRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}
