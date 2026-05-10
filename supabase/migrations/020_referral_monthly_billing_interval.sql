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
--      - ADD UNIQUE(referrer_workspace_id, reward_month) — al massimo 1 premio
--        per referrer per mese, indipendentemente da quanti referral attivi ha
-- ============================================================

-- ── 1. workspaces: campo billing_interval ────────────────────────────────
ALTER TABLE workspaces
  ADD COLUMN billing_interval TEXT
  CHECK (billing_interval IN ('month', 'year'));
-- null ammesso implicitamente (no NOT NULL constraint)

COMMENT ON COLUMN workspaces.billing_interval IS
  'Intervallo di fatturazione Stripe: ''month'' o ''year''. '
  'null per piano Free e Lifetime (nessuna subscription ricorrente).';

-- ── 2. referral_rewards: migrazione a modello mensile ────────────────────

-- 2a. Drop unique constraint esistente su referee_workspace_id
--     (nome generato automaticamente da PostgreSQL per la clausola UNIQUE inline)
ALTER TABLE referral_rewards
  DROP CONSTRAINT referral_rewards_referee_workspace_id_key;

-- 2b. Aggiungi colonna reward_month
--     Formato: 'YYYY-MM' (es. '2026-05')
ALTER TABLE referral_rewards
  ADD COLUMN reward_month TEXT;

-- 2c. Backfill: i record esistenti (one-shot) ricevono il mese di created_at
UPDATE referral_rewards
  SET reward_month = to_char(created_at, 'YYYY-MM')
  WHERE reward_month IS NULL;

-- 2d. Ora che tutti i record hanno un valore, rendi la colonna NOT NULL
ALTER TABLE referral_rewards
  ALTER COLUMN reward_month SET NOT NULL;

-- 2e. Nuova unique composita: 1 premio per referrer per mese
ALTER TABLE referral_rewards
  ADD CONSTRAINT referral_rewards_referrer_month_key
  UNIQUE (referrer_workspace_id, reward_month);

-- 2f. Indice per le query del cron (cerca per workspace_id + reward_month)
CREATE INDEX idx_referral_rewards_month
  ON referral_rewards (workspace_id, reward_month);

COMMENT ON COLUMN referral_rewards.reward_month IS
  'Mese per cui il premio è stato emesso, formato YYYY-MM (es. ''2026-05''). '
  'Sostituisce il precedente vincolo UNIQUE su referee_workspace_id: '
  'ora ogni referrer può ricevere al massimo 1 premio al mese.';
