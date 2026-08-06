# Archivio documenti — roba finita, tenuta solo per memoria

> Qui dentro **non c'è niente da fare**. Sono documenti che hanno esaurito il loro scopo:
> descrivono lavori conclusi, stati del prodotto non più veri, o procedure di un modo di
> lavorare che non usiamo più. Restano nel repository perché la storia di come si è arrivati
> a una scelta ogni tanto serve, ma **non vanno usati come riferimento**: quasi tutti
> contengono affermazioni oggi false.
>
> **Dove sta invece la verità di oggi:**
> - regole permanenti, stato, handoff di sessione → **`CLAUDE.md`**
> - decisioni di prodotto e feedback di Eli → **`DECISIONI_E_FEEDBACK.md`**
> - cose che deve fare Eli a mano → **`COSE_DA_FARE_ELI.md`**
> - sicurezza → **`SICUREZZA.md`** + **`AUDIT_COPERTURA_SICUREZZA.md`**
> - collaudi manuali → **`TEST_DA_FARE_ELI.md`**
> - informativa privacy vera → la pagina `app/(legal)/privacy/page.tsx`, non le bozze qui dentro

Archiviato il **6 agosto 2026**. Prima di spostarli, il poco contenuto ancora valido è stato
travasato nei file vivi (le regole permanenti in `CLAUDE.md` §B.2; i collaudi rimasti aperti in
`TEST_DA_FARE_ELI.md`; i testi Play Store in `PLAY_STORE_SCHEDA.md`).

## Cosa c'è, in breve

**Impianto di lavoro dei primi mesi** — `WORKFLOW_v2.md`, `SETUP_v2.md`, `RIPARTI_QUI.md`,
`STATO_PROGETTO.md`, `BACKLOG.md`: guide per costruire l'app da zero e riprendere il lavoro
ogni mattina, di aprile-giugno 2026. Rimandano a decine di file che non esistono più e a un
flusso a due assistenti che non usiamo.

**Redesign mobile (giugno 2026)** — `DECISIONI_REDESIGN_MOBILE.md`,
`DECISIONI_UI_CONSOLIDATE.md`, `REVISIONE_UI.md`, `SCOSTAMENTI_DAL_MOCKUP.md`,
`PROMPT_FEDELTA_MOBILE.md`, `QA_MOBILE.md`, `SPEC_PER_SCHERMATA.md`: il redesign è finito e
l'interfaccia è cambiata molte volte da allora. Alcuni valori qui dentro (colori, tinte dei
badge, sfondo pagina) sono **sbagliati** rispetto al codice attuale.

**Mappa e presentazione** — `MAPPA_APP.md` (elenco di route e tabelle fermo a maggio: mancano
metà delle pagine dell'app), `PROJECT_DESCRIPTION.md` (pitch di aprile: prezzi e limiti non
corrispondono più).

**Play Store, prima stesura** — `PLAY_STORE.md`, sostituito da `PLAY_STORE_SCHEDA.md`.

**Collaudi già chiusi** — `DA_TESTARE.md`, `FEEDBACK_ELI_22LUG.md`: liste di test di luglio,
tutte lavorate. Le voci ancora aperte sono state spostate in `TEST_DA_FARE_ELI.md`.

**Changelog congelato** — `REGISTRO_AGGIORNAMENTI.md`: si è fermato al 15 luglio, quando il
racconto delle sessioni è passato agli handoff dentro `CLAUDE.md`.

**GDPR, prima passata (giugno)** — i file `gdpr-*.md`. ⚠️ Erano i più pericolosi da lasciare
in giro: dicevano "nessun tracciamento attivo, non serve il banner cookie" quando il banner
esiste ed è attivo, e "la 2FA è ancora da fare" quando è fatta su tutti e cinque gli account.
La bozza di informativa qui dentro è più povera della pagina pubblicata. L'unico documento GDPR
ancora **vivo** è rimasto fuori: `gdpr/registro-trattamenti.md` (registro art. 30 — da rifare
con l'avvocato, ci sono le note in testa al file).

**Ricerca fatturazione elettronica** — `sdi-README.md` (regole di una chat di ricerca chiusa),
`sdi-provider-comparativa.md` e `sdi-fonti.md` (consultati a giugno 2026: i prezzi vanno
riverificati se un giorno si cambia provider). Le decisioni e il contratto restano nella
cartella viva `ricerca-fatturazione-elettronica/`.

**Prompt usa-e-getta** — i `PROMPT_*.md`: istruzioni scritte per un singolo fix, già eseguite;
il racconto di ognuna sta in `STORICO_SESSIONI.md`.
