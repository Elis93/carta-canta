# PROMPT CODE — FIX 09: "Reinvia" — email destinatario bloccata sul cliente

> Incolla in Claude Code. Autocontenuto. **Leggi prima `CLAUDE.md`.** Rispetta le regole CLAUDE.md (tsc + build verdi, formato risposta sez. C, aggiornare CLAUDE.md, commit conventional, push a fine task, mai dichiarare risolto senza causa confermata nel codice).
> Bug trovato testando dopo FIX_08. **Causa già individuata nel codice (sotto): confermala e correggi, non reinterpretare.**

## Problema
**Sintomo:** dal dettaglio di un preventivo/fattura già inviato, "Reinvia al cliente" permette di **modificare l'email destinatario**. Se la cambio (es. a un altro indirizzo) l'email parte verso quel nuovo indirizzo per quel singolo invio, ma il **cliente del documento non cambia** e l'email modificata **non viene salvata**: alla riapertura il campo torna all'email originale del cliente. Comportamento fuorviante.

**Causa confermata nel codice:** in `app/api/documents/[id]/send-email/route.ts` la creazione/associazione del cliente avviene **solo** quando il documento non ha ancora un cliente (`if (!doc.client_id && body.clientId)` … `else if (!doc.client_id && body.to)`). Sul **reinvio** il documento ha già `client_id`, quindi quei blocchi vengono **saltati**: l'email viene inviata a `body.to` ma né il cliente né la sua email vengono aggiornati. Inoltre `SendEmailDialog.tsx` (≈ righe 253-255) reimposta `to = clientEmail` ad ogni apertura, quindi la modifica non persiste. In modalità reinvio il documento ha un cliente → `hasClient = true` → il campo email è l'`<Input>` editabile (≈ righe 527-536).

## Decisione di prodotto (confermata dall'utente)
Il "Reinvia" significa **rimandare lo stesso documento allo stesso cliente**. Quindi l'email destinatario deve essere **di sola lettura** in modalità reinvio, con un'indicazione chiara su come cambiare destinatario (modificando il cliente). NON si introduce la modifica dell'email del cliente dal dialog di reinvio.

## Fix atteso (`app/(app)/preventivi/_components/SendEmailDialog.tsx`)
Nel campo "Email destinatario", **solo quando `isResend && hasClient && clientEmail` è valorizzata**:
- Rendi il campo **read-only** (es. `readOnly` sull'`<Input>`, stile non editabile ma testo leggibile/selezionabile; va bene anche `disabled`), mostrando l'email del cliente.
- Sotto il campo, testo di aiuto: **"Per inviare a un altro indirizzo, modifica l'email del cliente nella rubrica Clienti."** Se l'id del cliente è disponibile, rendilo un link a `/clienti/[clientId]`; se l'id non è facilmente disponibile come prop, lascia il testo **senza** link e **segnalalo** nel report (così valutiamo se aggiungere la prop dopo).

**Casi da NON rompere:**
- **Primo invio** (documento senza cliente, `!hasClient`): il campo resta come ora — `ClientSearchInput` con autocomplete, editabile. Nessuna modifica.
- **Reinvio ma cliente SENZA email salvata** (`isResend && hasClient && !clientEmail`): il campo deve restare **editabile** (serve poter inserire un'email per poter inviare); mantieni il messaggio esistente "Nessuna email salvata per questo cliente." Non bloccare in questo caso.

**Per aggiungere il link al cliente (se scegli di farlo):** aggiungi a `SendEmailDialog` una prop opzionale `clientId?: string | null` e falla passare da chi apre il dialog in reinvio (`SendEmailDialogController.tsx` e/o `preventivi/[id]/page.tsx`, `fatture/[id]/page.tsx`). Se la cosa risulta più invasiva del previsto, implementa la versione **senza link** (solo testo) e segnalalo — meglio parziale e corretto.

## Nota (non fixare ora, solo verifica)
Durante il test è stato segnalato che, riaprendo "Reinvia" dopo aver cambiato email, talvolta comparivano i campi Nome/Cognome (variante "senza cliente") e la X di chiusura non era raggiungibile. Con questo fix la modifica dell'email non sarà più possibile, il che dovrebbe prevenire lo stato anomalo. **Verifica** che, su un documento con cliente, il dialog di reinvio mostri sempre la variante "con cliente" (header "A: …" + email read-only) e che la X in alto a destra sia sempre presente. Se riesci a riprodurre uno stato in cui `hasClient` diventa `false` su un documento che ha un cliente, segnalalo come bug separato (non forzare un fix qui).

## Criteri di accettazione
1. Reinvio di un doc con cliente che ha email → campo email **non modificabile**, mostra l'email del cliente, con indicazione per cambiarla via Clienti.
2. Primo invio (senza cliente) → invariato (autocomplete editabile).
3. Reinvio con cliente senza email → campo editabile per poter inserire l'email.
4. La X di chiusura del dialog è sempre presente; il dialog di reinvio mostra la variante "con cliente".
5. Nessun dato salvato cambiato; nessuna nuova tabella.
6. `npx tsc --noEmit` e `npm run build` verdi.

## Definition of Done
- Fix implementato; causa ri-confermata con file/riga.
- Test in formato sez. C di CLAUDE.md.
- CLAUDE.md aggiornato; commit `fix(invio): reinvio email bloccata sul cliente`.
- A fine task: `git push` (origin → Vercel) + conferma deploy con URL. `git push nas master` solo se il NAS è raggiungibile; altrimenti segnalalo.
