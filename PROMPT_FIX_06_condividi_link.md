# PROMPT CODE — FIX 06: Condividi link (WhatsApp / menu nativo) + marcatura "Inviato"

> Incolla in Claude Code. Autocontenuto. **Leggi prima `CLAUDE.md` e `MAPPA_APP.md`.** Rispetta le regole CLAUDE.md (tsc + build verdi, formato sez. C, aggiornare CLAUDE.md, commit conventional, causa confermata prima del fix).
> Obiettivo: dare all'artigiano un modo **velocissimo e familiare** di mandare il link del preventivo/fattura al cliente — soprattutto via **WhatsApp** — senza costruire nessuna chat. Target: persone poco avvezze al software → un tocco, niente da imparare.

## Cosa fare

### 1. Bottone "Condividi" sul dettaglio di preventivo e fattura
Accanto ai bottoni esistenti ("Anteprima", "Salva o stampa il PDF", "Invia email", "Cambia stato") aggiungere **"Condividi"**.
- **Su mobile / browser che supportano la Web Share API:** al click chiamare `navigator.share({ title, text, url })` → si apre il **menu nativo del telefono** (WhatsApp, SMS, Email, Telegram…). Un tocco, l'utente sceglie.
- **Fallback (desktop o `navigator.share` non disponibile):** mostrare un piccolo popover con: **WhatsApp**, **Email**, **Copia link**.
  - WhatsApp: `https://wa.me/?text=<testo+url>` (se il cliente ha un telefono in rubrica, usare `https://wa.me/<numero>?text=<testo>`; numero normalizzato con prefisso internazionale, es. +39).
  - Email: `mailto:?subject=<oggetto>&body=<testo+url>`.
  - Copia link: copia l'URL pubblico negli appunti + `toast.success`.
- **Testo precompilato** coerente con l'email esistente, es.: *"Le faccio avere il link per visualizzare il preventivo n. {numero} come da nostra intesa: {url}"*. Parametrizzare preventivo/fattura.
- L'URL da condividere è il **link pubblico** `/p/[token]` (mai `/preventivi/[id]`).

### 2. ⚠️ La condivisione deve marcare il documento come "Inviato" (come l'invio email)
Se l'artigiano condivide il link, il documento **non deve restare "Bozza"** (sarebbe incoerente: il cliente l'ha ricevuto ma l'app pensa sia bozza).
- Al primo "Condividi" di una bozza: **assicurare che esistano `public_token` e `doc_number`** e marcare il documento come **Inviato/Inviata** (`sent_at`, stato, evento in `document_log`, ricalcolo `expires_at` secondo le regole esistenti).
- **Riusare la logica già esistente**: esiste `registerManualSendAction` in `lib/actions/documents.ts` (il "Registra invio manuale" che assegna numero + stato senza inviare email) e/o `sendDocumentAction`. **NON duplicare la logica di allocazione numero/stato**: riusa l'azione esistente che marca "inviato" senza spedire email. Verifica quale fa esattamente questo e richiamala dal flusso Condividi.
- Mostrare una conferma leggera la prima volta ("Condividendo, il documento verrà segnato come Inviato e gli verrà assegnato il numero"), coerente con quanto già accade per l'invio email.
- Se il documento è **già** inviato, "Condividi" non cambia stato: apre solo la condivisione.

### 3. (Collegato a FIX 04) Pagina pubblica: "Contatta" → rispondi via WhatsApp/email
Sul link pubblico c'è già un pulsante "Contatta {artigiano}". Renderlo coerente: il cliente risponde all'artigiano via **WhatsApp** (se l'artigiano ha un telefono pubblico nel workspace) o **email** (reply-to / email business, NON l'email personale dell'account — vedi FIX 04). Questo sostituisce l'idea della chat: la conversazione avviene su WhatsApp/email, dove l'artigiano è già abituato.

## Fuori scopo (per ora)
- Nessuna chat in-app, nessuna WhatsApp Business API, nessun invio automatico/tracciato (sono backlog C.2).
- Niente notifiche push.

## File probabili
- `app/(app)/preventivi/[id]/page.tsx`, `app/(app)/fatture/[id]/page.tsx` (aggiungere il bottone),
- nuovo `app/(app)/preventivi/_components/ShareButton.tsx` (client component: Web Share API + fallback popover; riusa `ui/` esistenti),
- `lib/actions/documents.ts` (riuso `registerManualSendAction`/equivalente per la marcatura "inviato"),
- `app/p/[token]/_components/ActionBar.tsx` (punto 3, contatta via WhatsApp/email).

## Criteri di accettazione (verifica end-to-end)
1. Su telefono, "Condividi" apre il menu nativo con WhatsApp tra le opzioni; il messaggio contiene il **link pubblico** e un testo precompilato corretto (preventivo vs fattura).
2. Su desktop, il fallback mostra WhatsApp / Email / Copia link funzionanti.
3. Condividendo una **bozza**, il documento passa a **Inviato/Inviata**, ottiene il numero, e l'evento appare in cronologia — riusando l'azione esistente (nessuna logica duplicata).
4. Condividendo un documento già inviato, lo stato non cambia.
5. Sul link pubblico, "Contatta" non espone l'email personale dell'account.
6. Mobile-first ok a 360px; `tsc` + `build` verdi.

## Definition of Done
- Causa/riuso confermati nel codice (cita l'azione riusata). Test sez. C (descrivi prova su mobile e desktop). CLAUDE.md aggiornato.
- Commit `feat(condivisione): condividi link via menu nativo/WhatsApp + marcatura inviato`.
