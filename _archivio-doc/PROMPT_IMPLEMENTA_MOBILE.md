# PROMPT CODE — Implementazione redesign MOBILE (fedele ai mockup, a fasi)

> Incolla in Claude Code. Lavoro lungo: procedi **a FASI**, una alla volta, con **commit + push a fine di OGNI fase** (così niente va perso e Eli può controllare). Dopo ogni fase fermati un attimo e riparti con la successiva.

## Regole (valide per tutte le fasi)
- **Leggi prima**: `CLAUDE.md`, `DECISIONI_REDESIGN_MOBILE.md`, `AUDIT_FUNZIONI_MOBILE.md`, `mockup-mobile/DESIGN_TOKENS.md`. Non annullare decisioni già prese.
- **Fonte di verità visiva = i file `mockup-mobile/*.html`** (layout, spaziature, copy, colori, ombre, icone). Riprodurli **fedelmente, senza deviazioni**. Sono HTML statici: traducili nei componenti React/Tailwind esistenti ottenendo lo **stesso identico risultato visivo** (NON incollarli verbatim).
- **Mobile-first SENZA rompere il desktop**: l'app è responsive con gli stessi componenti. Applica il look mobile come base e mantieni il comportamento desktop attuale con i breakpoint (`sm:`/`lg:`). In particolare la **tab bar in basso è solo mobile** (`lg:hidden`); la nav desktop attuale resta (`hidden lg:flex`).
- **Icone**: l'app usa `lucide-react`. I mockup usano Tabler: usa l'icona lucide equivalente.
- **Logo**: usa gli asset in `branding/` (login: `brand-extended-centered-light.svg`).
- Prima di ogni commit: `npx tsc --noEmit` + `npm run build` + `npm test -- --run` **verdi**.
- Risposta nel **formato sez. C** di CLAUDE.md. A fine fase: aggiorna `DECISIONI_REDESIGN_MOBILE.md` (segna la fase fatta), commit, `git push` (e `git push nas master` se il NAS è montato), conferma con `git log origin/master -1`.
- NON toccare `lib/fiscal/calcoli.ts` e `lib/pdf/template.ts` (intoccabili). NON cambiare la logica di business: è un lavoro di **UI/UX**.

## FASE 0 — Fondamenta (design system)
Introduci i **token** di `DESIGN_TOKENS.md` nel tema dell'app (CSS variables / Tailwind theme): palette calda + navy `#1a1a2e` + oro `#c9a44c`, testo/bordi, colori di stato, raggi (13/16/9px, pill), **ombre** (standard / marcata / FAB), font **Inter** (400/500/600). Crea utility/classi riutilizzabili per "scheda con ombra" e "etichetta di sezione maiuscoletto". Applica in modo che valga mobile (e non peggiori il desktop).
Commit: `feat(mobile): design tokens (palette, ombre, raggi, font) per redesign`.

## FASE 1 — Navigazione mobile + pagina "Altro"
- Tab bar in basso (solo mobile): **Home · Preventivi · [+] · Fatture · Altro**, "+" centrale = Nuovo preventivo (vedi nav nei mockup `home_browser.html`/`preventivi.html`/`m_altro.html`).
- Nuova pagina **Altro** (`m_altro.html`): profilo/piano, Strumenti (Clienti, Catalogo, Template, Scadenze), Account (Impostazioni, Abbonamento, Cestino), Esci. Su mobile **Clienti si raggiunge da Altro** (non è un tab).
- Desktop invariato.
Commit: `feat(mobile): bottom nav + pagina Altro`.

## FASE 2 — Liste Preventivi e Fatture
Riproduci `preventivi.html` e `fatture.html`: ricerca, **filtri di stato a una riga** (testo + sottolineatura sull'attivo, spazi uguali), "Ordina", schede con **data contestuale + importo + stato**, badge "Modificato/a". Fatture: in alto "Nuova fattura" + "Da preventivo". Azioni riga (Duplica/Elimina/Invia) nel menu ⋮.
Commit: `feat(mobile): liste preventivi e fatture`.

## FASE 3 — Form Nuovo preventivo / Nuova fattura
Riproduci `nuovo_prev.html` e `nuova_fattura.html`: schede **Cliente · Voci · Altre opzioni (collassabile) · Riepilogo**, **ombre marcate**, voce con descrizione+microfono, Q.tà/Prezzo/Unità, **IVA per voce** (solo regime ordinario) e **sconto per voce**, "Da catalogo", azioni "Salva bozza" + "Invia al cliente". Nuova fattura: Numero+Data, "Totale da pagare".
Commit: `feat(mobile): form nuovo preventivo e nuova fattura`.

## FASE 4 — Dettaglio preventivo / fattura
Riproduci `m_dett_preventivo.html` e `m_dett_fattura.html`: azioni **Condividi · Anteprima** (+ Invia/Reinvia dove previsto), **Crea fattura**; **banner accettazione con firma** (nome · data · IP) quando accettato; **"Altre azioni" a tendina** (Duplica, Cambia stato, Registra invio manuale, Elimina); banner SdI sulla fattura; cronologia. ("Anteprima" = `?preview=1`; NON allegato PDF in email.)
Commit: `feat(mobile): dettaglio preventivo e fattura`.

## FASE 5 — Clienti + Catalogo
- Lista clienti (`clienti.html`) con **"Nuovo cliente"**; dettaglio (`m_dett_cliente.html`); form (`m_form_cliente.html`): **P.IVA/CF campo unico**, ordine **Città→Provincia→CAP**, campo **Paese**, autofill comune già esistente.
- Catalogo (`m_catalogo.html`): elenco voci come scheda, tap voce = **modifica/elimina**, "Nuova voce", suggerimenti ATECO.
Commit: `feat(mobile): clienti e catalogo`.

## FASE 6 — Template, Impostazioni, Abbonamento, Cestino, Login
- Template (`m_template.html` Pro / `m_template_free.html` Free con lucchetti): 4 preset + personalizzazione (colore, font, posizione logo, mostra logo, watermark, note legali).
- Impostazioni (`m_impostazioni.html` Generale / `m_impostazioni_fiscale.html` Fiscale + Notifiche + Piano): tab con sottolineatura.
- Abbonamento (`m_abbonamento.html`): **NO Lifetime**.
- Cestino (`m_cestino.html`). Login (`m_login.html`) con **logo grande** centrato.
Commit: `feat(mobile): template, impostazioni, abbonamento, cestino, login`.

## FASE 7 — Pagina pubblica cliente
Riproduci `m_pubblica.html`: anteprima documento, **Accetta con firma** (nome + firma), **Rifiuta con motivo**, contatto WhatsApp/email. (Rispetta i flussi accept/decline esistenti.)
Commit: `feat(mobile): pagina pubblica con firma e motivo`.

## Definition of Done (per fase)
Schermata/e fedeli al mockup corrispondente; mobile ok senza rompere desktop; tsc+build+test verdi; `DECISIONI_REDESIGN_MOBILE.md` aggiornato; commit + push; conferma `git log origin/master -1`. Riporta in sez. C cosa è stato fatto e cosa resta.
