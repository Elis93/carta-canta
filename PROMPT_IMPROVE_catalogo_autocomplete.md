# PROMPT CODE — IMPROVE: catalogo che cresce da solo + autocompletamento voci

> Incolla in Claude Code. Autocontenuto. **Leggi prima `CLAUDE.md`, `MAPPA_APP.md` e `BACKLOG_MIGLIORAMENTI.md` (voce AUT-1).** Rispetta le regole CLAUDE.md (tsc + build verdi, formato risposta sez. C, aggiornare CLAUDE.md, commit conventional, mobile-first, mai dichiarare risolto senza causa confermata nel codice).
> **Da eseguire DOPO `PROMPT_FIX_01→07` e `PROMPT_IMPROVE_app_velocita` (M1–M6)**, perché quei prompt rimaneggiano il form voci: costruiamo su un form già assestato.

> ## OBIETTIVO (vincolante — non uscirne)
> Target: **artigiani 20–70 anni poco tecnologici** che rifanno spesso le stesse voci. Questo intervento serve a **far risparmiare ore** sull'inserimento voci e a far sì che il **catalogo si riempia da solo**, senza lavoro extra.
> Sono **due metà della stessa cosa** e vanno insieme: (1) suggerire le voci del catalogo mentre si scrive; (2) salvare nel catalogo una voce digitata, così la volta dopo viene suggerita.
> **Regole assolute:**
> - **NON** aggiungere tabelle nuove. Si usa `catalog_items` (esistente) e le action esistenti `createCatalogItemAction` (in `app/(app)/catalogo/actions.ts`).
> - **NON** cambiare la forma dei dati salvati del documento né gli attributi `name`/payload del form.
> - **NON** rompere la possibilità di scrivere testo libero nella descrizione: i suggerimenti sono un aiuto, non un vincolo. Se l'utente ignora i suggerimenti e scrive a mano, deve funzionare esattamente come oggi.
> - **Mobile-first** (verifica a 360px), tocchi comodi.
> - Se una parte risulta più invasiva del previsto, **implementa la parte sicura e segnala** invece di forzare.

---

## CONTESTO TECNICO (già nel codice — riusare, non reinventare)
- La tabella `catalog_items` ha: `name`, `description`, `unit`, `unit_price`, `vat_rate`, `category`, `is_active`.
- `app/(app)/preventivi/_components/CatalogPicker.tsx` **carica già** il catalogo lato client (`createClient()` → `from('catalog_items').select('*').eq('is_active', true)`) e lo **filtra in memoria** per `name`/`description`/`category`. **Riusa lo stesso schema di caricamento e la stessa mappatura `onSelect`** `{ description, unit, unit_price, vat_rate }`.
- `createCatalogItemAction(formData)` (in `app/(app)/catalogo/actions.ts`) crea una voce di catalogo (campi: `name`, `unit`, `unit_price`, `vat_rate`, `category?`). È la stessa usata da "Salva nel catalogo e aggiungi" del `CatalogPicker`.
- Le voci vivono in `VociTable.tsx`; il campo descrizione è sia nella riga desktop (`lg:grid`) sia nella riga mobile (`lg:hidden`).
- `toast` (sonner) è già in uso nel progetto per i feedback.

---

## PARTE 1 — Autocompletamento descrizione → catalogo

**Dove:** `app/(app)/preventivi/_components/VociTable.tsx` (usato sia da `PreventivoForm` sia da `FatturaForm`).

**Caricamento dati:** carica il catalogo **una sola volta** al mount di `VociTable` (client, stesso pattern del `CatalogPicker`: `is_active = true`). Tienilo in `useState`. **Niente query a ogni battitura**: il filtro è in memoria (come fa già `CatalogPicker` con `filtered`). Se il catalogo è vuoto, la funzione semplicemente non mostra suggerimenti (nessun errore, nessun cambiamento visivo).

**Comportamento:**
- Mentre l'utente digita nel campo **Descrizione** di una riga (≥ 2 caratteri), mostra sotto il campo un piccolo elenco (max 6) di voci di catalogo il cui `name`/`description` contiene il testo (case-insensitive).
- **Cliccando un suggerimento**, compila quella riga con la mappatura del `CatalogPicker`: `description`, `unit`, `unit_price`, `vat_rate`, e **`quantity: 1`** (coerente con FIX-19 / RIF-3). Poi chiudi l'elenco.
- Se l'utente continua a digitare ignorando i suggerimenti, il testo libero resta intatto e tutto funziona come oggi (nessun blocco, nessun auto-completamento forzato).
- L'elenco si chiude su: selezione, blur/clic fuori, `Esc`.

