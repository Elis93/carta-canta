-- ============================================================
-- 071 — Registro degli eventi di sicurezza (5 ago 2026)
--
-- PERCHÉ. Dall'audit di copertura: oggi non esiste NESSUNA traccia di cosa
-- succede sugli account. Se qualcuno provasse cinquecento password al minuto,
-- o scaricasse l'intero archivio di un artigiano, non lo sapremmo — né sul
-- momento né dopo. Il rilevamento delle anomalie non "manca": è impossibile,
-- perché non c'è niente da guardare.
--
-- Si parte dal registro e NON dagli allarmi, di proposito: un allarme
-- costruito senza storico non si sa interpretare (quanti login falliti sono
-- "tanti"?). Prima si raccoglie, poi si decidono le soglie sui numeri veri.
-- ⚠️ E i dati che non si registrano oggi non si possono guardare domani: il
-- giorno in cui serviranno sarà il giorno peggiore.
--
-- ⚠️ NON URGENTE: il codice che scrive qui è già in produzione ed è
-- TOLLERANTE — finché questa tabella non esiste non fa nulla, in silenzio,
-- senza rompere né rallentare niente. Si applica quando si vuole.
--
-- ── DUE REGOLE DI DISEGNO, perché il registro non diventi un bersaglio ──
--
--  1. L'INDIRIZZO IP NON SI SCRIVE MAI IN CHIARO: si salva l'impronta
--     (SHA-256 con un sale del server, variabile SECURITY_EVENT_SALT).
--     Serve a rispondere a "è sempre lo stesso?", non a "chi è". Senza il
--     sale configurato il codice non scrive nulla in `ip_hash`: lo spazio
--     IPv4 è così piccolo che un'impronta senza sale si inverte con una
--     tabella precalcolata, cioè sarebbe l'indirizzo in chiaro travestito.
--  2. In `meta` vanno SOLO etichette e conteggi nostri. Mai testi scritti
--     dall'utente, mai nomi, email, IBAN, numeri di documento: altrimenti
--     ricreiamo qui l'archivio di dati personali che proteggiamo altrove.
--
-- RLS attiva SENZA policy: stessa scelta di `accountant_links`. Nessuno può
-- leggerla o scriverla dal client — si passa solo dal server con la chiave di
-- servizio. Per un registro di sicurezza è l'unico disegno sensato: se
-- l'utente potesse leggerlo saprebbe cosa vediamo, se potesse scriverlo
-- potrebbe inquinarlo.
--
-- Idempotente.
-- ============================================================

CREATE TABLE IF NOT EXISTS security_events (
  id           BIGSERIAL PRIMARY KEY,
  at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  kind         TEXT        NOT NULL,
  workspace_id UUID        REFERENCES workspaces(id) ON DELETE SET NULL,
  user_id      UUID,       -- nessuna FK: l'evento deve sopravvivere alla
                           -- cancellazione dell'account (es. login falliti)
  ip_hash      TEXT,       -- impronta, MAI l'indirizzo (vedi regola 1)
  meta         JSONB       NOT NULL DEFAULT '{}'::jsonb
);

-- Le interrogazioni utili sono sempre "questo tipo di evento, di recente".
CREATE INDEX IF NOT EXISTS security_events_kind_at   ON security_events (kind, at DESC);
CREATE INDEX IF NOT EXISTS security_events_ws_at     ON security_events (workspace_id, at DESC);

ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;
-- Nessuna policy: accesso esclusivo alla chiave di servizio (vedi testata).

-- ── Conservazione: 90 giorni ────────────────────────────────────────────
-- Abbastanza per ricostruire un incidente, poco abbastanza da non diventare
-- un archivio storico di abitudini degli utenti. La chiama il cron notturno.
CREATE OR REPLACE FUNCTION purge_old_security_events()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM security_events WHERE at < now() - INTERVAL '90 days';
$$;
