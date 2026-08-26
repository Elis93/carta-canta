'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { updateNotificationPrefs, type NotificationPrefs } from '@/lib/actions/workspace'

// FIX-27: valori di default (usati solo se il DB non ha ancora i prefs)
const DEFAULT_PREFS: NotificationPrefs = {
  preventivo_accettato: true,
  preventivo_rifiutato: true,
  preventivo_scaduto:   true,
  reminder_cliente:     true,
  followup_auto:        false,
  inapp_visto:          true,
  inapp_rifiutato:      true,
  inapp_acconto:        true,
  inapp_preventivo_fermo: true,
  inapp_messaggio:      true,
  inapp_richiamo:       true,
  inapp_richiesta:      true,
  inapp_listino_scaduto: true,
  inapp_sdi_scarto:       true,
  inapp_sdi_trasmissione: true,
}

const SDI_ENABLED = process.env.NEXT_PUBLIC_SDI_ENABLED === 'true'

// ── Stili condivisi (mockup) ────────────────────────────────────────────────
const cardStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 14,
  boxShadow: '0 1px 2px rgba(20,20,40,.05), 0 8px 24px -10px rgba(20,20,40,.15)',
  padding: '15px 15px',
}

// ── Toggle switch (mockup: 42×24, navy=on, grigio=off) ──────────────────────
function ToggleSwitch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation()
        onChange(!checked)
      }}
      style={{
        width: 42,
        height: 24,
        borderRadius: 999,
        background: checked ? '#1a1a2e' : '#e3e3e6',
        position: 'relative',
        flex: '0 0 auto',
        border: 'none',
        padding: 0,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'background .15s',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: checked ? 20 : 2,
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: checked ? 'none' : '0 1px 2px rgba(0,0,0,.2)',
          transition: 'left .15s',
        }}
      />
    </button>
  )
}

interface ImpostazioniNotificheProps {
  initialPrefs?: NotificationPrefs | null
}

