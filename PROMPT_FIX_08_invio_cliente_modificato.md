# PROMPT CODE — FIX 08: conflitto cliente nel popup invio + cliente dopo invio + badge "Modificato"

> Incolla in Claude Code. Autocontenuto. **Leggi prima `CLAUDE.md`.** Rispetta le regole CLAUDE.md (tsc + build verdi, formato risposta sez. C, aggiornare CLAUDE.md, commit conventional, push a fine task, mai dichiarare risolto senza causa confermata nel codice).
> Tre problemi trovati testando dopo FIX_01. **Cause già individuate nel codice (sotto): confermale e correggi, non reinterpretare.**

---

## CHECK-1 — Falso conflitto "due contatti con la stessa email" selezionando un contatto esistente
**Sintomo:** invio un preventivo bozza **senza cliente**; nel popup digito 2 lettere nel campo Nome → compare il contatto nell'autocomplete → lo **seleziono** → all'invio esce "non possono esserci due contatti diversi con la stessa email", anche se ho scelto proprio quel contatto.

**Causa confermata:** in `app/api/documents/[id]/send-email/route.ts` il controllo conflitto (≈ righe 188-208) confronta `existingClient.name` (solo colonna **name** = "Mario") con `body.clientName` (che il dialog invia come **nome + cognome** = "Mario Rossi"). La route nemmeno seleziona `surname`. Quindi `"mario" !== "mario rossi"` → conflitto **falso**. Inoltre, quando l'utente **seleziona** un contatto dall'autocomplete (`handleSelectClient` in `SendEmailDialog.tsx`, ≈ riga 294), il dialog non comunica alla route che si tratta di un contatto **esistente** (non invia l'id): la route lo tratta come nome nuovo e applica il confronto.

**Fix atteso (due parti coordinate):**
1. **`SendEmailDialog.tsx`**: quando l'utente seleziona un contatto dall'autocomplete, **memorizza il suo id** (es. `selectedClientId`). Azzeralo se poi l'utente modifica a mano nome/cognome/email (così non si associa l'id sbagliato). In `handleSend`, se `selectedClientId` è presente, includilo nel body (`clientId`).
2. **`send-email/route.ts`**:
   - Se `body.clientId` è presente: **associa direttamente** quel cliente al documento (`documents.client_id = clientId`, dopo aver verificato che appartenga al workspace) e **salta del tutto** il controllo conflitto. È il contatto scelto esplicitamente, non c'è ambiguità.
   - Se `body.clientId` è assente ma c'è `clientName` digitato a mano: mantieni il controllo conflitto, ma **confronta il nome completo**: aggiungi `surname` alla `select` di `existingClient` e confronta `[existingClient.name, existingClient.surname].filter(Boolean).join(' ').trim().toLowerCase()` con `body.clientName.trim().toLowerCase()`. Così il conflitto scatta **solo** se l'email appartiene davvero a una persona diversa.

**Accettazione:** seleziono dall'autocomplete un contatto esistente → l'invio va a buon fine **senza** messaggio di conflitto e il documento risulta associato a quel contatto. Il conflitto compare **solo** se digito a mano un nome di persona diversa per un'email già usata da un altro contatto.

---

## CHECK-2 — Dopo l'invio, il cliente non compare nella sezione Cliente del preventivo
**Sintomo:** invio un preventivo bozza dal popup (digitando email/nome); dopo l'invio, nel dettaglio il campo **Cliente** resta vuoto finché non ricarico la pagina a mano.

**Causa confermata:** la route `send-email` **scrive correttamente** `documents.client_id` (≈ righe 230-238) — quindi il dato c'è. Il problema è lato UI: dopo l'invio parte `router.refresh()` (FIX-1), ma `PreventivoForm.tsx` inizializza `selectedClient` **una sola volta** da `defaultClient` con `useState(defaultClient ?? null)` (≈ riga 142) e **non lo ri-sincronizza** quando `defaultClient` cambia al refresh → il campo Cliente resta `null`.

