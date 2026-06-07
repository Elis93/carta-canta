# PROMPT CODE — FIX 07: rifiniture di coerenza e micro-UX (residui non coperti)

> Incolla in Claude Code. Autocontenuto. **Leggi prima `CLAUDE.md` e `MAPPA_APP.md`.** Rispetta le regole CLAUDE.md (tsc + build verdi, formato risposta sez. C, aggiornare CLAUDE.md, commit conventional, mobile-first, mai dichiarare risolto senza causa confermata nel codice).
> **Da applicare insieme/dopo `PROMPT_FIX_01→06`.** Questi punti sono emersi rileggendo il codice il 6 giugno 2026: sono residui **non coperti** dagli altri prompt. Tutti di tipo testo/coerenza/default — **nessuna nuova feature, nessuna nuova tabella, nessun cambio di layout dei preset PDF**.

> ## VINCOLI ASSOLUTI (non uscirne)
> - **NON** aggiungere feature, pagine o tabelle.
> - **NON** cambiare il layout dei 4 preset in `lib/pdf/template.ts`: si tocca **solo testo condizionale** (etichette), mai struttura/CSS.
> - **NON** cambiare attributi `name`/`id`/payload dei form né i dati salvati: solo etichette visibili e valori di default.
> - Tutto resta **mobile-first** (verifica a 360px).
> - Se un punto risulta più invasivo di così, **fermati e segnalalo** invece di improvvisare.

---