export function ImpostazioniNotifiche({ initialPrefs }: ImpostazioniNotificheProps) {
  const [prefs, setPrefs] = useState<NotificationPrefs>(initialPrefs ?? DEFAULT_PREFS)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // FIX-27: salvataggio immediato — niente pulsante "Salva preferenze"
  function setNotif(key: keyof NotificationPrefs, value: boolean) {
    if (prefs[key] === value) return
    const prevPrefs = prefs
    const newPrefs = { ...prefs, [key]: value }
    setPrefs(newPrefs)
    setError(null)
    startTransition(async () => {
      const result = await updateNotificationPrefs(newPrefs)
      if (result?.error) {
        setError(result.error)
        setPrefs(prevPrefs)
      } else {
        // Conferma visibile del salvataggio automatico (feedback Eli 5 lug)
        toast.success('Preferenze salvate', { closeButton: true })
      }
    })
  }

  return (
    <div>
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div style={cardStyle}>
        <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: '#6f6d64', marginBottom: 5 }}>
          Notifiche preventivi
        </div>
        <div style={{ fontSize: 12, color: '#767676', lineHeight: 1.45, marginBottom: 13 }}>
          Email che ricevi quando un cliente interagisce con i tuoi preventivi.
        </div>

        <NotifRow
          label="Preventivo accettato"
          description={'Il cliente ha accettato il preventivo'}
          checked={prefs.preventivo_accettato}
          onChange={(v) => setNotif('preventivo_accettato', v)}
          disabled={isPending}
        />
        <Divider />
        <NotifRow
          label="Preventivo rifiutato"
          description={'Il cliente ha rifiutato il preventivo'}
          checked={prefs.preventivo_rifiutato}
          onChange={(v) => setNotif('preventivo_rifiutato', v)}
          disabled={isPending}
        />
        <Divider />
        <NotifRow
          label="Preventivo scaduto"
          description="Un preventivo inviato è scaduto senza risposta"
          checked={prefs.preventivo_scaduto}
          onChange={(v) => setNotif('preventivo_scaduto', v)}
          disabled={isPending}
        />
        <Divider />
        <NotifRow
          label="Reminder automatico al cliente"
          description="Email al cliente 1 giorno prima della scadenza"
          checked={prefs.reminder_cliente}
          onChange={(v) => setNotif('reminder_cliente', v)}
          disabled={isPending}
        />
        <Divider />
        <NotifRow
          label="Follow-up automatico"
          description="Se il cliente non risponde, invia un promemoria dopo 3 giorni (una sola volta)"
          checked={prefs.followup_auto === true}
          onChange={(v) => setNotif('followup_auto', v)}
          disabled={isPending}
        />
      </div>

      {/* ── Notifiche in app (campanella in Home) ── */}
      <div style={{ ...cardStyle, marginTop: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: '#6f6d64', marginBottom: 5 }}>
          Notifiche in app
        </div>
        <div style={{ fontSize: 12, color: '#767676', lineHeight: 1.45, marginBottom: 13 }}>
          Avvisi nella campanella in alto nella Home.
        </div>

        <NotifRow
          label="Preventivo visto dal cliente"
          description="Il cliente ha aperto il preventivo"
          checked={prefs.inapp_visto !== false}
          onChange={(v) => setNotif('inapp_visto', v)}
          disabled={isPending}
        />
        <Divider />
        <NotifRow
          label="Preventivo rifiutato"
          description="Il cliente ha rifiutato: puoi modificarlo e rinviarlo"
          checked={prefs.inapp_rifiutato !== false}
          onChange={(v) => setNotif('inapp_rifiutato', v)}
          disabled={isPending}
        />
        <Divider />
        <NotifRow
          label="Acconto in attesa"
          description="Preventivo accettato con acconto non ancora ricevuto"
          checked={prefs.inapp_acconto !== false}
          onChange={(v) => setNotif('inapp_acconto', v)}
          disabled={isPending}
        />
        <Divider />
        <NotifRow
          label="Preventivo fermo da giorni"
          description="Promemoria quando un preventivo inviato resta 7 giorni senza risposta"
          checked={prefs.inapp_preventivo_fermo !== false}
          onChange={(v) => setNotif('inapp_preventivo_fermo', v)}
          disabled={isPending}
        />
        <Divider />
        <NotifRow
          label="Clienti da richiamare"
          description="Promemoria manutenzioni impostati sui Lavori"
          checked={prefs.inapp_richiamo !== false}
          onChange={(v) => setNotif('inapp_richiamo', v)}
          disabled={isPending}
        />
        <Divider />
        <NotifRow
          label="Richieste dalla vetrina"
          description="Nuove richieste di contatto da Fatti trovare dai clienti"
          checked={prefs.inapp_richiesta !== false}
          onChange={(v) => setNotif('inapp_richiesta', v)}
          disabled={isPending}
        />
        <Divider />
        <NotifRow
          label="Listino fornitore scaduto"
          description="Quando un preventivo ancora aperto usa i prezzi di un listino scaduto"
          checked={prefs.inapp_listino_scaduto !== false}
          onChange={(v) => setNotif('inapp_listino_scaduto', v)}
          disabled={isPending}
        />
        {SDI_ENABLED && (
          <>
            <Divider />
            <NotifRow
              label="Fatture pagate non trasmesse allo SdI"
              description="Promemoria di trasmissione al Sistema di Interscambio"
              checked={prefs.inapp_sdi_trasmissione !== false}
              onChange={(v) => setNotif('inapp_sdi_trasmissione', v)}
              disabled={isPending}
            />
          </>
        )}

        {/* «Messaggio dal cliente» e «Fattura scartata dallo SdI» restano sempre
            attivi (lib/notifications.ts non ha un interruttore per loro), ma non
            lo spieghiamo più qui: Eli «non avvisiamo e basta» (16 ago). */}
      </div>

      {/* F15: niente dicitura "salvate automaticamente" — il toast di conferma basta */}
    </div>
  )
}

function Divider() {
  return <div style={{ height: '0.5px', background: '#eee', margin: '13px -15px' }} />
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
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 14,
        opacity: disabled ? 0.6 : 1,
        cursor: disabled ? 'default' : 'pointer',
      }}
      onClick={!disabled ? () => onChange(!checked) : undefined}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: '#161616' }}>{label}</div>
        <div style={{ fontSize: 12, color: '#767676', marginTop: 2, lineHeight: 1.4 }}>{description}</div>
      </div>
      <ToggleSwitch checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  )
}
