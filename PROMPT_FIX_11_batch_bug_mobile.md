# PROMPT CODE — FIX 11: batch bug mobile (dal test reale)

> Incolla in Claude Code. Autocontenuto. **Leggi prima `CLAUDE.md`.** Rispetta le regole (tsc + build verdi; se tocchi voci/validazioni esegui anche `npm test -- --run`; formato risposta sez. C; aggiornare CLAUDE.md; commit conventional; push a fine task).
> Lavora SOLO su `master` in `C:\Users\Public\carta-canta` — niente worktree, niente branch `claude/*`.
> 9 punti emersi dal test mobile. Cause indicate sotto: confermale e correggi. Dove un punto richiede indagine (T-18, T-8) è segnalato.

---

## T-7 — [CRITICO] I popup non sono scorribili: la X di chiusura è tagliata fuori schermo su mobile
**Sintomo:** su mobile, quando un dialog è più alto dello schermo, non si riesce a scorrere e la X in alto non è raggiungibile → impossibile chiudere.
**Causa:** `components/ui/dialog.tsx` — il `DialogContent` non ha un'altezza massima né overflow verticale, quindi il contenuto alto esce dallo schermo.
**Fix atteso:** dare al `DialogContent` (o a un wrapper interno) `max-height` ~`90dvh` e `overflow-y-auto`, così i dialoghi alti **scorrono internamente** e header/X restano sempre visibili. Usa `dvh` (non `vh`) per gestire bene le barre del browser mobile. Verifica che la X resti ancorata/visibile (header non scrollato via, oppure X sempre raggiungibile scorrendo). **Non** cambiare il comportamento dei dialoghi che ci stanno già (solo aggiunta di max-height + scroll).
**Accettazione:** su 360px un dialog lungo (es. invio email) si scorre e la X è sempre raggiungibile.

## T-6 — Voce da catalogo va come 2ª riga invece di sostituire la 1ª vuota
**Causa confermata:** in `VociTable.tsx` il check `lastIsEmpty` richiede `last.quantity === 1`, ma la prima riga creata da `PreventivoForm` (`newVoce`) nasce con `quantity: 0` → il check non la riconosce vuota e accoda la voce.
**Fix atteso:** rendere il check "riga vuota" **robusto e indipendente dalla quantità**: `last.description.trim() === '' && (last.unit_price ?? 0) === 0` (ignora il valore di `quantity`). Così una prima riga non toccata viene **sostituita** dalla voce di catalogo, sia che la sua quantità sia 0 o 1. (Allinea anche `PreventivoForm.newVoce` a `quantity: 1` per coerenza, se non lo è già.)
**Accettazione:** nuovo preventivo, senza toccare nulla, seleziono una voce dal catalogo → diventa la **1ª** riga.

## T-8 — L'errore "voci mancanti" deve apparire PRIMA di aprire il popup invio
**Sintomo:** clicco "Invia", si apre il popup cliente, e solo dopo scopro che mancano voci compilate.
**Causa:** la validazione delle voci (descrizione/quantità/prezzo) avviene dopo l'apertura del dialog; `handleOpenChange` in `SendEmailDialog.tsx` controlla solo `hasVoci` (presenza), non la **completezza**.
**Fix atteso:** prima di aprire il dialog di invio, validare che esista almeno una voce **completa** (descrizione + prezzo + quantità). Se non valido: NON aprire il dialog e mostrare l'errore nel form (riusa l'evento/banner già esistente `cartacanta:voci-mancanti` + `getVociError` in `PreventivoForm`). Stesso comportamento per preventivi e fatture.
**Accettazione:** con voci incomplete, clic su "Invia" → l'errore compare nel form e il popup **non** si apre.

## T-15 — Condivisione WhatsApp duplica il link nel messaggio
**Causa confermata:** in `ShareButton.tsx`, `buildShareText()` include già l'URL nel testo (`…come da nostra intesa: ${url}`), poi `navigator.share({ title, text, url })` passa di nuovo l'URL come parametro → WhatsApp mostra il link due volte.
**Fix atteso:** separare i due casi:
- **`navigator.share`**: passa `text` **senza** URL e l'URL nel campo `url` (così appare una volta sola).
- **Fallback `wa.me`/`mailto`** (che accettano solo testo): tieni l'URL **dentro** il testo.
Definisci due stringhe: una "testo senza url" (per share API) e una "testo con url" (per wa.me/mailto/copia).
**Accettazione:** condividendo su WhatsApp il messaggio contiene **un solo** link.

## T-16 — Togliere "Modifiche non ancora reinviate al cliente" dalla cronologia
**Causa confermata:** `DocumentTimeline.tsx` riga ~147 ha `detail: 'Modifiche non ancora reinviate al cliente'`.
**Fix atteso:** rimuovere quel `detail` dall'evento (lasciare l'evento "aggiornato/modificato" senza quella dicitura). Ci sono già altri avvisi (banner) che segnalano che il cliente non ha la versione aggiornata.
**Accettazione:** nella cronologia non compare più quella frase.