**Fix atteso:** in `PreventivoForm.tsx` aggiungi un `useEffect` che **sincronizza `selectedClient` con `defaultClient`** quando `defaultClient` diventa valorizzato **e** `selectedClient` è ancora `null` (NON sovrascrivere una selezione manuale dell'utente). Prima di toccare l'UI, **verifica** che `client_id` sia davvero salvato sul documento dopo l'invio (lo è secondo la route): se per qualche motivo non lo fosse, segnalalo.

**Accettazione:** invio un preventivo dal popup → dopo l'invio (senza ricaricare a mano) il campo Cliente mostra il contatto appena associato.

---

## CHECK-3 — Il badge "Modificato" non compare se cambio solo la descrizione di una voce
**Sintomo:** su una **fattura/preventivo già inviato**, cambiando la **descrizione** di una voce non compare il badge "Modificato" (né in lista, né il banner viola nel dettaglio, né l'evento in cronologia); cambiando la **quantità** invece compare.

**Causa confermata (non è un bug casuale, è rilevazione incompleta):** in `lib/actions/documents.ts`, sia `saveDraftAction` (≈ righe 166-176, **questo è il percorso usato** dall'edit di doc inviati) sia `updateDocumentAction` (≈ righe 502-513) calcolano `publicFieldsChanged` confrontando solo campi a livello di documento (`title`, `notes`, `discount_pct`, `discount_fixed`, `vat_rate_default`, `validity_days`, `payment_terms`, `bonus_edilizio`) **più** `Math.abs(fiscal.total - existingDoc.total) > 0.001`. Le voci NON sono confrontate riga per riga: quantità/prezzo cambiano il **totale** → badge; la **descrizione** (o l'unità) non cambia il totale → nessun badge.

**Fix atteso:** estendi `publicFieldsChanged` in **ENTRAMBE** le action (per coerenza) in modo che rilevi anche le modifiche alle **voci** visibili al cliente: `description`, `unit`, `quantity`, `unit_price`, `discount_pct`, `vat_rate`, e l'**ordine** delle righe. Confronta le **voci nuove** con le **voci originali** lette PRIMA del delete (in `saveDraftAction` le voci originali sono già lette per lo snapshot quando manca `sent_snapshot`; assicurati di leggerle comunque quando servono per il confronto). Suggerimento: costruisci una "firma" normalizzata di ogni riga (es. `description|unit|quantity|unit_price|discount_pct|vat_rate`, in ordine `sort_order`) e confronta la lista vecchia con la nuova; se differiscono → `publicFieldsChanged = true`.
**Attenzione:** non rompere il comportamento esistente (i cambi di totale/campi documento devono continuare a far comparire il badge); aggiungi solo il confronto voci. Mantieni lo stesso evento in cronologia (`document_log`) che già viene aggiunto quando `publicFieldsChanged` è vero.

**Accettazione:** su un documento inviato, modificando **solo** la descrizione (o l'unità) di una voce → compare il badge "Modificato" in lista, il banner viola nel dettaglio e l'evento in cronologia, esattamente come avviene cambiando la quantità.

---

## Criteri di accettazione globali
1. CHECK-1: selezione contatto esistente → invio senza falso conflitto; conflitto reale solo per persona diversa con stessa email.
2. CHECK-2: cliente visibile nel dettaglio subito dopo l'invio, senza reload manuale.
3. CHECK-3: qualsiasi modifica visibile alle voci (descrizione/unità inclusi) fa comparire "Modificato", in preventivi e fatture.
4. Nessun dato salvato cambiato fuori da quanto descritto; nessuna nuova tabella.
5. `npx tsc --noEmit` e `npm run build` verdi.

## Definition of Done
- CHECK-1/2/3 implementati come specificato; causa reale ri-confermata con file/riga.
- Eventuale migration: nessuna prevista; se ne emergesse una, incollala in fondo (regola B.7).
- Test in formato sez. C di CLAUDE.md (cosa verificato e come).
- CLAUDE.md aggiornato; commit `fix(invio): conflitto cliente + cliente dopo invio + badge modificato su voci`.
- A fine task: `git push nas master` (se disponibile) + `git push` (origin → Vercel) e conferma deploy con URL. Se il NAS non è raggiungibile con l'utente corrente, fai solo `git push` e segnalalo.
