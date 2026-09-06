-- 087 — Una P.IVA (o codice fiscale) non può essere associata a due account
-- (feedback Eli, 6 set 2026: «non può essere registrata due volte la stessa
-- partita IVA» — riferito alla REGISTRAZIONE con due account, non alla rubrica
-- clienti, che ha già il suo avviso di doppione).
--
-- Indice unico PARZIALE su upper(btrim(piva)):
--   · case-insensitive: il campo accetta anche il codice fiscale, che può
--     arrivare in minuscolo (la validazione è /i);
--   · ignora le righe senza P.IVA (forfettari senza, workspace appena creati
--     dall'OAuth, che nascono vuoti): NULL e stringa vuota non collidono mai;
--   · ignora gli account CANCELLATI (deleted_at, migration 050): il workspace
--     resta congelato per i 10 anni fiscali CON la sua P.IVA (account.ts la
--     conserva apposta), e chi cancella l'account e si reiscrive deve poter
--     riusare la propria.
--
-- Il codice (lib/actions/workspace.ts) fa un pre-controllo e traduce comunque
-- il 23505 in un messaggio leggibile: l'indice è la rete sotto la porta (due
-- salvataggi concorrenti, o una scrittura fuori dall'app).
--
-- ⚠️ Se in produzione esistessero già due account attivi con la stessa P.IVA
-- la CREATE fallirebbe: prima di applicarla, la SELECT in coda deve dare 0 righe
-- (oggi: nessun utente reale, nessun rischio).

CREATE UNIQUE INDEX IF NOT EXISTS workspaces_piva_unica_idx
  ON workspaces (upper(btrim(piva)))
  WHERE piva IS NOT NULL AND btrim(piva) <> '' AND deleted_at IS NULL;

-- Controllo preventivo (solo lettura, da lanciare PRIMA in caso di dubbio):
-- SELECT upper(btrim(piva)) AS piva, count(*) FROM workspaces
--  WHERE piva IS NOT NULL AND btrim(piva) <> '' AND deleted_at IS NULL
--  GROUP BY 1 HAVING count(*) > 1;
