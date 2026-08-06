# Ricerca — Fatturazione elettronica (SDI)

Cartella di lavoro **dedicata** alla chat di ricerca/decisione sulla fatturazione elettronica.

## Regole per la chat che lavora qui (IMPORTANTE)
- Lavora **SOLO** dentro questa cartella `ricerca-fatturazione-elettronica/`.
- **NON** modificare nessun altro file del progetto `carta-canta` (codice, documenti, configurazioni).
- **NON** eseguire comandi git (niente add/commit/push). Solo creare/editare file `.md` qui.
- Non avviare build, non installare pacchetti, non toccare il database.
- Il codice dell'app lo scrive un'altra chat (Code): per evitare conflitti, **non lavorare mentre Code sta scrivendo/committando**.

## Cosa produrre qui
- `DECISIONE_SDI.md` — documento decisionale (opzioni, raccomandazione, costi, passi, domande aperte).
- `provider-comparativa.md` — tabella comparativa dei provider SDI.
- `fonti.md` — link verificati (Agenzia delle Entrate, documentazione provider) con data di consultazione.

## Cosa succede dopo
La chat principale (regìa) legge questi file e **integra** le decisioni nel repo dell'app
(registri decisioni / SPEC / prompt per Code) quando opportuno. Questa cartella resta l'archivio
della ricerca SDI.
