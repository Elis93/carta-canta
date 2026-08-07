-- ============================================================
-- 073 — Giorni di preavviso della card "In scadenza" della Home
--
-- PERCHÉ: la Home mostrava SEMPRE il documento più urgente, anche se scadeva
-- fra un mese (Eli, 7 ago 2026: "ho un preventivo che scade tra un mese e
-- compare nella card in scadenza"). Chi lavora su commesse brevi vuole
-- vedere solo quello che scade fra pochi giorni, chi lavora su lavori lunghi
-- vuole più preavviso. Ora la finestra è dell'artigiano.
--
-- DEFAULT 10 giorni (scelta di Eli). Il vincolo tiene il valore in un
-- intervallo sensato: sotto 1 la card non comparirebbe mai, sopra 90 non
-- sarebbe più "in scadenza".
--
-- Idempotente: si può rilanciare il file intero senza effetti.
-- ============================================================

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS scadenza_alert_days INTEGER NOT NULL DEFAULT 10;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.workspaces'::regclass
      AND conname  = 'workspaces_scadenza_alert_days_range'
  ) THEN
    ALTER TABLE public.workspaces
      ADD CONSTRAINT workspaces_scadenza_alert_days_range
      CHECK (scadenza_alert_days BETWEEN 1 AND 90);
  END IF;
END $$;

COMMENT ON COLUMN public.workspaces.scadenza_alert_days IS
  'Giorni di preavviso della card "In scadenza" in Home: un documento compare solo se scade entro questi giorni.';

-- NOTA: nessun GRANT da estendere. `workspaces` non ha GRANT per colonna
-- (quelli riguardano reviews, marketplace_profiles e marketplace_requests),
-- quindi la policy di UPDATE esistente copre già la colonna nuova.
