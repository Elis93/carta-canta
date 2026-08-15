import type { NotificationPrefs } from '@/lib/actions/workspace'

// Estrae e normalizza le preferenze notifiche dal workspace (default: attive,
// tranne il follow-up automatico). Era inline nella pagina Impostazioni; ora è
// condiviso dalla sotto-pagina Notifiche.
export function extractNotifPrefs(rawPrefs: Record<string, unknown> | null): NotificationPrefs | null {
  if (!rawPrefs) return null
  return {
    preventivo_accettato: rawPrefs.preventivo_accettato !== false,
    preventivo_rifiutato: rawPrefs.preventivo_rifiutato !== false,
    preventivo_scaduto:   rawPrefs.preventivo_scaduto   !== false,
    reminder_cliente:     rawPrefs.reminder_cliente     !== false,
    followup_auto:        rawPrefs.followup_auto        === true,
    inapp_visto:          rawPrefs.inapp_visto          !== false,
    inapp_acconto:        rawPrefs.inapp_acconto        !== false,
    inapp_richiamo:       rawPrefs.inapp_richiamo       !== false,
    inapp_richiesta:      rawPrefs.inapp_richiesta      !== false,
    inapp_preventivo_fermo: rawPrefs.inapp_preventivo_fermo !== false,
    inapp_messaggio:      rawPrefs.inapp_messaggio      !== false,
    inapp_sdi_scarto:       rawPrefs.inapp_sdi_scarto       !== false,
    inapp_sdi_trasmissione: rawPrefs.inapp_sdi_trasmissione !== false,
  }
}
