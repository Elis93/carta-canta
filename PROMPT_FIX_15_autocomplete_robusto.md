# PROMPT CODE — FIX 15: riscrivere l'autocomplete cliente in modo ROBUSTO (T-18, definitivo)

> Incolla in Claude Code. Autocontenuto. **Leggi prima `CLAUDE.md` e `DECISIONI_E_FEEDBACK.md` (non annullare le voci ✅).** Regole: tsc+build verdi; `npm test -- --run` se tocchi voci/validazioni; formato sez. C; push a fine task. Lavora SOLO su `master`, niente worktree.

## Contesto (importante)
Il bug "suggerimenti cliente che compaiono e spariscono subito" è già stato "corretto" **due volte** (onBlur 300ms + onPointerDown; poi Radix Popover + `onInteractOutside`/`onOpenAutoFocus`) e **continua a non funzionare** nel test reale. La causa è un'interazione sottile di focus/dismiss della libreria Radix Popover, difficile da chiudere "alla cieca". **NON aggiungere un altro patch a Radix.** Sostituisci il meccanismo con una tendina **semplice, autonoma e robusta**.

## Cosa fare — `components/shared/ClientAutocomplete.tsx` e il `ClientSearchInput` dentro `app/(app)/preventivi/_components/SendEmailDialog.tsx`
Riscrivi la tendina dei suggerimenti **senza Radix `Popover`/`PopoverContent`/`DismissableLayer`**, con questo pattern robusto e identico nei due componenti:

1. **Markup:** un wrapper `<div className="relative">` che contiene l'`<input>` e, subito sotto, la lista dei suggerimenti come `<ul>` **posizionata in assoluto** (`absolute left-0 right-0 top-full mt-1 z-50`), con sfondo, bordo, ombra, `max-h-64 overflow-y-auto`.
2. **Quando è aperta (`open`):** `open = isFocused && query.trim().length >= 2 && (loading || results.length > 0)`. (Niente stato che si auto-resetta da librerie esterne.)
3. **Selezione robusta:** ogni voce della lista usa **`onMouseDown={(e) => { e.preventDefault(); handleSelect(c) }}`** (NON `onClick`). `onMouseDown` + `preventDefault` scatta **prima** del `blur` dell'input → la selezione avviene senza che il blur chiuda la lista prima. (Per touch va comunque bene `onMouseDown`/`onPointerDown` con `preventDefault`.)
4. **Chiusura:** la lista si chiude **solo** quando: (a) si seleziona una voce; (b) si preme `Esc`; (c) l'input perde davvero il focus verso un elemento **fuori** dal wrapper. Per (c) usa `onBlur` con un piccolo `setTimeout(…, 120)` **oppure** un listener `mousedown` su `document` che chiude solo se il click è fuori dal wrapper (`wrapperRef.current.contains(e.target)` → non chiudere). Digitare o cliccare **dentro** l'input/lista NON chiude.
5. **Niente furto di focus:** la lista non deve mai spostare il focus dall'input (è un semplice `<ul>`, non un layer modale). L'utente continua a digitare e i risultati si aggiornano.
6. **Clipping nei dialog:** nel popup invio (dentro `DialogContent` con `overflow-y-auto`) la lista assoluta scorre col contenuto del dialog — va bene. Se in un caso specifico la lista risultasse tagliata, alza lo `z-index` e verifica che il contenitore scrollabile la contenga; **non** reintrodurre Radix Popover per questo.
7. Mantieni invariata la logica esistente di ricerca (`searchClientsAction`/`filterClients`, debounce) e di selezione (incluso `selectedClientId` di FIX-08 nel SendEmailDialog: non reintrodurre il falso conflitto cliente).

## Criteri di accettazione (sono UI — vanno verificati nel browser da Eli, ma il codice deve seguire esattamente il pattern sopra)
1. Digitando ≥2 lettere nel campo cliente (sia nel **form preventivo** sia nel **popup invio**), i suggerimenti **compaiono e RESTANO** finché non seleziono una voce o cambio il testo.
2. Cliccando/toccando un suggerimento, viene selezionato (la lista non si chiude prima del click).
3. La lista si chiude solo su selezione, Esc, o clic davvero fuori dal campo.
4. Nessuna regressione su selezione/associazione cliente (FIX-08) né sull'invio.
5. `tsc` + `build` verdi.

## Definition of Done
- Riscrittura applicata a **entrambi** i punti (ClientAutocomplete + ClientSearchInput del SendEmailDialog), pattern identico; niente Radix Popover per i suggerimenti.
- Test sez. C; aggiorna T-18 in `DECISIONI_E_FEEDBACK.md` (rimettilo come "🟡 da riconfermare nel test", NON ✅ finché Eli non lo verifica).
- Commit `fix(invio): autocomplete cliente robusto senza Radix Popover (T-18 definitivo)`; `git push`; conferma `git log origin/master -1`.
