'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2 } from 'lucide-react'
import { updateNotificationPrefs, type NotificationPrefs } from '@/lib/actions/workspace'

const DEFAULT_PREFS: NotificationPrefs = {
  preventivo_accettato: true,
  preventivo_rifiutato: true,
  preventivo_scaduto: true,
  reminder_cliente: true,
  pagamento_ok: true,
  pagamento_fallito: true,
  summary_settimanale: false,
}

interface ImpostazioniNotificheProps {
  initialPrefs?: NotificationPrefs | null
}

export function ImpostazioniNotifiche({ initialPrefs }: ImpostazioniNotificheProps) {
  const [prefs, setPrefs] = useState<NotificationPrefs>(initialPrefs ?? DEFAULT_PREFS)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  function toggle(key: keyof NotificationPrefs) {
    setPrefs((p) => ({ ...p, [key]: !p[key] }))
    setMessage(null)
  }

  function handleSave() {
    startTransition(async () => {
      const result = await updateNotificationPrefs(prefs)
      if (!result || result.error) {
        setMessage({ type: 'error', text: result?.error ?? 'Errore nel salvataggio.' })
      } else {
        setMessage({ type: 'success', text: result.success ?? 'Preferenze salvate.' })
        setTimeout(() => setMessage(null), 3000)
      }
    })
  }

  return (
    <div className="space-y-6">
      {message && (
        <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
          <AlertDescription>{message.text}</AlertDescription>
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
            disabled={isPending}
          />
          <Separator />
          <NotifRow
            label="Preventivo rifiutato"
            description="Il cliente ha cliccato 'Declino'"
            checked={prefs.preventivo_rifiutato}
            onChange={() => toggle('preventivo_rifiutato')}
            disabled={isPending}
          />
          <Separator />
          <NotifRow
            label="Preventivo scaduto"
            description="Un preventivo inviato è scaduto senza risposta"
            checked={prefs.preventivo_scaduto}
            onChange={() => toggle('preventivo_scaduto')}
            disabled={isPending}
          />
          <Separator />
          <NotifRow
            label="Reminder automatico al cliente"
            description="Email automatica al cliente 1 giorno prima della scadenza del preventivo"
            checked={prefs.reminder_cliente}
            onChange={() => toggle('reminder_cliente')}
            disabled={isPending}
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
            disabled={isPending}
          />
          <Separator />
          <NotifRow
            label="Problema con il pagamento"
            description="Notifica se il metodo di pagamento fallisce"
            checked={prefs.pagamento_fallito}
            onChange={() => toggle('pagamento_fallito')}
            disabled={isPending}
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
            disabled={isPending}
          />
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={isPending}>
        {isPending && <Loader2 className="size-4 animate-spin mr-2" />}
        Salva preferenze
      </Button>
    </div>
  )
}

function NotifRow({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string
  description: string
  checked: boolean
  onChange: () => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  )
}
