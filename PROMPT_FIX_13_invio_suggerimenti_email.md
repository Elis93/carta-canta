# PROMPT CODE — FIX 13: rifiniture invio (suggerimenti, popup auto, email, label, invio senza voci)

> Incolla in Claude Code. Autocontenuto. **Leggi prima `CLAUDE.md` e `DECISIONI_E_FEEDBACK.md` (non annullare le voci ✅).** Rispetta le regole (tsc+build verdi; se tocchi voci/validazioni `npm test -- --run`; formato sez. C; push a fine task).
> Lavora SOLO su `master` in `C:\Users\Public\carta-canta` — niente worktree, niente branch `claude/*`.
> Punti emersi dal 2° test mobile. Alcuni sono **fix precedenti che non hanno funzionato** (T-18, T-13) → vanno rifatti meglio.

## T-12bis — Semplificare il testo email contatto
**Dove:** `components/email/PreventivoEmail.tsx` (~righe 128-133). Oggi: "Per qualsiasi domanda, rispondi direttamente a questa email o scrivimi a {email}".
**Fix:** lasciare solo **"Per qualsiasi domanda scrivimi a {email}"** (rimuovere "rispondi direttamente a questa email o"). L'email cliccabile (`mailto`) resta.

## T-19 — Il reload di una bozza riapre da solo il popup invio
**Sintomo:** ricaricando la pagina di una bozza, dopo il caricamento si riapre da solo il popup di invio.
**Causa:** l'apertura automatica è pilotata da `?send=1` nell'URL (via `SendEmailDialogController` / `initialOpen`), ma il parametro **resta** nell'URL → ad ogni reload riparte.
**Fix:** dopo aver aperto automaticamente il popup, **rimuovere `?send` dall'URL** (es. `router.replace` sul pathname senza il parametro, o `history.replaceState`). Così un reload non lo riapre. Non cambiare il comportamento del primo arrivo con `?send=1` (deve ancora aprirsi una volta).
**Accettazione:** apro un preventivo con `?send=1` → popup si apre una volta; ricarico la pagina → il popup **non** si riapre.

## T-13bis — Su mobile manca l'etichetta "Importa da preventivo"
**Sintomo:** su mobile si vede solo l'icona, senza la scritta "Importa da preventivo".
**Da fare:** trova **quale** bottone l'utente vede su mobile (probabilmente non `CreateFromPreventivoButton` ma un bottone d'intestazione nella pagina/lista Fatture, o `LinkToPreventivoButton`, che usa `hidden sm:inline` sulla label). Rendi l'etichetta **"Importa da preventivo" sempre visibile anche su mobile** sul bottone che serve davvero a importare/creare da preventivo. Verifica su 360px.
**Accettazione:** su 360px il tasto per importare da preventivo mostra la scritta accanto all'icona.

## T-18bis — Suggerimenti cliente: non compaiono nel popup, spariscono nel form
**Sintomo:** (a) nel **popup invio** i suggerimenti non compaiono; (b) nella sezione **Cliente del preventivo** compaiono ma spariscono subito. (Il fix precedente — onBlur 300ms + onPointerDown — non è bastato.)
**Ipotesi forte da verificare:**
- (a) Nel popup, la tendina dei suggerimenti viene **tagliata** dal nuovo `overflow-hidden`/`overflow-y-auto` del `DialogContent` (introdotto col fix T-7). 
- (b) Nel form, lo stato `open` della tendina si resetta a un re-render (es. `markDirty`/onChange) o per click-outside troppo aggressivo.
**Fix atteso:** rendere la tendina dei suggerimenti un **Popover Radix con portale** (renderizzato su `document.body`, come già fanno `ClientAutocomplete`/`CatalogPicker` per evitare il clipping da `overflow`), **non modale**, che **non ruba il focus** all'input e **resta aperta** finché: l'utente seleziona un suggerimento **oppure** modifica il testo (i risultati si aggiornano). Applicare sia al popup invio (`SendEmailDialog` `ClientSearchInput`) sia al form (`ClientAutocomplete`). Non reintrodurre il falso conflitto cliente di FIX-08 (la logica `selectedClientId` resta).
**Accettazione:** in entrambi i punti, digitando ≥2 lettere i suggerimenti **compaiono e restano** finché non seleziono o cambio testo; nel popup invio non sono tagliati dal bordo del dialog.

## T-20 — [INDAGINE] Invio "senza voci" dalla toolbar
**Sintomo:** rimuovendo tutte le voci nel form (senza salvare) e poi cliccando "Invia" dalla toolbar, l'invio parte comunque.
**Causa da confermare:** l'invio dalla toolbar (`SendEmailDialog`) valida `hasVoci`/voci sul **documento salvato nel DB**, non sullo stato corrente (non salvato) del form. Quindi togliere le voci nel form senza salvare non blocca l'invio (parte la versione salvata).
**Fix atteso (scegli la via più sicura e segnalala):**
- Preferibile: se ci sono **modifiche non salvate** nel form, l'invio dalla toolbar deve prima avvisare/salvare, oppure essere disabilitato finché non si salva; **e** la validazione "almeno una voce completa" deve riflettere lo stato che verrà inviato. In ogni caso, **non deve essere possibile inviare un documento senza almeno una voce completa**.
- Se la soluzione completa è invasiva, implementa almeno il blocco robusto "niente invio senza una voce completa" sul documento effettivamente inviato, e **segnala** il resto.
**Accettazione:** non si riesce a inviare un preventivo/fattura privo di voci complete, in nessun percorso (toolbar o bottone in fondo).

---

## Criteri di accettazione globali
1. Tutti i punti risolti (T-20 con indagine confermata); T-18bis verificato che i suggerimenti restano e non sono tagliati.
2. Nessuna decisione ✅ del registro annullata; nessuna regressione su FIX-07/08/11/12 (conflitto cliente, dialog scroll, sconto).
3. Nessun dato salvato cambiato in modo imprevisto; nessuna nuova tabella.
4. `tsc` + `build` verdi; `npm test -- --run` se tocchi voci/validazioni.

## Definition of Done
- Ogni punto con causa (file/riga) e fix; T-20 con nota su cosa hai trovato/scelto.
- Test in formato sez. C di CLAUDE.md.
- CLAUDE.md aggiornato; aggiorna lo stato in `DECISIONI_E_FEEDBACK.md`/`BACKLOG` (T-13/T-18 → ✅ se risolti, T-19/T-20/T-12bis idem).
- Commit `fix(invio): suggerimenti portale + no popup al reload + email + label mobile + invio voci`; `git push`; conferma `git log origin/master --oneline -1`.
