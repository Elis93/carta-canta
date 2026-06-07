# PROMPT CODE — FIX 05: dashboard, coerenza copy e micro-UX

> Incolla in Claude Code. Autocontenuto. **Leggi prima `CLAUDE.md` e `MAPPA_APP.md`.** Rispetta le regole CLAUDE.md.
> Tema: insieme di correzioni piccole ma a basso rischio e alto ritorno percepito. Possono stare in un'unica sessione.

## Problemi da risolvere

### FIX-15 — Dashboard: KPI "del mese" si contraddicono con le liste "totali"
**Sintomo:** la dashboard mostra *Preventivi accettati 0 · Valore 0,00 € · **-100%** giugno vs mese scorso*, mentre la pagina Preventivi mostra *Accettati 2 · €103*. L'utente lo legge come un bug. Inoltre "-100%" in rosso al 2° giorno del mese è demoralizzante.
**Fix atteso:** (a) etichettare chiaramente le KPI come "questo mese" (titolo/sottotitolo) così non confliggono con i totali; (b) non mostrare un calo "-100%" aggressivo quando il mese è appena iniziato / il dato precedente è poco significativo (es. nascondere il delta se mese in corso < N giorni o se il valore corrente è 0 per inizio periodo). Mantienere il comportamento, solo presentazione più sensata.
**File:** `app/(app)/dashboard/page.tsx`, `components/dashboard/KpiCard.tsx`.

### FIX-16 — Empty state sbagliato sui filtri (es. "Rifiutati")
**Sintomo:** il tab "Rifiutati" senza risultati mostra *"Nessun preventivo ancora — Crea il primo preventivo"*, fuorviante (i preventivi esistono).
**Fix atteso:** distinguere "nessun documento in assoluto" da "nessun risultato per questo filtro/ricerca". Per un filtro vuoto: messaggio tipo *"Nessun preventivo rifiutato"* senza CTA "Crea il primo".
**File:** `app/(app)/preventivi/page.tsx` (e, se presente, analogo in `fatture/page.tsx`).

### FIX-17 — Conteggio "totali" e grammatica sotto ricerca
**Sintomo:** in Fatture, cercando "Pagata" l'intestazione diventa **"1 fatture totali"**: dice "totali" ma conta i filtrati, e la grammatica è errata.
**Fix atteso:** quando c'è un filtro/ricerca attivo mostrare *"N risultati"* (es. "1 risultato"); senza filtro *"N fatture"* con plurale corretto ("1 fattura", "7 fatture").
**File:** `app/(app)/fatture/page.tsx` (e analogo preventivi se presente).

