-- Migration 079: PIÙ note di credito per fattura (decisione Eli, 10 ago 2026).
--
-- Toglie l'indice unico della 078 («una sola nota attiva per fattura»): la
-- legge ammette più note parziali sulla stessa fattura, e il processo ora ha
-- la protezione GIUSTA al posto dell'unicità — il TETTO: la somma delle note
-- attive non supera il totale della fattura. Il tetto vive nel codice:
--  · la nota nuova nasce già col RESIDUO stornabile (non a importo pieno);
--  · la TRASMISSIONE rifiuta una nota che, sommata alle sorelle trasmesse,
--    supererebbe il totale della fattura (fail-closed);
--  · la pagina della nota avvisa se gli importi superano il residuo.
--
-- Idempotente: DROP IF EXISTS. Applicabile prima o dopo il deploy: col codice
-- nuovo e l'indice ancora presente, la seconda nota viene semplicemente
-- rifiutata con l'invito ad aprire quella esistente (gestione 23505).

DROP INDEX IF EXISTS uniq_nota_credito_per_fattura;