## RIF-1 — Template "Bold": "Totale da pagare" appare anche sui PREVENTIVI
**Sintomo:** nel preset **Bold** il box totale mostra sempre **"TOTALE DA PAGARE"**. Su una **fattura** è corretto; su un **preventivo** è improprio (un preventivo è da *accettare*, non da pagare).
**Causa confermata nel codice:** `lib/pdf/template.ts`, ramo `case 'bold':`, il box scuro del totale ha l'etichetta hardcoded `Totale da pagare` (intorno a riga ~588) **senza** condizione su `doc_type`. Confronta con il preset Classico che usa `TOTALE` (riga ~456). La variabile `isFattura = doc.doc_type === 'fattura'` è **già disponibile** nello scope (riga ~179).
**Fix atteso (solo testo, niente layout):** nel box totale del preset Bold, usare `isFattura ? 'Totale da pagare' : 'Totale'`. Verificare gli altri preset: ovunque compaia "da pagare"/"pagare" in un punto reso anche per i preventivi, applicare la stessa condizione. Non toccare dimensioni, colori, padding, struttura del box.
**File:** `lib/pdf/template.ts` (solo l'etichetta condizionale).
**Accettazione:** un preventivo con template Bold mostra "TOTALE"; una fattura con template Bold mostra "TOTALE DA PAGARE". Screenshot dei due casi.

## RIF-2 — Intestazione "Voci preventivo" compare anche nelle FATTURE
**Sintomo:** dentro una **fattura** la sezione voci ha l'intestazione **"Voci preventivo"** (concetto da preventivo dentro una fattura — stessa famiglia di problemi di FIX_02).
**Causa confermata nel codice:** `app/(app)/preventivi/_components/VociTable.tsx` ha l'`<h2>` hardcoded **"Voci preventivo"** (riga ~121). Il componente è **condiviso**: `FatturaForm.tsx` importa e usa lo stesso `VociTable` (`import { VociTable } from '@/app/(app)/preventivi/_components/VociTable'`, riga ~16; uso ~381). Quindi l'etichetta errata appare anche sulle fatture. **Questo file NON è nell'elenco di FIX_02 → va corretto qui per non lasciarlo scoperto.**
**Fix atteso:**
- Aggiungere a `VociTable` una prop opzionale `docType?: 'preventivo' | 'fattura'` (default `'preventivo'` per retrocompatibilità).
- L'intestazione diventa: `docType === 'fattura' ? 'Voci fattura' : 'Voci preventivo'`.
- In `FatturaForm.tsx` passare `docType="fattura"` al `<VociTable>`. In `PreventivoForm.tsx` non serve passare nulla (default), ma se preferisci esplicitarlo passa `docType="preventivo"`.
- **Non** rinominare la prop `voci`, `onChange` né altri attributi: solo aggiunta della prop nuova e dell'etichetta condizionale.
**File:** `app/(app)/preventivi/_components/VociTable.tsx`, `app/(app)/fatture/_components/FatturaForm.tsx`.
**Accettazione:** in "Nuova fattura" la sezione si chiama "Voci fattura"; in "Nuovo preventivo" resta "Voci preventivo". Nessuna regressione su mobile/desktop.

## RIF-3 — Voce inserita dal CATALOGO nasce con Q.tà = 0
**Sintomo:** selezionando una voce dal catalogo, la quantità è **0** → totale riga 0 finché l'utente non la corregge. Incoerente con FIX-19 (nuova voce vuota → Q.tà = 1) e fa perdere un passaggio ogni volta.
**Causa confermata nel codice:** in `VociTable.tsx`, il callback `onSelect` del `CatalogPicker` crea la nuova voce con `quantity: 0` in **entrambi** i rami (riga ~142 "sostituisce riga vuota" e riga ~160 "accoda"). 
**Fix atteso:** impostare `quantity: 1` in entrambi i rami dell'inserimento da catalogo. (Allineato a FIX-19; se FIX-19 è già stato applicato a `newVoce`, questo punto completa il caso "da catalogo" che FIX-19 non tocca.)
**File:** `app/(app)/preventivi/_components/VociTable.tsx` (le 2 occorrenze nel callback `CatalogPicker onSelect`).
**Accettazione:** scelgo una voce dal catalogo → la riga nasce con Q.tà 1 e totale già calcolato; prezzo precaricato dal catalogo.

## RIF-4 — VERIFICA (non modificare a priori): troncamento nome cliente lungo
**Contesto:** lo screenshot del 2 giugno segnalava nomi cliente lunghissimi che vanno a capo su più righe nella dashboard "Prossima scadenza" e nelle card "Preventivi in attesa".
**Stato attuale nel codice:** `app/(app)/dashboard/_components/PendingDocCard.tsx` **ha già** `truncate` su titolo (riga ~80) e su `clientName` (riga ~85). Quindi **potrebbe essere già risolto.**
**Cosa fare:** verificare a 360px che titolo e nome cliente si troncino davvero con ellissi (serve un contenitore `min-w-0` perché `truncate` funzioni in flex). Se vanno ancora a capo, aggiungere `min-w-0` al genitore flex e mantenere `truncate`. **Se è già a posto, non toccare nulla e segnalalo nel report.**
**File (solo se serve):** `app/(app)/dashboard/_components/PendingDocCard.tsx`.
**Accettazione:** con un cliente dal nome molto lungo, su 360px il testo si tronca con "…" e non manda a capo la card.

## RIF-5 — VERIFICA (non modificare a priori): placeholder logo grigio
**Contesto:** lo screenshot segnalava un rettangolo grigio al posto del logo nell'header.
**Stato attuale nel codice:** in `app/(app)/_components/AppShell.tsx` il componente `WorkspaceLogo` **ha già** il fallback alle iniziali del workspace quando manca il logo o l'immagine fallisce. Quindi nell'**header dell'app** dovrebbe essere già risolto.
**Cosa fare:** confermare che il rettangolo grigio non compaia più nell'header (con e senza logo). Se il grigio compariva nello **screenshot del documento/anteprima PDF**, quello è il placeholder voluto di `logoEl()` in `lib/pdf/template.ts` quando il workspace non ha logo: **non è un bug**, lascialo. Segnala nel report dove l'avevi verificato. **Nessuna modifica se l'header usa già le iniziali.**
**File (solo verifica):** `app/(app)/_components/AppShell.tsx`, eventualmente `lib/pdf/template.ts`.
**Accettazione:** report che indica lo stato reale (già risolto / dove appare ancora) senza modifiche superflue.

---

## Criteri di accettazione globali
1. Preventivo con preset Bold → "TOTALE"; fattura con preset Bold → "TOTALE DA PAGARE".
2. "Nuova fattura" → sezione "Voci fattura"; "Nuovo preventivo" → "Voci preventivo".
3. Voce da catalogo → Q.tà 1 e totale già calcolato.
4. RIF-4 e RIF-5: report onesto sullo stato (modificato solo se realmente necessario).
5. Nessun cambio di layout dei preset PDF; nessun dato salvato cambiato.
6. `npx tsc --noEmit` e `npm run build` verdi.

## Definition of Done
- RIF-1, RIF-2, RIF-3 implementati come specificato; RIF-4/RIF-5 verificati (modifica solo se serve).
- Causa reale citata (file/riga) per ogni punto modificato.
- Test secondo formato sez. C di CLAUDE.md, con screenshot mobile dei punti RIF-1 e RIF-2.
- CLAUDE.md aggiornato.
- Commit `fix(coerenza): totale preventivo vs fattura + voci fattura + qty catalogo`.