## T-18 — Suggerimenti cliente: assenti nel popup invio; nel form spariscono subito
**Sintomo:** (a) nel **popup invio** digitando ≥2 lettere non compaiono suggerimenti; (b) nella sezione **Cliente del preventivo** (`ClientAutocomplete`) i suggerimenti compaiono ma **spariscono subito**.
**Da indagare e correggere:**
- (a) `SendEmailDialog.tsx`: i campi con autocomplete sono dentro `{!hasClient && …}` e usano `allClients` caricati da `preloadClientsAction()` solo se `!hasClient`. Verifica che `allClients` venga davvero popolato e che `filterClients` produca risultati; se è rotto, ripristina i suggerimenti (senza toccare la logica `selectedClientId` di FIX-08).
- (b) `components/shared/ClientAutocomplete.tsx`: i suggerimenti si chiudono troppo presto (probabile `onBlur`/click-outside che scatta prima della selezione, o stato che si resetta). Fai in modo che la lista **resti visibile finché**: l'utente seleziona un suggerimento **oppure** modifica il testo (e i risultati si aggiornano di conseguenza). Usa `onMouseDown`/`onPointerDown` per la selezione (così non scatta il blur prima del click) o un click-outside controllato.
**Accettazione:** in entrambi i punti, digitando ≥2 lettere i suggerimenti compaiono e **restano** finché non seleziono o cambio il testo.

## T-4 — Iniziali avatar insensate ("DD") e casing incoerente
**Causa confermata:** in `app/(app)/layout.tsx` (righe ~65-76) le `initials` passate all'avatar derivano da `user_metadata.full_name` / prefisso email del **nome account**, non dalla ragione sociale → "DD" non corrisponde all'azienda; il casing può variare altrove.
**Fix atteso:** calcolare le iniziali dell'avatar dalla **ragione sociale** del workspace (`workspace.ragione_sociale ?? workspace.name`), **sempre `toUpperCase()`**, coerenti con quelle del logo (`WorkspaceLogo` già lo fa). Una sola fonte/logica per le iniziali, usata sia dal logo sia dall'avatar.
**Accettazione:** con ragione sociale "Test eli 2" l'avatar mostra "TE" (maiuscolo), uguale dappertutto.

## T-12 — Email: rendere esplicito che le risposte arrivano all'artigiano
**Stato:** il `reply-to` è già impostato sull'email dell'owner (`send-email/route.ts:401`) → le risposte arrivano davvero all'artigiano, anche se il mittente è `noreply@…`.
**Fix atteso (chiarezza):** nel corpo dell'email al cliente (`components/email/PreventivoEmail.tsx`), oltre alla frase "rispondi a questa email", mostra l'**email dell'artigiano come link cliccabile** (`mailto:`), così il cliente la vede e può scriverle direttamente. Passa l'email dell'owner al template dalla route (è già disponibile come `user.email`/reply-to). Non esporre altri dati personali.
**Accettazione:** l'email ricevuta dal cliente mostra un contatto email cliccabile dell'artigiano; rispondendo (o cliccando) il messaggio arriva all'artigiano.

## T-13 — Tasto "Importa da preventivo" sempre chiaro
**Sintomo:** nella sezione Fatture il tasto per creare una fattura da un preventivo non ha un'etichetta chiara/sempre visibile.
**Fix atteso:** in `fatture/_components/CreateFromPreventivoButton.tsx`, etichetta esplicita e **sempre visibile** (anche su mobile): testo tipo **"Importa da preventivo"** (niente solo-icona, niente `hidden sm:inline` sulla label).
**Accettazione:** in Fatture il tasto mostra sempre "Importa da preventivo".

---

## Criteri di accettazione globali
1. Tutti i punti sopra risolti (T-18 e T-8 con indagine confermata); nessuna regressione su FIX precedenti (in particolare FIX-08 conflitto cliente, FIX-19 quantità).
2. T-7 verificato su viewport stretto (360px): dialoghi scrollabili, X sempre raggiungibile.
3. Nessun dato salvato cambiato; nessuna nuova tabella.
4. `npx tsc --noEmit` e `npm run build` verdi; `npm test -- --run` se toccate voci/validazioni.

## Definition of Done
- Ogni punto con causa citata (file/riga) e fix; T-18/T-8 con nota su cosa hai trovato.
- Test in formato sez. C di CLAUDE.md.
- CLAUDE.md aggiornato; commit `fix(mobile): dialog scroll + catalogo 1a riga + suggerimenti + iniziali + share + email contatto`.
- A fine task: `git push` e conferma che `git log origin/master --oneline -1` mostra il nuovo commit.
