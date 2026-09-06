# PROGETTO — Termine dei lavori sul preventivo («entro N giorni dalla conferma»)

> Richiesta di Eli, 6 set 2026 (feedback n. 6): *«Inserire in preventivo quando è previsto il termine dei lavori (tipo 30 giorni da conferma preventivo)»*. Scelta sua: **giorni dalla conferma**, non una data fissa (una data scritta prima che il cliente accetti invecchia da sola).
> Stato: **PIANO, nessun codice**. Si implementa al via di Eli, in un giro suo. Migration prevista: **088** (la 087 è la P.IVA unica).

## 1. Cosa esiste oggi (verificato nel codice)
- Nessun campo per i tempi di esecuzione. `validity_days`/`expires_at` sono la **validità dell'offerta** (altro orologio, altra riga «Valido fino al»): non si toccano.
- Il lavoro (`lavori.document_id`) nasce dal preventivo accettato → la data di fine si può **derivare** dal preventivo, senza colonne sul lavoro.
- «Valido fino al» è stampato in tutti e 4 i preset del PDF (`lib/pdf/template.ts` righe ~822 · 914 · 1033 · 1237 · 1316), nel foglio interno (`preventivi/[id]` ~734 e ~1104) e sulla pagina del cliente (chip scadenza in `MobilePublicCard`). Il termine dei lavori va **accanto** a quella riga, mai al suo posto.

## 2. Dato
- **migration 088**: `documents.work_days INTEGER NULL CHECK (work_days BETWEEN 1 AND 365)` (vuoto = non indicato) + `workspaces.work_days_default INTEGER NULL` stesso vincolo (default facoltativo in Impostazioni › Generale, accanto alla validità). Validare su PG16 (vincolo: 0 e 366 respinti, NULL ok, idempotente). `types/database.ts` a mano nei blocchi Row/Insert/Update (eccezione B.1.6).
- Giorni di **calendario**, non lavorativi: è ciò che un cliente capisce leggendo «entro 30 giorni». Chi vuole 6 settimane scrive 42.
- Data concreta = `accepted_at + work_days` → helper PURO `lib/documents/termine-lavori.ts` (`dataFineLavori(acceptedAt, workDays)`, `terminePrevisto(doc)` → `{ giorni, dataFine? }`) con test (null, bordi 1/365, fuso Europe/Rome).

## 3. Dove compare
1. **Form** (`PreventivoForm`, card «Note, foto e condizioni», riga della validità): campo «Tempi di esecuzione — giorni dalla conferma» (`inputMode=numeric`, segnaposto «esempio: 30»); su nuovo preventivo parte da `work_days_default`. Zod in `documents.ts`: create / update / saveDraft; `duplicateDocumentAction` lo copia; la conversione in fattura NON lo porta (una fattura non promette tempi); multi-proposta: un solo valore per documento. Solo preventivi (mai `FatturaForm`).
2. **PDF** — riga sotto «Valido fino al» in ciascun preset: *«Tempi di esecuzione: indicativamente entro 30 giorni dalla conferma del preventivo, salvo imprevisti o cause non dipendenti dall'impresa.»* Regola F: render REALE di `buildPdfHtml` in Chromium sui 4 preset, con e senza campo, screenshot.
3. **Pagina del cliente** (`MobilePublicCard`): riga grigia sotto la chip scadenza, stessa frase; dopo l'accettazione diventa «Lavori entro il {data}» (`acceptedAt` è già passato al componente).
4. **Foglio interno** (`preventivi/[id]`, mobile+desktop): riga sotto «Valido fino al»; a preventivo accettato «Lavori entro il {data}».
5. **Scheda Lavoro** (`lavori/[id]`, testata navy): riga «da concludere entro il {data}» letta dal preventivo d'origine (select allargata a `work_days`+`accepted_at`, tollerante pre-088); rosso se la data è passata e il lavoro non è finito. Niente colonna nuova sul lavoro.
6. **Impostazioni › Generale**: campo «Tempi di esecuzione (giorni)» accanto alla validità; scrittura condizionata a `formData.get(...) !== null` (l'onboarding usa la stessa action: la trappola degli ATECO) e update tollerante pre-088.
7. **FAQ** nuova «Posso scrivere sul preventivo entro quando finisco i lavori?» + voce /novita + guida di sezione se cita la card condizioni.

## 4. Cosa NON fare in questo giro
- Nessuna notifica/campanella al superamento del termine (proposta per dopo, con la sua regola di rumore).
- Nessun legame con `expires_at`, `validity_days`, SdI, fattura, Bilancio.
- Nessun calcolo su giorni lavorativi o festività.

## 5. ⚖️ B.0 — è una clausola contrattuale
Un termine scritto sul preventivo che il cliente accetta è un impegno (art. 1183 c.c. e ss.): sforarlo espone a contestazioni. Per questo: campo **vuoto di default** (chi non lo compila non promette nulla), dicitura con «indicativamente» e «salvo imprevisti o cause non dipendenti dall'impresa», e **riga nella lista per l'avvocato** (`COSE_DA_FARE_ELI.md §2`) per far validare la frase. Da dire a Eli prima del via.

## 6. Ordine di lavoro (mezza giornata)
088 → helper puro + test → Zod e action → form → PDF (4 preset, screenshot) → pagina cliente → foglio interno → scheda lavoro → Impostazioni → FAQ/novita → tsc+build+test+smoke → collaudo sul telefono (preventivo con e senza termine, accettazione, scheda lavoro).
