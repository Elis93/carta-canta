-- 037: Tutorial primo accesso — flag "tour completato/saltato" sul workspace.
-- Il flag segue l'utente su ogni dispositivo (preferito a localStorage).
ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS onboarding_tour_done BOOLEAN NOT NULL DEFAULT false;

-- Gli account esistenti non devono vedere il tour retroattivamente.
UPDATE workspaces SET onboarding_tour_done = true;
