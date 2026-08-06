# PROMPT CODE — Fedeltà ASSOLUTA dei mockup mobile (allineamento totale)

> Incolla in Claude Code. Obiettivo: rendere il mobile dell'app **identico** ai mockup, in ogni dettaglio (layout, ordine, copy, spaziature, **ombre**, raggi, colori, font). Eli ha segnalato che alcune pagine, tasti e viste NON sono uguali: vanno resi identici.

## File da leggere PRIMA (in quest'ordine)
1. `mockup-mobile/CC_MOBILE.css` — **token e classi con i valori ESATTI** (ombre, raggi, colori, padding, font-size). Sono i valori inline dei mockup.
2. `mockup-mobile/SPEC_PER_SCHERMATA.md` — struttura esatta per ogni schermata + regole globali + correzioni.
3. `mockup-mobile/*.html` — i mockup: **fonte di verità pixel-per-pixel**.
4. `DECISIONI_REDESIGN_MOBILE.md` (sez. A DEFINITIVA: "+" centrale, Clienti dentro "Altro").

## Metodo (obbligatorio)
1. **Allinea `app/globals.css` a `CC_MOBILE.css`**: le variabili `--cc-*` e le classi (`cc-card`, `cc-card-md`, `cc-section-label`, `cc-search`, `cc-btn-primary`, `cc-btn-outline`, `cc-pill-*`, `cc-tabs`/`cc-tab`/`cc-tab-active`, `cc-row`, `cc-bottomnav`/`cc-navitem`/`cc-fab`, `cc-toggle`) devono avere **esattamente** quei valori. In particolare le **ombre** devono essere le stringhe esatte (`--cc-shadow`, `--cc-shadow-md`, `--cc-shadow-fab`, `--cc-shadow-btn`). Se nel codice attuale divergono (opacità, raggi, padding), **correggile**.
2. **Per OGNI schermata**: apri il mockup corrispondente + la voce in SPEC_PER_SCHERMATA.md, confronta con l'implementazione React attuale e **correggi ogni differenza** (non solo quelle elencate): stesse sezioni, stesso ordine, stessa copy, stessi tasti, stesse classi/ombre/spaziature. Qualsiasi valore non coperto da una classe va **copiato dal mockup** (niente "circa").
3. **Telaio**: la cornice esterna dei mockup (div bianco con `border-radius:16px` + `box-shadow:0 16px 38px…`) è il telaio del telefono, **NON** un elemento app: lo schermo app ha sfondo `--cc-page` e le card galleggiano su di esso (padding schermata 16px).
4. **Mobile-first, NON rompere il desktop** (gating `lg:`). Icone: equivalente lucide.

## Correzioni note già rilevate (da includere, ma NON limitarti a queste)
1. **Navigazione**: "+" **centrale** (FAB nella barra, `cc-fab`, label "Preventivo"), tab **Home·Preventivi·[+]·Fatture·Altro**; **Clienti NON è un tab** (solo dentro "Altro"). Niente "+" flottante. (mockup `home_browser.html`/`m_altro.html`).
2. **Nuova fattura** (`FatturaForm.tsx`): portare allo **stile a schede `cc-card-md`** identico a Nuovo preventivo (`nuova_fattura.html`) — oggi è vecchio stile.
3. **Campo Paese** in `ClientForm.tsx` (scheda Indirizzo, default "Italia") — manca.
4. **P.IVA / Codice Fiscale** → tab **Fiscale** (non Generale): `m_impostazioni.html` (Generale = Ragione sociale, Email, Indirizzo) e `m_impostazioni_fiscale.html`.
5. **Tab Impostazioni** (`generali/fiscali/notifiche/piano.tsx`): convertire allo stile `cc-card`/`cc-section-label` dei mockup (oggi `Card` shadcn).
6. **Catalogo** (`CatalogItemRow.tsx`): riga **tappabile = modifica** con **chevron** a destra; spostare Nascondi/Elimina nella modifica/menu (non inline).
7. **Template**: il preset **Classico (Free) non deve mai mostrare "Pro"**; "Pro" solo su Bold/Tecnico/Elegante.

## Verifica (per ogni schermata, prima del commit)
- Confronta a video con il mockup: sezioni, ordine, copy, tasti, **ombre**, raggi, spaziature, colori = identici.
- (Se possibile) genera screenshot mobile (375px) e confronta. Altrimenti verifica per ispezione che classi/valori coincidano con CC_MOBILE.css e con il mockup.
- `npx tsc --noEmit` + `npm run build` + `npm test -- --run` verdi.

## Esecuzione a gruppi (commit + push per gruppo)
- G1: globals.css allineato a CC_MOBILE.css + Navigazione (punto 1).
- G2: Liste (Preventivi, Fatture) + Home.
- G3: Form (Nuovo preventivo, **Nuova fattura** punto 2).
- G4: Dettagli (preventivo, fattura) + Pagina pubblica.
- G5: Clienti (+ **Paese** punto 3) + Catalogo (punto 6).
- G6: Template (punto 7 + Free locks) + Impostazioni (punti 4–5) + Abbonamento + Cestino + Login + Altro.

## Definition of Done
Ogni schermata mobile **identica** al mockup (inclusi tasti, viste e ombre); desktop intatto; tsc+build+test verdi; `DECISIONI_REDESIGN_MOBILE.md` aggiornato; commit + push per gruppo; conferma `git log origin/master -1`. In sez. C riporta, per ogni schermata, "allineata ✅" o le differenze residue.
