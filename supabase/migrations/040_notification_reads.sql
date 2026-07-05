-- 040 — NOTIFICHE IN HOME (campanella): stato di lettura per notifica
-- Decisione Eli 5 lug 2026: il pallino blu "non letta" resta finché
-- l'artigiano non tocca QUELLA notifica. Le notifiche si CALCOLANO dai
-- dati esistenti (viste, acconti, SDI...) — qui si salva solo la lettura.

CREATE TABLE IF NOT EXISTS notification_reads (
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  notif_key    TEXT NOT NULL,   -- es. 'viewed:{doc_id}' · 'acconto:{doc_id}'
  read_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, notif_key)
);

ALTER TABLE notification_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notification_reads_workspace" ON notification_reads
  USING (workspace_id IN (SELECT my_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT my_workspace_ids()));