### FIX-18 — Doppio bottone "Nuovo preventivo" sulla dashboard
**Sintomo:** un bottone nell'header e uno identico nell'hero della dashboard, vicinissimi.
**Fix atteso:** tenerne uno solo nella dashboard (l'header lo ha già globalmente). Rimuovere il duplicato nell'hero o sostituirlo con una CTA diversa.
**File:** `app/(app)/dashboard/page.tsx`.

### FIX-19 — Nuova voce: Q.tà e Prezzo a 0 di default
**Sintomo:** una nuova voce nasce con Q.tà 0 (totale 0).
**Fix atteso:** Q.tà di default **1**. (Prezzo può restare 0 finché non inserito.)
**File:** `app/(app)/preventivi/_components/VociTable.tsx`.

### FIX-20 — Modifica voce di catalogo non precarica l'Unità di misura
**Sintomo:** modificando una voce di catalogo (es. "Manodopera idraulica", unità "h"), il select **Unità è vuoto** invece del valore salvato.
**Fix atteso:** precaricare l'unità salvata nel form di modifica.
**File:** `app/(app)/catalogo/_components/CatalogItemForm.tsx` (e `CatalogItemRow.tsx` se gestisce l'edit inline).

### FIX-21 — "AI Import" presentato come incluso mentre è "IN ARRIVO"
**Sintomo:** Piano/Abbonamento elencano *"AI Import — Incluso"*, ma il bottone nel form è **"IN ARRIVO"** disabilitato (flag `NEXT_PUBLIC_AI_IMPORT_ENABLED`).
**Fix atteso:** finché il flag è off, la comunicazione del piano deve dire "AI Import (in arrivo)" o nasconderlo, per non promettere una funzione non attiva. Quando il flag è on, mostrarlo come incluso.
**File:** `lib/stripe/plans.ts` (PLAN_FEATURES / copy), `app/(app)/impostazioni/tabs/piano.tsx`, `app/(app)/abbonamento/page.tsx`.

### FIX-22 — Tasto "+" senza stato hover accanto a "Esporta CSV"
**Sintomo:** il bottone "+" (nuovo) in alto a sinistra non ha hover/cursore, a differenza del bottone export accanto.
**Fix atteso:** stessi stati interattivi (hover, cursor-pointer, focus) degli altri icon-button.
**File:** intestazioni liste `preventivi/page.tsx` / `fatture/page.tsx` (il gruppo bottoni export + nuovo).

### FIX-23 (minore) — Grafico "Andamento" senza scala asse Y
**Sintomo:** le barre non hanno valori di riferimento (l'hover mostra i numeri, ma manca una scala).
**Fix atteso:** aggiungere etichette/asse Y o valore sopra le barre. Basso rischio (recharts già in uso).
**File:** `components/dashboard/RevenueChart.tsx`.

### FIX-24 (minore, valutare) — Avviso nota legale incoerente col regime
**Contesto:** un forfettario può selezionare manualmente la nota "ritenuta d'acconto 20%", fiscalmente incoerente col forfettario. Non è un bug automatico.
**Fix atteso (opzionale):** mostrare un piccolo avviso non bloccante quando la nota legale scelta confligge col regime fiscale del workspace. Se troppo oneroso, lasciare a backlog.
**File:** area template / `LegalNoticeField.tsx`.

### FIX-25 — Mostrare lo stato della FATTURA collegata nella lista preventivi
**Richiesta utente:** nella pagina Preventivi, accanto a un preventivo che ha una **fattura collegata**, mostrare un'etichetta con lo stato di quella fattura: es. **"Fattura: Bozza"**, **"Fattura: Inviata"**, **"Fattura: Pagata"**, ecc.
**Fix atteso:** se un preventivo ha una fattura collegata (relazione via `origin_document_id` sulla fattura che punta al preventivo), recuperare lo stato della fattura e mostrarlo come piccolo badge/etichetta nella riga del preventivo (lista `preventivi/page.tsx`) e/o nel dettaglio.
- ⚠️ Usare gli stati **reali della fattura** (Bozza / Inviata / Pagata / Scaduta / Annullata). NON usare "accettata"/"visto" che sono concetti da preventivo (coerente con il prompt FIX 02).
- Attenzione alla query: serve un join/lookup dalle fatture che hanno `origin_document_id = <preventivo.id>` e `deleted_at IS NULL`. Evita N+1: recupera gli stati in un'unica query per la lista.
**File:** `app/(app)/preventivi/page.tsx` (query + render badge), eventualmente un piccolo componente badge riusando `StatusBadge` con `docType='fattura'`.

## Criteri di accettazione
1. KPI dashboard etichettate come "questo mese"; nessun "-100%" fuorviante a inizio mese.
2. Empty state dei filtri corretto (niente "Crea il primo" quando ci sono documenti).
3. Conteggi/plurali corretti ("1 fattura", "1 risultato").
4. Un solo "Nuovo preventivo" in dashboard.
5. Nuova voce con Q.tà 1; edit catalogo precarica l'unità.
6. Copy "AI Import" coerente col flag.
7. Bottone "+" con hover; grafico con scala Y.
8. Nella lista preventivi, i preventivi con fattura collegata mostrano lo stato della fattura (stati reali fattura, non "accettata"/"visto").
9. `tsc` + `build` verdi.

## Definition of Done
- Per ogni fix, causa confermata e file/riga. Test sez. C. CLAUDE.md aggiornato.
- Commit `fix(ux): dashboard KPI mese + empty state + conteggi + microfix lista/catalogo`.
- NB: sono fix indipendenti; se uno richiede più lavoro del previsto, spostalo in un commit separato senza bloccare gli altri.
