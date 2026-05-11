-- Migration 024: free_trial_expires_at on workspaces
-- Free plan: 8 preventivi totali + 30 giorni di trial dall'iscrizione.
-- Blocco scatta al primo dei due limiti: scadenza tempo o raggiungimento quota.

ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS free_trial_expires_at TIMESTAMPTZ;

-- Backfill: workspace Free esistenti ottengono 30 giorni dal deploy
UPDATE workspaces
SET free_trial_expires_at = NOW() + INTERVAL '30 days'
WHERE plan = 'free' AND free_trial_expires_at IS NULL;

-- Trigger: imposta automaticamente per i nuovi workspace al momento dell'INSERT
CREATE OR REPLACE FUNCTION trg_set_free_trial_expires_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.free_trial_expires_at IS NULL THEN
    NEW.free_trial_expires_at := NEW.created_at + INTERVAL '30 days';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_free_trial_expires_at ON workspaces;
CREATE TRIGGER set_free_trial_expires_at
  BEFORE INSERT ON workspaces
  FOR EACH ROW EXECUTE FUNCTION trg_set_free_trial_expires_at();
