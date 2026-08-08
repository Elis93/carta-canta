-- ============================================================
-- 074 — «Posticipa il sollecito»
--
-- PERCHÉ (Eli, 8 ago 2026): *"se un preventivo è in scadenza e lo vedo nella
-- Home ma per il momento non voglio mandare il sollecito, voglio poterlo
-- posticipare, altrimenti continuo a vedere sempre e solo quello in Home"*.
--
-- Un documento posticipato sparisce dalla sezione «In scadenza» della Home e
-- dai due conteggi FINO alla data scelta, poi torna da solo. ⚠️ Non cambia
-- nulla di fiscale e non tocca la scadenza vera (`expires_at`): è solo un
-- promemoria rimandato. Il documento resta in tutte le liste, e nella pagina
-- delle scadenze si vede che è posticipato, con il modo per riprenderlo.
--
-- Idempotente: si può rilanciare il file intero senza effetti.
-- ============================================================

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS snooze_until TIMESTAMPTZ;

COMMENT ON COLUMN public.documents.snooze_until IS
  'Sollecito posticipato: fino a questa data il documento non compare nella sezione "In scadenza" della Home. NULL = nessun rinvio. Non ha effetti fiscali.';

-- Indice parziale: le query della Home filtrano sempre "non posticipato o
-- rinvio scaduto", e le righe con un rinvio attivo sono poche.
CREATE INDEX IF NOT EXISTS documents_snooze_until_idx
  ON public.documents (workspace_id, snooze_until)
  WHERE snooze_until IS NOT NULL;

-- NOTA: nessun GRANT da estendere — `documents` non ha GRANT per colonna, la
-- policy di UPDATE esistente copre già la colonna nuova.
