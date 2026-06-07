# PROMPT CODE — FIX 03: numerazione documenti e prefisso "Prev"

> Incolla in Claude Code. Autocontenuto. **Leggi prima `CLAUDE.md` (sez. B.3 numerazione) e `MAPPA_APP.md`.** Rispetta le regole CLAUDE.md.
> Tema: la numerazione è incoerente e il prefisso legacy "Prev" riaffiora, anche sul documento che vede il cliente.

## Problemi da risolvere

### FIX-8 — Il prefisso "Prev" riaffiora (anche lato cliente) ⚠️ il più visibile
**Sintomi:**
- Nel campo "Numero preventivo" del form compare **"Prev009/2026"**.
- L'export CSV mescola numeri con prefisso ("Prev009/2026", "Prev008/2026"…) e senza ("010/2026", "011/2026").
- La **pagina pubblica del cliente** mostra **"#Prev009/2026"** nell'intestazione del documento.
**Contesto:** per i documenti recenti il numero è `NNN/AAAA` senza prefisso; alcuni documenti legacy hanno il prefisso "Prev"/"Fatt" salvato nel DB. `formatDocNumber()` in `lib/utils/index.ts` lo strippa per la visualizzazione, ma alcuni punti **non** usano `formatDocNumber` e mostrano il valore grezzo.
**Fix atteso:** applicare lo strip del prefisso (via `formatDocNumber`) in TUTTI i punti di visualizzazione, in particolare:
- il valore mostrato nel campo "Numero" dei form preventivo/fattura (`PreventivoForm.tsx`, `FatturaForm.tsx`);
- l'intestazione del documento nella pagina pubblica (`app/p/[token]/page.tsx`) e in `buildPdfHtml` se riceve il numero grezzo;
- l'export CSV (`app/api/preventivi/export-csv/route.ts`, `app/api/fatture/export-csv/route.ts`).
Mantieni la differenziazione in-app "Fatt. " per le fatture dove già prevista (CLAUDE.md B.3), ma **mai** il prefisso legacy "Prev"/"Fatt" grezzo verso il cliente.

### FIX-9 — Numerazione bozze incoerente ("–" vs numero)
**Sintomo:** in lista alcune bozze hanno il numero (008, 009, 012), altre compaiono come **"–"** (nessun numero); anche nel CSV alcune righe hanno numero vuoto.
**Causa da confermare:** CLAUDE.md B.3 dice che il numero viene assegnato **subito alla creazione** per ogni nuovo documento; le bozze "–" sono probabilmente documenti creati prima di quella modifica, oppure un percorso di creazione che non chiama `allocateDocNumber`. Verifica `createDocumentAction` e gli altri entry point.
**Fix atteso:** decidere e rendere coerente: ogni bozza mostra un numero (assegnato alla creazione) — oppure, se si sceglie di non assegnarlo alle bozze, mostrare un placeholder uniforme ("Bozza senza numero") invece di "–" misto a numeri. Allinea il comportamento alla decisione di CLAUDE.md B.3 (assegnazione immediata) e correggi i casi che sfuggono.
**File:** `lib/actions/documents.ts` (`createDocumentAction`, `allocateDocNumber`), liste `preventivi/page.tsx`, `fatture/page.tsx`.

### FIX-10 — Helper text del numero contraddittorio
**Sintomi:** nel nuovo preventivo: *"Le bozze non hanno un numero ufficiale. Il numero definitivo viene assegnato automaticamente all'invio."* — ma le bozze hanno il numero; altrove: *"Numero manuale — verrà usato all'invio."*
**Fix atteso:** un solo messaggio coerente con la logica reale (B.3: numero assegnato alla creazione, modificabile manualmente). Rimuovere la frase fuorviante sulle "bozze senza numero".
**File:** `app/(app)/preventivi/_components/PreventivoForm.tsx`, `FatturaForm.tsx`.

## Criteri di accettazione
1. Nessun "Prev"/"Fatt" grezzo visibile: form, pagina pubblica cliente, PDF, CSV. (Le fatture in-app possono mostrare "Fatt. 001/2026" come da B.3, ma mai "Prev…".)
2. Le bozze hanno una rappresentazione del numero **uniforme** (niente mix numero/"–").
3. Helper text unico e veritiero.
4. `tsc` + `build` verdi; nessuna regressione su `formatDocNumber` (mantieni/aggiorna il relativo test se presente).

## Definition of Done
- Causa confermata; file/riga. Test sez. C (mostra un export CSV e una pagina pubblica come prova). CLAUDE.md aggiornato.
- Commit `fix(numerazione): strip prefisso Prev ovunque + bozze coerenti + helper text`.
