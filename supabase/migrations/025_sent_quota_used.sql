-- Migration 025: conteggio storico invii piano Free
-- sent_quota_used: incrementato ad ogni primo invio di un preventivo (draft → sent).
-- Non viene mai decrementato, nemmeno se il documento viene eliminato.
-- Garantisce che il limite Free non sia aggirabile con invia + cancella.

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS sent_quota_used INT NOT NULL DEFAULT 0;

-- Inizializza per i workspace esistenti: conta i preventivi non-draft attualmente presenti.
-- È la miglior approssimazione disponibile per i dati storici pre-migration.
UPDATE workspaces w
SET sent_quota_used = (
  SELECT COUNT(*)::INT
  FROM documents d
  WHERE d.workspace_id = w.id
    AND d.doc_type = 'preventivo'
    AND d.status != 'draft'
);
