-- ============================================================
-- 075 — Archivio dei documenti + solleciti spenti
--
-- PERCHÉ (Eli, 8 ago 2026): *"aggiungiamo anche l'opzione per non sollecitare
-- più, e archiviare il documento"*. Sono DUE cose distinte (sua scelta), e qui
-- sono due colonne distinte:
--
--   • `reminders_off_at` — «Non ricordarmelo più»: il documento resta in tutte
--     le liste dov'è sempre stato, ma smette di comparire fra i promemoria
--     (Home, conteggi, pagine delle scadenze). È il rinvio della 074 senza data
--     di ritorno.
--
--   • `archived_at` — «Archivia»: il documento esce dalle liste attive e finisce
--     nella pillola «Archiviati» di Preventivi/Fatture, da cui si può sempre
--     tirare fuori.
--
-- ⚠️ ARCHIVIARE NON È CANCELLARE, ed è la regola che tiene in piedi tutto il
-- resto: il documento resta INTERO — stesso numero, stessa cronologia — e resta
-- nel **Bilancio**, nell'**export CSV**, nel **registro fatture** e nella scheda
-- del cliente. Nessuna di quelle superfici filtra su queste colonne. Cambia solo
-- DOVE lo vedi. Il posto dove un documento sparisce davvero è il cestino
-- (`deleted_at`), che ha il conto alla rovescia di 15 giorni: qui non c'è.
--
-- Nessun effetto fiscale: `expires_at`, `status` e gli importi non si toccano.
--
-- Idempotente: si può rilanciare il file intero senza effetti.
-- ============================================================

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS reminders_off_at TIMESTAMPTZ;

COMMENT ON COLUMN public.documents.archived_at IS
  'Documento archiviato: esce dalle liste attive e compare nella pillola "Archiviati". NULL = attivo. NON è una cancellazione: il documento resta nel Bilancio, negli export e nel registro fatture. Nessun effetto fiscale.';

COMMENT ON COLUMN public.documents.reminders_off_at IS
  'Solleciti spenti per sempre su questo documento: sparisce dai promemoria (Home, conteggi, scadenze) ma resta in tutte le liste. NULL = promemoria attivi. Nessun effetto fiscale.';

-- Indici parziali: le liste filtrano quasi sempre "non archiviato", e le righe
-- archiviate / senza solleciti sono la minoranza.
CREATE INDEX IF NOT EXISTS documents_archived_at_idx
  ON public.documents (workspace_id, doc_type, archived_at)
  WHERE archived_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS documents_reminders_off_idx
  ON public.documents (workspace_id, reminders_off_at)
  WHERE reminders_off_at IS NOT NULL;

-- NOTA: nessun GRANT da estendere — `documents` non ha GRANT per colonna, e la
-- policy di UPDATE esistente copre già le colonne nuove.
