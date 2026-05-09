-- ============================================================
-- CARTA CANTA — Migration 018: Referral System
--
-- Tabelle:
--   referral_codes   — codice univoco per workspace (auto-generato al signup)
--   referral_uses    — registra chi si è iscritto tramite un codice
--   referral_rewards — premi maturati (1 mese free per ogni referee convertito)
--
-- Trigger: auto-crea il codice referral ad ogni INSERT su workspaces.
-- Funzione RPC: get_or_create_referral_code(workspace_id) — idempotente.
-- ============================================================

-- ── Funzione: genera codice alfanumerico 6 char univoco ───────────────────
-- Usa alfabeto senza ambiguità visive (no I, O, 0, 1)
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code  TEXT;
  i     INT;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..6 LOOP
      code := code || substr(chars, floor(random() * length(chars))::int + 1, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM referral_codes WHERE referral_codes.code = code
    );
  END LOOP;
  RETURN code;
END;
$$;

-- ── Tabella: referral_codes ───────────────────────────────────────────────
CREATE TABLE referral_codes (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID        NOT NULL UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,
  code          TEXT        NOT NULL UNIQUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Tabella: referral_uses ────────────────────────────────────────────────
-- Registrata al momento della registrazione del referee.
-- referee_workspace_id è UNIQUE: ogni workspace può essere "referred" una sola volta.
CREATE TABLE referral_uses (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_workspace_id  UUID        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  referee_workspace_id   UUID        NOT NULL UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,
  code                   TEXT        NOT NULL,
  used_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Tabella: referral_rewards ─────────────────────────────────────────────
-- Un record per ogni referee che è passato a piano pagamento.
-- referee_workspace_id UNIQUE: al massimo 1 premio per referee (no doppi premi).
CREATE TABLE referral_rewards (
  id                            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id                  UUID        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  referee_workspace_id          UUID        NOT NULL UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,
  free_months                   INT         NOT NULL DEFAULT 1,
  credit_amount_cents           INT         NOT NULL DEFAULT 1900,
  stripe_balance_transaction_id TEXT,
  applied_at                    TIMESTAMPTZ,          -- NULL = in attesa (no stripe_customer_id ancora)
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indici ────────────────────────────────────────────────────────────────
CREATE INDEX idx_referral_uses_referrer ON referral_uses (referrer_workspace_id);
CREATE INDEX idx_referral_rewards_workspace ON referral_rewards (workspace_id);

-- ── Trigger: auto-crea codice referral ad ogni nuovo workspace ────────────
CREATE OR REPLACE FUNCTION trg_auto_create_referral_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO referral_codes (workspace_id, code)
  VALUES (NEW.id, generate_referral_code())
  ON CONFLICT (workspace_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER workspace_referral_code_insert
  AFTER INSERT ON workspaces
  FOR EACH ROW
  EXECUTE FUNCTION trg_auto_create_referral_code();

-- ── RPC: get_or_create_referral_code — idempotente ───────────────────────
CREATE OR REPLACE FUNCTION get_or_create_referral_code(p_workspace_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code TEXT;
BEGIN
  SELECT code INTO v_code
  FROM referral_codes
  WHERE workspace_id = p_workspace_id;

  IF v_code IS NULL THEN
    v_code := generate_referral_code();
    INSERT INTO referral_codes (workspace_id, code)
    VALUES (p_workspace_id, v_code)
    ON CONFLICT (workspace_id) DO UPDATE SET code = referral_codes.code
    RETURNING code INTO v_code;
  END IF;

  RETURN v_code;
END;
$$;

-- ── Genera codici per tutti i workspace esistenti ─────────────────────────
DO $$
DECLARE
  ws RECORD;
BEGIN
  FOR ws IN SELECT id FROM workspaces LOOP
    PERFORM get_or_create_referral_code(ws.id);
  END LOOP;
END;
$$;

-- ── RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE referral_codes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_uses     ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_rewards  ENABLE ROW LEVEL SECURITY;

-- Helper: set degli workspace_id accessibili dall'utente corrente
-- (owner oppure membro accettato)
CREATE OR REPLACE FUNCTION my_workspace_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM workspaces WHERE owner_id = auth.uid()
  UNION
  SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND accepted_at IS NOT NULL;
$$;

-- referral_codes: l'owner/membro vede solo il proprio codice
CREATE POLICY "referral_codes_select"
  ON referral_codes FOR SELECT
  USING (workspace_id IN (SELECT my_workspace_ids()));

-- referral_uses: il referrer vede chi si è iscritto col suo codice
CREATE POLICY "referral_uses_referrer_select"
  ON referral_uses FOR SELECT
  USING (referrer_workspace_id IN (SELECT my_workspace_ids()));

-- referral_rewards: il beneficiario vede i propri premi
CREATE POLICY "referral_rewards_select"
  ON referral_rewards FOR SELECT
  USING (workspace_id IN (SELECT my_workspace_ids()));
