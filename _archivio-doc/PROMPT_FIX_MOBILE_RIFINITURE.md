# PROMPT CODE — Rifiniture/correzioni redesign mobile (post-audit)

> Incolla in Claude Code. **Leggi prima** `DECISIONI_REDESIGN_MOBILE.md` (sez. A AGGIORNATA), `mockup-mobile/DESIGN_TOKENS.md` e i mockup citati. Fonte di verità visiva = i mockup `mockup-mobile/*.html`. Mobile-first, NON rompere il desktop. tsc+build+`npm test -- --run` verdi prima di OGNI commit; push a fine di ogni punto (o a gruppi). Formato sez. C.

Un audit ha rilevato gli scostamenti sotto rispetto ai mockup. Correggili tutti.

## 1. (PRIORITÀ) Navigazione — "+" centrale, Clienti dentro "Altro"
Stato attuale: la bottom nav usa "+" **flottante** e tiene **Clienti come tab**. È SBAGLIATO (seguiva una versione vecchia del file decisioni).
Correggi in `components/mobile/BottomNav.tsx` (+ `AppShell.tsx` se serve) per matchare i mockup `home_browser.html` / `m_altro.html`:
- 5 slot: **Home · Preventivi · [ + ] · Fatture · Altro**, con il **"+" CENTRALE** integrato nella barra (FAB al centro, come nei mockup: cerchio navy con `margin-top:-14px`, label "Preventivo"). Niente FAB flottante in basso a destra.
- **Rimuovi "Clienti" dai tab.** Clienti si raggiunge solo da "Altro" (è già presente in `altro/page.tsx` → Strumenti). Quindi i tab sono Home, Preventivi, Fatture, Altro + "+".
- Su una pagina raggiunta da "Altro" (es. Clienti), il tab attivo evidenziato è **Altro**.
- Verifica che il "+" centrale non si sovrapponga ai tab e resti cliccabile; desktop invariato.

## 2. Campo "Paese" mancante (ClientForm)
In `app/(app)/clienti/_components/ClientForm.tsx` manca il campo **Paese** (mockup `m_form_cliente.html`, scheda Indirizzo, valore default "Italia"). Aggiungilo nella scheda Indirizzo, dopo la riga Città/Provincia/CAP. Aggiungi anche il campo allo schema/azione di salvataggio solo se già supportato dallo schema `clients`; altrimenti rendilo visivo con default "Italia" senza rompere il submit (segnala se manca la colonna).

## 3. "Nuova fattura" non in stile schede (FatturaForm)
`app/(app)/fatture/_components/FatturaForm.tsx` non è stato migrato: usa ancora `rounded-lg border bg-card`, "Altre opzioni" con ▲/▼, sezione "Informazioni". Portalo allo **stesso stile a schede** di `PreventivoForm` come da mockup `nuova_fattura.html`: schede `cc-card-md` (Cliente · Voci · Altre opzioni collassabile con icona ChevronDown · Riepilogo "Totale da pagare"), `cc-section-label`, ombre marcate, bottoni navy. Mobile-first, desktop ok.

## 4. P.IVA / Codice Fiscale nella tab sbagliata (Impostazioni)
Sposta **P.IVA e Codice Fiscale** dalla tab **Generale** (`impostazioni/tabs/generali.tsx`) alla tab **Fiscale** (`impostazioni/tabs/fiscali.tsx`), come da mockup: `m_impostazioni.html` (Generale = Logo, Ragione sociale, Email, Indirizzo) e `m_impostazioni_fiscale.html` (Fiscale = Regime, P.IVA, Codice Fiscale, Marca da bollo automatica, Ritenuta d'acconto).

## 5. Tab Impostazioni in stile schede
`impostazioni/tabs/generali.tsx`, `fiscali.tsx`, `notifiche.tsx`, `piano.tsx` usano ancora `Card` shadcn. Portali allo stile **`cc-card-md` + `cc-section-label`** come i mockup impostazioni (schede bianche con ombra, etichette in maiuscoletto). Struttura tab invariata (Generale/Fiscale/Notifiche/Piano).

## 6. Catalogo: riga tappabile = modifica
In `catalogo/_components/CatalogItemRow.tsx` la riga non è tappabile (3 bottoni icona inline). Come da mockup `m_catalogo.html`: la **riga intera è tappabile → modifica**, con **chevron a destra**. Le azioni Nascondi/Elimina spostale dentro la modifica o in un menu, non inline sulla riga.

## 7. Template: etichetta "Pro" errata sul Classico
In `template/page.tsx` (~riga 164) il preset **Classico** (Free) mostra "Pro" quando non è attivo. Correggi: il Classico non deve mai mostrare "Pro" (è il modello gratuito). Mostra "Pro" solo sui preset effettivamente Pro (Bold/Tecnico/Elegante).

## Nota (NON fix ora)
`contactPhone` è `null` in `p/[token]/page.tsx` perché lo schema `workspaces` non ha un campo telefono → il pulsante WhatsApp non compare. È un limite-dati noto; lasciare così (eventuale feature futura: aggiungere il telefono al workspace).

## Definition of Done
Tutti i punti 1–7 allineati ai mockup; mobile ok senza rompere desktop; tsc+build+test verdi; aggiorna `DECISIONI_REDESIGN_MOBILE.md`; commit(s) + push; conferma `git log origin/master -1`. Riporta in sez. C cosa è stato corretto.
