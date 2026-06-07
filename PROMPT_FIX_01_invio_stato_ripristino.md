# PROMPT CODE — FIX 01: flusso invio / aggiornamento stato / ripristino

> Incolla in Claude Code. Autocontenuto. **Leggi prima `CLAUDE.md` e `MAPPA_APP.md`.** Rispetta le regole CLAUDE.md (tsc + build verdi, formato risposta sez. C, aggiornare CLAUDE.md, commit conventional, mai dichiarare risolto senza causa confermata nel codice).
> Tema: i tre problemi più gravi del flusso quotidiano, emersi dagli screenshot del 2 giugno 2026.

## Problemi da risolvere

### FIX-1 — Lo stato non si aggiorna dopo l'invio (fattura e preventivo)
**Sintomo:** dopo "Invia email" dal dialog, la pagina di **dettaglio** del documento continua a mostrare **Bozza**; lo stato corretto (Inviato/Inviata) appare solo tornando alla lista.
**Causa da confermare:** la route `app/api/documents/[id]/send-email/route.ts` aggiorna lo stato nel DB ma non viene fatto `revalidatePath` sulla pagina di dettaglio, oppure `SendEmailDialog`/`SendEmailDialogController` non forza `router.refresh()` dopo il successo. Verifica entrambi.
**Fix atteso:** dopo invio riuscito, la pagina di dettaglio riflette subito lo stato (Inviato/Inviata) e la timeline mostra l'evento "Inviata al cliente" senza navigare via. Aggiungere `revalidatePath` per `/preventivi/[id]` e `/fatture/[id]` (e relative liste) e/o `router.refresh()` nel client dopo la chiusura del dialog di successo.
**File probabili:** `app/api/documents/[id]/send-email/route.ts`, `app/(app)/preventivi/_components/SendEmailDialog.tsx`, `SendEmailDialogController.tsx`, `app/(app)/fatture/[id]/page.tsx`, `app/(app)/preventivi/[id]/page.tsx`.

### FIX-2 — "Ripristina versione inviata" su una FATTURA porta a "Pagina non trovata" (404)
**Sintomo:** dal banner "Fattura modificata — non ancora reinviata" → "Ripristina versione inviata" → conferma → l'utente finisce sulla pagina 404. L'evento "Ripristinato alla versione inviata" viene però registrato in cronologia (quindi l'azione server va a buon fine, sbaglia solo il redirect).
**Causa da confermare:** `restoreToSentVersionAction` in `lib/actions/documents.ts` (o il componente `RestoreVersionButton.tsx`) fa redirect/revalidate hardcoded verso `/preventivi/[id]` anche quando il documento è una **fattura** → la route non esiste per quell'id.
**Fix atteso:** il redirect/revalidate dopo il ripristino deve usare `doc_type` per scegliere `/fatture/[id]` vs `/preventivi/[id]`. Verificare la stessa logica anche in `ResendReminderDialog` e in qualsiasi altra azione che reindirizza dopo operazioni su documento (pattern già presente, vedi CLAUDE.md sessioni precedenti su `docType === 'fattura' ? '/fatture' : '/preventivi'`).
**File probabili:** `lib/actions/documents.ts` (`restoreToSentVersionAction`), `app/(app)/preventivi/_components/RestoreVersionButton.tsx`.

### FIX-3 — Conversione preventivo → fattura: il cliente non viene riportato
**Sintomo:** creando una fattura da un preventivo che ha un cliente, la fattura appena creata mostra **"Nessun cliente"** (campo Cliente vuoto, PDF "Nessun cliente"); il cliente compare solo più tardi.
**CONFERMATO dall'utente:** il cliente sparisce davvero (non è un problema di refresh — è dato non riportato). **Causa da individuare nel codice:** la RPC `convert_preventivo_to_fattura` e/o `createInvoiceAction`/route `app/api/preventivi/[id]/converti-fattura/route.ts` non copiano `client_id` (e i dati destinatario snapshot) sulla nuova fattura. Trova il punto esatto e correggilo.
**Fix atteso:** la fattura creata da un preventivo eredita il cliente del preventivo (client_id e dati destinatario) e lo mostra subito nel form e nel PDF.
**File probabili:** `supabase/migrations/*convert_preventivo_to_fattura*`, `lib/actions/documents.ts` (`createInvoiceAction`), `app/api/preventivi/[id]/converti-fattura/route.ts`. ⚠️ Se serve modificare la RPC SQL, fornisci la migration secondo la regola B.7 di CLAUDE.md.

### Extra coerente col tema — feedback dopo invio
Dopo un invio riuscito mostrare un `toast.success` (sonner è già in uso) e aggiornare lo stato in-place. Niente vicoli ciechi.

## Criteri di accettazione (verifica end-to-end)
1. Invio di un preventivo bozza → la pagina di dettaglio passa a "Inviato" senza ricaricare manualmente; timeline aggiornata.
2. Invio di una fattura bozza → dettaglio passa a "Inviata" subito.
3. Fattura modificata dopo invio → "Ripristina versione inviata" → resta su `/fatture/[id]`, **nessun 404**, banner sparisce, cronologia mostra "Ripristinato".
4. Conversione di un preventivo con cliente → la fattura mostra subito quel cliente (form + anteprima).
5. `npx tsc --noEmit` e `npm run build` verdi.

## Definition of Done
- Causa reale confermata nel codice per ciascun fix (cita file/riga).
- Eventuale migration incollata in fondo (blocco "⚠️ Migration da applicare") + `types/database.ts` rigenerato.
- Test descritti secondo formato sez. C di CLAUDE.md.
- CLAUDE.md aggiornato; commit `fix(flusso): invio stato + ripristino fattura 404 + cliente in conversione`.
