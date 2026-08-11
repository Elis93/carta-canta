-- ============================================================
-- 080 — LA DATA NASCE ALLA CONFERMA + PILOTA AUTOMATICO SdI
-- (decisioni Eli, 11 ago 2026: «la data di creazione documento parte da
--  quando la bozza viene confermata» · «automatico deve essere default»)
--
-- ① documents.doc_date: la DATA FISCALE del documento — quella che finisce
--    nel campo <Data> dell'XML e da cui corrono i 12 giorni (art. 21 c.4).
--    Si fissa quando la bozza viene CONFERMATA (primo invio al cliente,
--    segna-inviata, segna-pagata): finché è bozza resta NULL e nessun
--    orologio corre. I documenti già fuori bozza prendono come data il
--    giorno di creazione (in fuso italiano): è la data che l'XML usava già.
--
-- ② workspaces.sdi_auto_enabled (default TRUE): il pilota automatico —
--    alla conferma di una fattura l'app programma la trasmissione allo SdI.
--
-- ③ documents.sdi_auto_at: QUANDO è programmata la trasmissione automatica
--    di questo documento (NULL = niente in programma). La scrive la
--    conferma, la esegue il cron, la azzera l'«Annulla» dell'artigiano.
--
-- Idempotente. Nessun GRANT per colonna su documents/workspaces (le due
-- tabelle non usano GRANT per colonna — verificato: la regola B.2 riguarda
-- reviews/marketplace_*).
-- ============================================================

ALTER TABLE documents ADD COLUMN IF NOT EXISTS doc_date DATE;

-- Backfill SOLO fuori bozza: le bozze prendono la data alla conferma.
UPDATE documents
SET doc_date = (created_at AT TIME ZONE 'Europe/Rome')::date
WHERE doc_date IS NULL AND status <> 'draft';

ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS sdi_auto_enabled BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE documents ADD COLUMN IF NOT EXISTS sdi_auto_at TIMESTAMPTZ;

-- Il cron cerca «programmate e scadute»: indice parziale, tabella grande.
CREATE INDEX IF NOT EXISTS idx_documents_sdi_auto
  ON documents (sdi_auto_at)
  WHERE sdi_auto_at IS NOT NULL;
