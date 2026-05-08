'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { updateNotificationPrefs, type NotificationPrefs } from '@/lib/actions/workspace'

// FIX-27: valori di default (usati solo se il DB non ha ancora i prefs)
const DEFAULT_PREFS: NotificationPrefs = {
  preventivo_accettato: true,
  preventivo_rifiutato: true,
  preventivo_scaduto:   true,
  reminder_cliente:     true,
  pagamento_ok:         true,
  pagamento_fallito:    true,
}

interface ImpostazioniNotificheProps {
  initialPrefs?: NotificationPrefs | null
}

export function ImpostazioniNotifiche({ initialPrefs }: ImpostazioniNotificheProps) {
  const [prefs, setPrefs] = useState<NotificationPrefs>(initialPrefs ?? DEFAULT_PREFS)
  const [error, setError] = useState<string | null>(null)
  // FIX-27: isPending mostra un leggero stato di caricamento sugli switch durante il salvataggio
  const [isPending, startTransition] = useTransition()

  // FIX-27: salvataggio immediato al toggle — niente pulsante "Salva preferenze"
  function toggle(key: keyof NotificationPrefs) {
    const prevPrefs = prefs
    const newPrefs = { ...prefs, [key]: !prefs[key] }
    setPrefs(newPrefs)   // aggiornamento ottimistico
    setError(null)
    startTransition(async () => {
      const result = await updateNotificationPrefs(newPrefs)
      if (result?.error) {
        setError(result.error)
        setPrefs(prevPrefs)  // ripristina in caso di errore server
      }
    })
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notifiche preventivi</CardTitle>
          <CardDescription>
            Email che ricevi quando un cliente interagisce con i tuoi preventivi.
          </CardDescription>
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

      {/* FIX-27: niente pulsante "Salva" — ogni toggle salva automaticamente nel DB */}
      <p className="text-xs text-muted-foreground">
        Le modifiche vengono salvate automaticamente.
      </p>
    </div>
  )
}

// ── NotifRow ──────────────────────────────────────────────────────────────

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
      <div className="flex items-center gap-2 shrink-0">
        <span className={`text-xs font-semibold w-6 text-right transition-colors ${
          checked && !disabled ? 'text-primary' : 'text-muted-foreground'
        }`}>
          {checked ? 'ON' : 'OFF'}
        </span>
        <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
      </div>
    </div>
  )
}
