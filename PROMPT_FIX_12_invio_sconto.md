# PROMPT CODE — FIX 12: preventivo non si invia con sconto globale (T-14)

> Incolla in Claude Code. Autocontenuto. **Leggi prima `CLAUDE.md` e `DECISIONI_E_FEEDBACK.md` (non annullare le voci ✅).** Rispetta le regole (tsc+build verdi; se tocchi `lib/fiscal/` servono i test, coverage 100% — `npm test -- --run`; formato sez. C; push a fine task).
> Lavora SOLO su `master` in `C:\Users\Public\carta-canta` — niente worktree, niente branch `claude/*`.
> **Questo è un INVESTIGA-poi-CORREGGI: prima riproduci e conferma la causa, poi applica il fix giusto. Non indovinare.**

## Sintomo (dal test reale)
Creando un preventivo bozza e cliccando "Invia", l'invio **non parte** e la UI **scrolla alle voci** mostrando un errore. L'utente riferisce che l'unica differenza era aver applicato uno **sconto globale di 50€**.

## Riproduzione richiesta (falla prima di toccare il codice)
1. Nuovo preventivo, **una voce** con descrizione + quantità 1 + un prezzo **piccolo** (es. 40€).
2. Applica **sconto globale fisso 50€**.
3. Clic su "Invia" → osserva: l'invio fallisce? quale messaggio esatto compare? dove scrolla? Il documento viene creato lato server o no?
Riporta nel report cosa hai osservato.

## ⚠️ CAUSA GIÀ CONFERMATA DALL'UTENTE
Eli ha confermato che il **totale faceva circa −40€** → è l'**Ipotesi A**: lo sconto globale (50€) ha superato il subtotale delle voci → **totale negativo**. Riproduci pure per vedere l'errore esatto a valle, ma vai al **fix dell'Ipotesi A**.

## Due ipotesi da verificare
- **Ipotesi A — sconto ≥ subtotale → totale ≤ 0.** In `lib/fiscal/calcoli.ts`: `afterDiscount = subtotal*(1 - pct/100) - discount_fixed` e `total = afterDiscount + iva + bollo - ritenuta`, **senza guardia sui negativi**. Se lo sconto fisso supera il subtotale, il totale diventa 0/negativo → l'invio può fallire (validazione/constraint a valle) e l'errore mostrato è fuorviante.
- **Ipotesi B — voce incompleta.** `getVociError()` in `PreventivoForm.tsx` blocca l'invio se una voce ha descrizione/prezzo/quantità mancanti, e scrolla al banner. In tal caso lo sconto è una coincidenza.

## Fix atteso (in base a cosa confermi)
- **Se è A:** aggiungi una **validazione client-side chiara** PRIMA dell'invio: se lo sconto globale (pct + fisso) renderebbe il **totale < 0**, non inviare e mostra un messaggio **specifico e vicino allo sconto** (es. "Lo sconto globale non può superare il totale delle voci"). NON mostrare il generico errore voci / NON scrollare alle voci. Valuta anche una guardia nel motore fiscale per non produrre mai un totale negativo (se tocchi `lib/fiscal/calcoli.ts` aggiorna/aggiungi i test — coverage 100% obbligatoria). Total = 0 esatto (sconto = totale): consentito o con avviso leggero, ma **non** bloccare in modo fuorviante.
- **Se è B:** rendi il messaggio voci più chiaro e verifica perché lo sconto sembrava il trigger (es. un campo voce azzerato). Correggi la causa reale.

## Criteri di accettazione
1. Con uno sconto che supererebbe il totale → messaggio **chiaro e nel punto giusto** (sullo sconto), niente scroll fuorviante alle voci; l'utente capisce cosa correggere.
2. Con sconto valido (totale > 0) → l'invio funziona normalmente.
3. Nessuna decisione ✅ del registro annullata; nessuna regressione su validazione voci/invio (FIX-01/08/11).
4. `tsc` + `build` verdi; `npm test -- --run` verde (specie se tocchi `lib/fiscal/`).

## Definition of Done
- Causa reale **confermata per riproduzione** (A o B) e citata; fix applicato di conseguenza.
- Test in formato sez. C di CLAUDE.md (cosa hai riprodotto e come).
- CLAUDE.md aggiornato; aggiorna lo stato di T-14 in `DECISIONI_E_FEEDBACK.md`/`BACKLOG` (✅).
- Commit `fix(invio): sconto globale non blocca/confonde l'invio (T-14)`; `git push`; conferma `git log origin/master --oneline -1`.
