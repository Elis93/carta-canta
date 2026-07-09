-- ============================================================
-- 051 — CANALE COMMERCIALISTI, FASE B: invito + accesso studio
-- Collega un commercialista (per email) a un workspace in SOLA LETTURA.
-- L'artigiano invita l'email dello studio; il commercialista accede a
-- /studio (autenticato, email confermata) e vede i clienti che l'hanno
-- invitato. Revocabile in un tocco dall'artigiano.
--
-- SICUREZZA: RLS abilitata SENZA policy → la tabella è raggiungibile solo
-- dal service role (admin client), con controlli espliciti nel codice
-- (mai riusare workspace_members, le cui policy non applicano il ruolo).
-- Idempotente.
-- ============================================================

CREATE TABLE IF NOT EXISTS accountant_links (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  accountant_email    TEXT NOT NULL,
  accountant_user_id  UUID,               -- valorizzato al primo accesso del commercialista
  token               UUID NOT NULL DEFAULT gen_random_uuid(),  -- per il link dell'email d'invito
  invited_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at         TIMESTAMPTZ,        -- quando il commercialista collega il suo account
  revoked_at          TIMESTAMPTZ         -- revoca lato artigiano
);

-- Un solo invito per (workspace, email), case-insensitive
CREATE UNIQUE INDEX IF NOT EXISTS idx_accountant_links_ws_email
  ON accountant_links(workspace_id, lower(accountant_email));

-- Lookup rapido dei link attivi per email (area /studio del commercialista)
CREATE INDEX IF NOT EXISTS idx_accountant_links_email_active
  ON accountant_links(lower(accountant_email)) WHERE revoked_at IS NULL;

ALTER TABLE accountant_links ENABLE ROW LEVEL SECURITY;
-- Nessuna policy: accesso esclusivamente via service role con controlli nel codice.
