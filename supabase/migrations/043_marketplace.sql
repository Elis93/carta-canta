-- ============================================================
-- 043 — MARKETPLACE MVP (mockup crescita §3, approvato)
-- Directory pubblica OPT-IN: profilo spento di default, verifica
-- automatica prima della pubblicazione (VIES + email + profilo completo).
-- Richieste dei clienti nella sezione "Richieste" in app.
-- ============================================================

-- ── Profilo pubblico (1 per workspace, opt-in) ──────────────────────────
CREATE TABLE IF NOT EXISTS marketplace_profiles (
  workspace_id UUID PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  enabled      BOOLEAN NOT NULL DEFAULT false,   -- toggle dell'artigiano
  public_name  TEXT NOT NULL DEFAULT '',
  trade        TEXT NOT NULL DEFAULT '',          -- mestiere (es. "Idraulico")
  city         TEXT NOT NULL DEFAULT '',          -- comune base
  radius_km    INT NOT NULL DEFAULT 30,
  phone        TEXT,
  bio          TEXT,                              -- presentazione breve
  vies_checked_at TIMESTAMPTZ,                    -- ultima verifica VIES ok
  published_at TIMESTAMPTZ,                       -- null = bozza (non visibile)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE marketplace_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "marketplace_profiles_own" ON marketplace_profiles;
CREATE POLICY "marketplace_profiles_own" ON marketplace_profiles
  USING (workspace_id IN (SELECT my_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT my_workspace_ids()));
-- La directory pubblica legge via service role (server-side).

-- ── Richieste dal marketplace ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS marketplace_requests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  customer_name    TEXT NOT NULL,
  customer_contact TEXT NOT NULL,   -- telefono o email
  customer_city    TEXT,
  message          TEXT NOT NULL,   -- che lavoro serve
  status           TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','read','replied')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE marketplace_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "marketplace_requests_own" ON marketplace_requests;
CREATE POLICY "marketplace_requests_own" ON marketplace_requests
  USING (workspace_id IN (SELECT my_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT my_workspace_ids()));
-- L'inserimento avviene SOLO server-side (API pubblica con service role).

CREATE INDEX IF NOT EXISTS idx_marketplace_requests_ws
  ON marketplace_requests(workspace_id, created_at DESC);
