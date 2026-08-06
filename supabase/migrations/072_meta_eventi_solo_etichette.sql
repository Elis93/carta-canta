-- ============================================================
-- 072 — Il registro eventi non può accettare testi dell'utente (5 ago 2026)
--
-- PERCHÉ. La 071 dice — a parole, in un commento — che in `meta` vanno solo
-- etichette e conteggi nostri, mai nomi, email, IBAN o testi scritti
-- dall'utente. Finora quella regola viveva soltanto nella disciplina di chi
-- scrive il codice: bastava un `meta: { cliente: nomeCliente }` scritto di
-- fretta fra sei mesi per trasformare il registro di sicurezza in una seconda
-- copia dei dati personali — sparsa, non prevista dall'informativa, e per di
-- più in una tabella che nessuno guarda mai.
--
-- Questa migration rende la regola verificabile dal database invece che
-- sperata: ogni valore in `meta` dev'essere un numero, un booleano, null,
-- oppure una stringa corta fatta di caratteri "da codice" (lettere, cifre,
-- _ . : -). Un nome con lo spazio non passa. Un'email non passa (@ e spazio).
-- Un IBAN passerebbe come forma, ma nessun campo lo scriverebbe mai: qui
-- l'obiettivo è fermare la disattenzione, non un sabotaggio.
--
-- ⚠️ Se il vincolo scatta, l'evento NON viene registrato — e va bene così:
-- `logSecurityEvent` è best-effort e non blocca mai l'operazione dell'utente.
-- Meglio perdere un evento che archiviare un dato personale di nascosto. In
-- quel caso resta un avviso nei log applicativi (`[security-events]`).
--
-- NON URGENTE: senza questa migration tutto funziona come prima.
-- Idempotente.
-- ============================================================

CREATE OR REPLACE FUNCTION security_meta_is_safe(m jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT COALESCE(bool_and(
    jsonb_typeof(value) IN ('number', 'boolean', 'null')
    OR (
      jsonb_typeof(value) = 'string'
      AND value #>> '{}' ~ '^[A-Za-z0-9_.:-]{0,40}$'
    )
  ), true)
  FROM jsonb_each(m)
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'security_events_meta_solo_etichette'
  ) THEN
    ALTER TABLE security_events
      ADD CONSTRAINT security_events_meta_solo_etichette
      CHECK (security_meta_is_safe(meta));
  END IF;
END $$;

-- ── Hardening delle funzioni di pulizia (revisione 5 ago, corretto il 6) ──
-- SECURITY DEFINER senza REVOKE = invocabili via RPC anche dalla chiave
-- pubblica. L'effetto sarebbe solo ciò che il cron fa comunque (cancellare
-- il vecchio), quindi nessun danno reale — ma non c'è motivo di lasciare a
-- un anonimo il potere di svuotare i registri più vecchi. pg_temp in coda al
-- search_path chiude anche l'ombra classica delle SECURITY DEFINER.
--
-- ⚠️ IL GRANT A service_role NON È DECORATIVO. Le funzioni le crea `postgres`
-- (SQL Editor) ma le chiama il CRON NOTTURNO come `service_role`, che non ne
-- è proprietario: il permesso gli arrivava da PUBLIC, quindi il solo REVOKE
-- glielo toglieva e la pulizia si sarebbe fermata per sempre — in modo quasi
-- muto (il cron logga un warning e prosegue). Sarebbe stato grave anche verso
-- l'esterno: l'informativa privacy dichiara agli utenti che il registro di
-- sicurezza si cancella dopo 90 giorni. Verificato su PG16: senza il GRANT,
-- `SET ROLE service_role; SELECT purge_old_security_events();` risponde
-- "permission denied for function"; con il GRANT passa.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'purge_old_security_events') THEN
    REVOKE EXECUTE ON FUNCTION purge_old_security_events() FROM public, anon, authenticated;
    GRANT EXECUTE ON FUNCTION purge_old_security_events() TO service_role;
    ALTER FUNCTION purge_old_security_events() SET search_path = public, pg_temp;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'purge_old_stripe_events') THEN
    REVOKE EXECUTE ON FUNCTION purge_old_stripe_events() FROM public, anon, authenticated;
    GRANT EXECUTE ON FUNCTION purge_old_stripe_events() TO service_role;
    ALTER FUNCTION purge_old_stripe_events() SET search_path = public, pg_temp;
  END IF;
END $$;
