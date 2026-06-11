# PROMPT CODE — FIX 14: messaggio "nessun template" fuorviante + chiarezza invio (T-21)

> Incolla in Claude Code. Autocontenuto. **Leggi prima `CLAUDE.md` e `DECISIONI_E_FEEDBACK.md` (non annullare le voci ✅).** Regole: tsc+build verdi; formato sez. C; push a fine task. Lavora SOLO su `master`, niente worktree.

## T-21a — [BUG] "Nessun template disponibile" è fuorviante
**Sintomo:** sulla pagina di dettaglio di una bozza compare l'avviso giallo **"Nessun template disponibile. Crea un template"**, che spaventa l'utente.
**Causa confermata:** `app/(app)/preventivi/[id]/page.tsx` (~righe 315-323) mostra l'avviso quando `!templates || templates.length === 0`. Ma il form usa **sempre** il template predefinito **Classico** anche senza template personalizzati (vedi righe ~87-88: "Se nessun custom template è attivo, il dropdown mostrerà Default (Classico)"). Quindi il documento si genera comunque: l'avviso è **falso/allarmante**. (Verifica se esiste un avviso analogo anche in `fatture/[id]/page.tsx`.)
**Fix atteso:** **rimuovere** l'avviso allarmante (o sostituirlo con un'informazione gentile e NON di errore, es. piccolo testo muted "Stai usando il template predefinito Classico — puoi crearne uno personalizzato in Template"). Non deve sembrare un problema bloccante, perché non lo è. Applica lo stesso a `fatture/[id]/page.tsx` se presente.
**Accettazione:** su una bozza senza template personalizzati non compare più un avviso giallo allarmante; al massimo un'informazione neutra.

## T-21b — [UX, leggero] Banner piano Free sul dettaglio bozza
**Contesto:** sul dettaglio di una bozza (piano Free) compare "Piano Free · X/8 preventivi inviati · N giorni rimanenti" (`preventivi/[id]/page.tsx` ~righe 260-277). È **voluto** (nudge quota), ma l'utente l'ha percepito come improvviso.
**Fix atteso (solo se a basso rischio):** renderlo **meno prominente** (testo muted/piccolo, non un box colorato grande) quando NON è bloccante (`!freeTrialStatus.blocked`). Quando è bloccante (limite raggiunto) resta evidente. Non rimuovere l'informazione, solo ammorbidirla. Se rischioso, lascia com'è e segnala.
**Accettazione:** il promemoria quota non bloccante è discreto; quello bloccante resta evidente.

## T-21c — [UX, valutazione] Posizione del bottone "Invia al cliente"
**Contesto:** in **creazione** il bottone "Invia al cliente" è in fondo al form; dopo il salvataggio si è sulla **pagina di dettaglio**, dove l'invio è nella **barra in alto**. È coerente con due schermate diverse, ma il cambio di posizione confonde.
**Da fare:** **solo valutazione + eventuale micro-miglioramento a basso rischio** (es. testo/posizione coerente, o un'etichetta chiara). **NON** ristrutturare i flussi. Se non c'è un intervento sicuro, **lascia com'è e annota** la cosa nel report per discuterne con Eli. Non forzare.

---

## Criteri di accettazione
1. T-21a risolto (niente avviso "nessun template" fuorviante); T-21b ammorbidito se sicuro; T-21c solo valutazione/micro-fix.
2. Nessuna decisione ✅ del registro annullata; nessuna regressione.
3. `tsc` + `build` verdi.

## Definition of Done
- T-21a fatto; T-21b/c trattati come indicato (fatti o annotati).
- Test sez. C; aggiorna `DECISIONI_E_FEEDBACK.md`/`BACKLOG` (T-21).
- Commit `fix(ux): messaggio template non fuorviante + banner free discreto`; `git push`; conferma `git log origin/master -1`.
