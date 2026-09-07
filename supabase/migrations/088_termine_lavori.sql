-- 088 — Termine dei lavori sul preventivo («entro N giorni dalla conferma»)
-- Richiesta di Eli, 6 set 2026 (feedback n. 6): «Inserire in preventivo quando
-- è previsto il termine dei lavori (tipo 30 giorni da conferma preventivo)».
-- Scelta sua: GIORNI dalla conferma, non una data fissa — una data scritta
-- prima che il cliente accetti invecchia da sola.
--
-- documents.work_days        → giorni di calendario dalla conferma (accepted_at).
--                              NULL = non indicato: chi non lo compila non
--                              promette nulla (B.0: è una clausola contrattuale).
-- workspaces.work_days_default → valore proposto sui preventivi NUOVI
--                              (Impostazioni › Generale), facoltativo.
-- Idempotente. Applicabile prima o dopo il deploy: il codice scrive le due
-- colonne con update separati e tolleranti (42703 ignorato).

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS work_days INTEGER NULL;

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS work_days_default INTEGER NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'documents_work_days_range'
  ) THEN
    ALTER TABLE documents
      ADD CONSTRAINT documents_work_days_range
      CHECK (work_days IS NULL OR (work_days BETWEEN 1 AND 365));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'workspaces_work_days_default_range'
  ) THEN
    ALTER TABLE workspaces
      ADD CONSTRAINT workspaces_work_days_default_range
      CHECK (work_days_default IS NULL OR (work_days_default BETWEEN 1 AND 365));
  END IF;
END $$;

COMMENT ON COLUMN documents.work_days IS
  'Tempi di esecuzione: giorni di calendario dalla conferma del preventivo (accepted_at). NULL = non indicato.';
COMMENT ON COLUMN workspaces.work_days_default IS
  'Tempi di esecuzione proposti sui preventivi nuovi (giorni). NULL = nessun default.';
