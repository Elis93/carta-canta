-- 006_notification_prefs.sql
-- Aggiunge colonna JSONB per le preferenze di notifica al workspace.
-- Default: tutte le notifiche attive tranne il riepilogo settimanale.

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS notification_prefs jsonb NOT NULL DEFAULT '{
    "preventivo_accettato": true,
    "preventivo_rifiutato": true,
    "preventivo_scaduto": true,
    "reminder_cliente": true,
    "pagamento_ok": true,
    "pagamento_fallito": true,
    "summary_settimanale": false
  }'::jsonb;
