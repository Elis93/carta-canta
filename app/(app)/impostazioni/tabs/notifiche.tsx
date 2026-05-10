'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { OnOffPill } from '@/components/ui/on-off-pill'
import { updateNotificationPrefs, type NotificationPrefs } from '@/lib/actions/workspace'

// FIX-27: valori di default (usati solo se il DB non ha ancora i prefs)
const DEFAULT_PREFS: NotificationPrefs = {
  preventivo_accettato: true,
  preventivo_rifiutato: true,
  preventivo_scaduto:   true,
  reminder_cliente:     true,
}

interface ImpostazioniNotificheProps {
  initialPrefs?: NotificationPrefs | null
}

export function ImpostazioniNotifiche({ initialPrefs }: ImpostazioniNotificheProps) {
  const [prefs, setPrefs] = useState<NotificationPrefs>(initialPrefs ?? DEFAULT_PREFS)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // FIX-27: salvataggio immediato — niente pulsante "Salva preferenze"
  // FIX-5: accetta il valore diretto (boolean) invece di essere un semplice toggle
  function setNotif(key: keyof NotificationPrefs, value: boolean) {
    if (prefs[key] === value) return   // già nel valore corretto, nessuna chiamata server
    const prevPrefs = prefs
    const newPrefs = { ...prefs, [key]: value }
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
            onChange={(v) => setNotif('preventivo_accettato', v)}
            disabled={isPending}
          />
          <Separator />
          <NotifRow
            label="Preventivo rifiutato"
            description="Il cliente ha cliccato 'Declino'"
            checked={prefs.preventivo_rifiutato}
            onChange={(v) => setNotif('preventivo_rifiutato', v)}
            disabled={isPending}
          />
          <Separator />
          <NotifRow
            label="Preventivo scaduto"
            description="Un preventivo inviato è scaduto senza risposta"
            checked={prefs.preventivo_scaduto}
            onChange={(v) => setNotif('preventivo_scaduto', v)}
            disabled={isPending}
          />
          <Separator />
          <NotifRow
            label="Reminder automatico al cliente"
            description="Email automatica al cliente 1 giorno prima della scadenza del preventivo"
            checked={prefs.reminder_cliente}
            onChange={(v) => setNotif('reminder_cliente', v)}
            disabled={isPending}
          />
        </CardContent>
      </Card>

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
  onChange: (value: boolean) => void
  disabled?: boolean
}) {
  return (
    // FIX-4: intera riga cliccabile
    <div
      className={`flex items-center justify-between gap-4 rounded-md px-1 py-0.5 -mx-1 transition-colors ${
        disabled ? 'opacity-60' : 'cursor-pointer hover:bg-muted/40'
      }`}
      onClick={!disabled ? () => onChange(!checked) : undefined}
    >
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {/* FIX-5: OnOffPill invece di Switch + span ON/OFF separato */}
      <div
        className="shrink-0"
        onClick={(e) => e.stopPropagation()} // evita doppio toggle (riga + pill)
      >
        <OnOffPill
          checked={checked}
          onChange={onChange}
          disabled={disabled}
        />
      </div>
    </div>
  )
}
