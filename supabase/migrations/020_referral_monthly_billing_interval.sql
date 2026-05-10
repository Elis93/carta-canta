-- ============================================================
-- CARTA CANTA — Migration 020: Referral mensile + billing_interval
--
-- Cambiamenti:
--   1. workspaces.billing_interval TEXT — 'month' | 'year' | null
--      Salvato dal webhook Stripe al momento dell'acquisto/rinnovo.
--      null = piano Free o Lifetime (nessuna subscription ricorrente).
--
--   2. referral_rewards — passaggio da modello one-shot a mensile ricorrente:
--      - DROP UNIQUE(referee_workspace_id) — un referee può generare più
--        premi nei mesi in cui la soglia è soddisfatta
--      - ADD reward_month TEXT — identifica il mese del premio ('2026-05')
--      - ADD UNIQUE(workspace_id, reward_month) — al massimo 1 premio
--        per referrer per mese (workspace_id = referrer nella tabella)
--
-- Nota colonne referral_rewards (da migration 018):
--   workspace_id         = il referrer
--   referee_workspace_id = chi si è iscritto tramite il codice
-- ============================================================

-- ── 1. workspaces: campo billing_interval ────────────────────────────────
ALTER TABLE workspaces
  ADD COLUMN billing_interval TEXT
  CHECK (billing_interval IN ('month', 'year'));

COMMENT ON COLUMN workspaces.billing_interval IS
  'Intervallo di fatturazione Stripe: ''month'' o ''year''. '
  'null per piano Free e Lifetime (nessuna subscription ricorrente).';

-- ── 2. referral_rewards: migrazione a modello mensile ────────────────────

-- 2a. Drop unique constraint su referee_workspace_id
ALTER TABLE referral_rewards
  DROP CONSTRAINT referral_rewards_referee_workspace_id_key;

-- 2b. Aggiungi colonna reward_month (nullable inizialmente per il backfill)
ALTER TABLE referral_rewards
  ADD COLUMN reward_month TEXT;

-- 2c. Backfill: i record esistenti ricevono il mese di created_at
UPDATE referral_rewards
  SET reward_month = to_char(created_at, 'YYYY-MM')
  WHERE reward_month IS NULL;

-- 2d. Rendi la colonna NOT NULL ora che tutti i record hanno un valore
ALTER TABLE referral_rewards
  ALTER COLUMN reward_month SET NOT NULL;

-- 2e. Nuova unique composita: 1 premio per referrer (workspace_id) per mese
ALTER TABLE referral_rewards
  ADD CONSTRAINT referral_rewards_workspace_month_key
  UNIQUE (workspace_id, reward_month);

-- 2f. Indice per le query del cron
CREATE INDEX idx_referral_rewards_month
  ON referral_rewards (workspace_id, reward_month);

COMMENT ON COLUMN referral_rewards.reward_month IS
  'Mese per cui il premio è stato emesso, formato YYYY-MM (es. ''2026-05''). '
  'Vincolo: al massimo 1 premio per referrer (workspace_id) per mese.';