**Implementazione UI (precisa, per non rompere il typing):**
- Usa un **Radix Popover NON modale** (`<Popover>` con contenuto che **non ruba il focus** all'input) ancorato al campo descrizione — oppure un semplice contenitore posizionato in assoluto sotto l'input. **NON** usare un `Dialog`/`Command` modale (ruberebbe il focus e bloccherebbe la digitazione).
- L'input resta un normale `<Input>` controllato come adesso (`value=voce.description`): si aggiunge solo la lista di suggerimenti sotto, non si sostituisce il campo.
- I suggerimenti devono essere **toccabili comodamente** su mobile (riga ≥ 40px).
- Applica lo stesso comportamento sia alla riga desktop (`lg:grid`) sia alla riga mobile.

**Accettazione P1:** digitando "manod" nella descrizione, compare "Manodopera idraulica" (se in catalogo); cliccandola, la riga si compila con unità/prezzo/IVA dal catalogo e Q.tà = 1. Scrivendo una descrizione non in catalogo, nessun suggerimento e il testo resta libero. Su 360px i suggerimenti sono leggibili e toccabili.

---

## PARTE 2 — Salvare nel catalogo dalla riga (il catalogo cresce da solo)

**Dove:** `app/(app)/preventivi/_components/VociTable.tsx` (stessa riga voce).

**Comportamento:**
- Su ogni riga voce, accanto alle azioni esistenti (es. cestino), aggiungi un'azione **"Salva nel catalogo"** (icona + `aria-label`/`title`; su mobile con etichetta o icona ben toccabile ≥ 40px). Suggerimento icona: `PackagePlus` (già importata altrove).
- L'azione è **attiva solo se** la riga ha `description` non vuota **e** `unit_price > 0`. Altrimenti disabilitata (con `title` esplicativo: "Compila descrizione e prezzo per salvarla nel catalogo").
- **Evita duplicati:** se nel catalogo già caricato esiste una voce con lo stesso `name` (confronto case-insensitive, trim) della descrizione, **non** mostrare/abilitare il salvataggio (oppure mostrala come "Già nel catalogo" disabilitata). Niente doppioni.
- Al click: chiama `createCatalogItemAction` con `name = description`, `unit`, `unit_price`, `vat_rate` (e `category` vuota). Al successo: `toast.success("Voce salvata nel catalogo")` e aggiorna la lista catalogo locale (così l'azione diventa "Già nel catalogo" e i suggerimenti la includono subito). In errore: `toast.error(result.error)`.

**Accettazione P2:** scrivo una voce nuova con prezzo, tocco "Salva nel catalogo" → toast di conferma; la stessa voce ora appare tra i suggerimenti (Parte 1) nelle righe successive; ritentando, il salvataggio risulta "Già nel catalogo" e non crea doppioni.

---

## FUORI SCOPO (per ora — non fare)
- **Proposta post-invio** "salvo le N voci nuove nel catalogo?" → fase 2, non in questo prompt.
- Sollevare il caricamento del catalogo a un livello condiviso tra `VociTable` e `CatalogPicker` (oggi caricano separatamente): è un'ottimizzazione (OTT), **non** richiesta qui. Va bene il doppio caricamento in v1; eventualmente annotalo in CLAUDE.md come debito.
- Categorie/gestione avanzata del catalogo.

## Criteri di accettazione globali
1. Autocompletamento funziona su preventivi e fatture, desktop e mobile (360px), senza bloccare il testo libero.
2. Selezione da suggerimento → riga compilata con Q.tà = 1 e prezzo/unità/IVA dal catalogo.
3. "Salva nel catalogo" dalla riga crea la voce (no duplicati) e la rende subito suggeribile.
4. Nessuna nuova tabella; nessun dato del documento cambiato; nessuna regressione su inserimento manuale e su `CatalogPicker`.
5. `npx tsc --noEmit` e `npm run build` verdi.

## Definition of Done
- Parte 1 e Parte 2 implementate come specificato; causa/file/riga citati per ogni modifica.
- Test secondo formato sez. C di CLAUDE.md, con **screenshot mobile** di: suggerimenti descrizione e azione "Salva nel catalogo".
- `BACKLOG_MIGLIORAMENTI.md` aggiornato (AUT-1 → fatto) e CLAUDE.md aggiornato.
- Commit `feat(voci): autocompletamento da catalogo + salva voce nel catalogo`.
