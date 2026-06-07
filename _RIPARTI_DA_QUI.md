# _RIPARTI_DA_QUI — istruzioni di ripartenza per l'assistente (Cowork/Dispatch)

> Eli incolla "Leggi `_RIPARTI_DA_QUI.md` e dimmi a che punto siamo" all'inizio di ogni sessione.
> Questo file dice all'assistente come riprendere il lavoro su **Carta Canta** senza spiegazioni ripetute.

## Cosa devi fare, assistente, appena leggi questo file
1. **Leggi in quest'ordine** (nella cartella del progetto `C:\Users\Public\carta-canta`):
   - la tua **memoria** (regole di lavoro + contesto, caricata automaticamente);
   - `HANDOFF_STATO_PROGETTO.md` — indice e roadmap;
   - `BACKLOG_MIGLIORAMENTI.md` — elenco miglioramenti/fix con ordine e stato (sezione **G** = fix trovati in test);
   - `CLAUDE.md` — memoria tecnica e handoff delle sessioni di Claude Code (sezione A in cima = ultima sessione);
   - i file `PROMPT_FIX_*` e `PROMPT_IMPROVE_*` pertinenti al prossimo passo.
2. **Controlla lo stato reale del codice** con `git log --oneline -5` per vedere l'ultimo commit/fix applicato.
3. **Riassumi a Eli in poche righe**: dov'eravamo, cosa è stato fatto per ultimo, e qual è il **prossimo passo** secondo l'ordine del backlog. Poi **chiedi conferma** prima di procedere.

## Ruoli e flusso (non cambiarli)
- **Io (assistente in Cowork) pianifico e verifico**; **Claude Code implementa**. Preparo prompt "blindati" (cosa/come/dove, niente interpretazioni) che Eli incolla in Claude Code; poi **verifico io nel codice reale** il risultato.

## Le 4 regole fisse (valgono sempre)
1. La frase/blocco **da incollare a Code va SEMPRE in fondo** al messaggio.
2. Alla **fine di ogni fase di Code, verifico nel codice reale** che tutto sia stato modificato correttamente (non mi fido del solo riepilogo).
3. Nei messaggi di fix, **prima del blocco da incollare** metto un **riassunto "cosa testare"**.
4. Quando Eli incolla l'output di Code, **se emerge un'azione manuale a suo carico** (migration su Supabase, variabile su Vercel, push NAS da `moian`, DNS, ecc.) **glielo segnalo in fondo**, evidenziato (lui non legge i messaggi di Code).

## Fatti operativi
- Percorso progetto: `C:\Users\Public\carta-canta` (spostato da `C:\progetti\carta-canta`).
- Deploy: `git push` (origin → Vercel, ~1-3 min, https://cartacanta.app). Backup NAS `git push nas master` funziona **solo con l'utente `moian`** (con `elisa` fallisce).
- Ordine di lavoro: vedi `BACKLOG_MIGLIORAMENTI.md` → "ORDINE DI ESECUZIONE CONSIGLIATO".
- Da fare lato Eli (non codice): DMARC e ToS/Privacy/Cookie (iubenda).
