# CLAUDE.md — Memoria permanente del progetto Carta Canta

> **Fonte di verità per Claude Code.**
> Va aggiornato a fine di ogni sessione con: feature implementate, decisioni prese, bug emersi, cose rimandate.
> Storico sessioni precedenti spostato in `STORICO_SESSIONI.md` (consolidamento doc 14 giu 2026).
> **Ultima sessione:** 17 giugno 2026 (sessione UI-Rev — continuazione 12)

---

## A. HANDOFF — SESSIONE UI-Rev (17 giugno 2026) — continuazione (12)

### Fix applicati — Nuovo preventivo pixel-identical al mockup (1 commit `e75fa36`)

**COMMIT G — globals.css + PreventivoForm + VociTable: form pixel-identical al mockup**

**(1) globals.css:**
- `.cc-card-md`: `border-radius: 13px` → `14px`; shadow → `0 1px 2px rgba(20,20,40,.05), 0 8px 24px -10px rgba(20,20,40,.15)`; `padding: 14px 15px` → `15px 15px`
- `.cc-section-label`: `font-size: 12px` → `11px`; `font-weight: 500` → `600`; `letter-spacing: 0.08em` → `.07em`; `color: var(--cc-text-tertiary)` → `#8a887f`; `margin-bottom: 12px` → `11px`

**(2) PreventivoForm.tsx:**
- Card 1 padding: `14px 15px` → `15px 15px` (inline override)
- "Altre opzioni" toggle: `fontSize 14, fontWeight 500` → `fontSize 15, fontWeight 600`
- Content div: `space-y-4` → `space-y-5` (20px tra i gruppi)
- Rimosso `(opzionale)` da: Numero preventivo, Titolo del lavoro, percentuale bonus
- Label field in "Altre opzioni": `style={{ fontSize: 14, fontWeight: 600, color: '#161616' }}` su tutti i Label
- Note/note interne: `space-y-1.5` → `space-y-2`; Label → `fontSize 14/600/#161616` con sub-text `12px/#8a887f`; Textarea `border #e3e3e6, borderRadius 10, padding 11px 36px 11px 12px`; VoiceInput `right-[11px] top-[11px] text-[#8a887f]`
- Inputs (doc_number, title, validity_days, bonus%): `border #e3e3e6, borderRadius 10, padding 11px 12px, fontSize 13`
- Bonus Switch: `className="data-[state=checked]:bg-[#c9a44c]"` (oro quando attivo)
- Bonus label: mostra `Bonus {bonusPerc}%` in oro invece di "Bonus attivo" con Zap
- `Zap` rimosso dagli import
- "* Campo obbligatorio": `style={{ fontSize: '12px', color: '#b08d3e', margin: '14px 15px 10px' }}`
- Bottone container: `gap: 9` → `gap: 11, padding: '0 15px'`
- "Salva bozza" (create mode): `border #e3e3e6, borderRadius 12, padding 13px, fontSize 14, fontWeight 500`
- "Invia al cliente" (create mode): `flex 1.2, borderRadius 12, padding 13px, fontSize 14, fontWeight 600, boxShadow mockup-exact`

**(3) VociTable.tsx:**
- Textarea descrizione (desktop + mobile): `border #e3e3e6, borderRadius 10, padding 11px 36px 11px 12px, fontSize 13`; rimossi `rounded-md border border-input px-3 py-2 pr-9` dalla className
- VoiceInput (desktop + mobile): `right-[11px] top-[11px] text-[#8a887f]`
- Label colonne mobile (Descrizione, Unità, Q.tà, Prezzo, Sconto, IVA): `fontSize 11, color #8a887f` inline style

### File toccati (sessione UI-Rev — commit 12)
```
app/globals.css                                              [1: cc-card-md, cc-section-label]
app/(app)/preventivi/_components/PreventivoForm.tsx          [2: tutto il form]
app/(app)/preventivi/_components/VociTable.tsx               [3: textarea, VoiceInput, label colonne]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde, tutte le route generate
- `npm test -- --run` → 178/178 verdi
- **Non testato in browser**: verificare da Eli — Nuovo preventivo (form), Altre opzioni aperte, Bonus edilizio attivo.

### Esito finale
🟡 FIX APPLICATO — tsc+build+test verdi. Da verificare in browser da Eli.

---

## A. HANDOFF — SESSIONE UI-Rev (17 giugno 2026) — continuazione (11)

### Fix applicati — Allineamento mockup mobile Commits A–F (6 commit)

**COMMIT A — VociTable: mic overlay, trash top-right, VOCE label, unità 90px** (`ebe4b2d`)

1. Mic `VoiceInput` posizionato in overlay assoluto dentro textarea descrizione (`absolute right-1 top-1 size-6`, parent `relative`; `pr-9` sulla textarea).
2. Trash `Trash2` in alto a destra accanto alla label "VOCE N" (10px, 600, #8a887f). Rimosso dal footer.
3. Label "VOCE N": `fontSize 10, fontWeight 600, color '#8a887f', letterSpacing 0.04em`.
4. Grid mobile unità: `90px` (era `52px`). Grid desktop: `2fr 90px 90px 100px 80px [90px] 32px`.
5. Tutti i campi `style={{ fontSize: 13 }}` uniforme.
6. Asterischi → `<span style={{ color: '#b08d3e' }}>*</span>` (oro, era Tailwind `text-destructive`).
7. Rimossa colonna Tipo (Standard/Trainante/Trainato) completamente dal VociTable.

**COMMIT B — PreventivoForm, FiscalSummary, lib/constants/units** (`c55b5b4`)

8. Note/note-interne: `VoiceInput` in overlay assoluto (`absolute right-1 top-1 size-6`); `pr-9` su Textarea; `fontSize: 13`.
9. "* Campo obbligatorio" asterischi: `style={{ color: '#b08d3e' }}`.
10. Payment terms "Personalizzati": rimosso `name` dal Select; aggiunto `<input type="hidden" name="payment_terms" value={paymentTerms === 'Personalizzati' ? paymentTermsCustom : paymentTerms}>` + Textarea condizionale per testo libero.
11. Scadenza stimata (`dueDateHint`): visibile solo per `docType === 'fattura'` (rimossa per preventivi).
12. Bonus edilizio: `Checkbox` → `Switch` (oro quando attivo); label con `Zap` icon; `onCheckedChange` chiama `setVatRateDefault(10)` / `null`.
13. Nuovo help text bonus: "Percentuale di detrazione, indicata al cliente solo a titolo informativo..."
14. IVA 10% default quando bonus attivo già implementato via `setVatRateDefault`.
15. `lib/constants/units.ts`: aggiunti `{ value: 'a corpo' }` e `{ value: 'cad' }` → 12 unità totali. `PreventivoForm` ora usa `UNIT_VALUES` importato da `lib/constants/units`.
16. `FiscalSummary`: rimosso calcolo trainanti/trainati e relativo render (colonna `bonusEdilizio` rimossa dal destructuring).

**COMMIT C — CatalogPicker: asterischi oro** (`90e5dcf`)

17. Entrambi i `text-destructive` nel form creazione voce → `style={{ color: '#b08d3e' }}`.

**COMMIT D — Dettaglio preventivo: banner oro, azioni 48px, no Salva PDF** (`143c9af`)

18. Banner quota Free: `<p>` testuale → card bianca con bordo sinistro oro 3px, icona ♛, `{N}/{MAX} preventivi gratuiti`, Link "Passa a Pro →".
19. Rimosso info text "Stai usando il template predefinito Classico...".
20. `PdfActions.tsx`: rimosso bottone "Salva o stampa il PDF" — resta solo "Anteprima".
21. `chipBase`: `height: 48, borderRadius: 13, fontSize: 14, border: '1px solid #e7e7ea', boxShadow: '0 1px 2px rgba(20,20,40,.04)'`. Azioni mobili redesign: Anteprima (grigio `#6b6f7a`, Eye), Condividi (navy fill), MobileStatusChips per `sent/viewed`.
22. Nuovo `MobileStatusChips.tsx`: client component con chip Accettato (verde #2f8a63, CheckCircle2) e Rifiutato (rosso #b05656, XCircle) — chiama `PATCH /api/preventivi/[id]/status`.

**COMMIT E — DocumentTimeline: badge pastello per stato** (`084a382`)

23. Ogni fase usa `badgeBg` + `badgeColor` inline style (al posto di Tailwind classes):
    - `created`: bg `#f0f0f2`, icon `#b3b1ab`
    - `sent/resent`: bg `#d8e8fb`, icon `#3f6fb0`
    - `viewed`: bg `#fbe1ee`, icon `#c25b91`
    - `accepted/restored/fattura`: bg `#d4efe2`, icon `#2f8a63`
    - `rejected`: bg `#f5dede`, icon `#b05656`
    - `expired/expires`: bg `#f5e9d0`, icon `#b0863e`
    - `modified`: bg `#ede9f7`, icon `#7c3aed`
    - Linea connettore: `borderLeft: '1.5px solid #e5e5ea'` (era `border-border` Tailwind).
    - Badge circle: `outline: '2px solid #fff'` invece di `ring-2 ring-background`.

**COMMIT F — ShareButton: dialog unificato con canali** (`084a382`)

24. Titolo dialog: `"Invia {docLabel} {numClean}"`, sottotitolo `"Scegli come inviarlo a {clientName}."`.
25. Link row: URL senza protocollo troncato + bottone "Copia" (Copy 14px).
26. Tre cerchi canale 46px (`#f2f2f5` bg, border `#e7e7ea`, navy icon 20-21px): WhatsApp (SVG ufficiale), Email (`Mail`), Altre app (`Share2` + `navigator.share`).
27. Rimosso Popover fallback e tile "Copia link" (Copia rimasta solo nella link row).
28. Info note per bozze: "Condividendo, questo {docLabel} verrà segnato come Inviato e riceverà il numero progressivo."
29. Rimosso dialog conferma separato + flusso "Ho già inviato per altra via".
30. Flusso `openChannel`: se `isDraft` → auto-save (`window.__cc_doSave`) → `registerManualSendAction` → `router.refresh()` → apri canale. Aggiunta prop `clientName?: string | null`.
    - `fatture/[id]/page.tsx` e `preventivi/[id]/page.tsx` aggiornati con `clientName={clientName}`.

### File toccati (sessione UI-Rev — commit 11)
```
app/(app)/preventivi/_components/VociTable.tsx         [A: mic, trash, VOCE, unità 90px, font 13, asterischi oro, no Tipo]
lib/constants/units.ts                                  [B: +a corpo, +cad]
app/(app)/preventivi/_components/PreventivoForm.tsx    [B: mic note, custom payment, bonus Switch, units import, asterischi oro]
app/(app)/preventivi/_components/FiscalSummary.tsx     [B: rimosso trainanti/trainati]
app/(app)/preventivi/_components/CatalogPicker.tsx     [C: asterischi oro]
app/(app)/preventivi/_components/PdfActions.tsx        [D: rimosso Salva PDF]
app/(app)/preventivi/_components/MobileStatusChips.tsx [D: nuovo — chip Accettato/Rifiutato]
app/(app)/preventivi/[id]/page.tsx                     [D: chipBase 48px, banner oro, no template info, azioni mobili; F: clientName]
app/(app)/preventivi/_components/DocumentTimeline.tsx  [E: badge pastello inline styles]
app/(app)/preventivi/_components/ShareButton.tsx       [F: dialog unificato, canali cerchi, no Popover]
app/(app)/fatture/[id]/page.tsx                        [F: clientName a ShareButton]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde, tutte le route generate
- `npm test -- --run` → 178/178 verdi
- **Non testato in browser**: tutti i commit A–F da verificare da Eli (VociTable mic, custom payment terms, bonus Switch, azioni mobile 48px, MobileStatusChips, DocumentTimeline pastello, ShareButton dialog canali).

### Esito finale
🟡 FIX APPLICATO — tsc+build+test verdi. Da verificare in browser da Eli.

---

## A. HANDOFF — SESSIONE UI-Rev (16 giugno 2026) — continuazione (10)

### Fix applicati — Bug ShareButton hasVoci stale (1 commit `7ceb719`)

**COMMIT 15 — ShareButton: guard live + auto-save prima di condividere**

**Bug trovato:** `hasVoci` è una prop calcolata server-side (`docItems.some(...)` nel documento salvato). Se l'utente aggiunge voci nel form senza salvare, la prop è stale → ShareButton mostra toast "Aggiungi almeno una voce" anche se le voci sono presenti nel form.

**Causa reale:** il guard `if (!hasVoci)` in `handleShareClick` usa la prop di pagina, non lo stato corrente del form.

**Fix implementato:**

**(1) PreventivoForm.tsx — due nuovi `useEffect`:**
- `useEffect([doSave])`: espone `doSave` su `window.__cc_doSave` (rimosso on unmount). ShareButton chiama questo per auto-salvare prima di condividere.
- `useEffect([voci])`: dispatcha `cartacanta:voci-changed` con `{ hasVoci: boolean }` ad ogni modifica alle voci nel form.

**(2) ShareButton.tsx:**
- Import `useEffect` aggiunto.
- `hasVociLocal = useState(hasVoci)` + `useEffect` che ascolta `cartacanta:voci-changed` → aggiorna `hasVociLocal` in tempo reale.
- Guard `if (!hasVoci)` → `if (!hasVociLocal)` (usa stato corrente del form).
- `handleConfirm`: chiama `window.__cc_doSave()` (auto-save) prima di `registerManualSendAction`. Se il salvataggio fallisce, mostra l'errore nel dialog e non procede.

**(3) lib/actions/documents.ts:**
- `'Il documento non ha voci'` → `'Il preventivo non ha voci salvate. Salva le modifiche prima di condividere.'` (fallback se auto-save non disponibile).

**Flusso risultante:**
1. Utente aggiunge voci → `cartacanta:voci-changed` → `hasVociLocal=true` → guard non blocca
2. Utente clicca Condividi → dialog "Segna come inviato" si apre
3. Utente conferma → `window.__cc_doSave()` salva le voci → `registerManualSendAction` → successo
4. Caso limite (no form montato): server restituisce messaggio chiaro "Salva le modifiche prima"

### File toccati (sessione UI-Rev — commit 15)
```
app/(app)/preventivi/_components/PreventivoForm.tsx  [window.__cc_doSave; cartacanta:voci-changed dispatch]
app/(app)/preventivi/_components/ShareButton.tsx     [hasVociLocal; ascolta evento; auto-save in handleConfirm]
lib/actions/documents.ts                             [errore server migliorato]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde
- `npm test -- --run` → 178/178 verdi
- **Non testato in browser**: verificare da Eli — aggiungere voci, NON salvare, cliccare Condividi → deve salvare e condividere senza errori.

### Esito finale
🟡 FIX APPLICATO — tsc+build+test verdi. Da verificare in browser da Eli.

---

## A. HANDOFF — SESSIONE UI-Rev (16 giugno 2026) — continuazione (9)

### Fix applicati — Note, CatalogPicker (1 commit `14c31eb`)

**COMMIT 14 — Note auto-espandibili, icona Nuova voce, titoli categoria**

**(1) Textarea note auto-espandibili (PreventivoForm.tsx):**
- Entrambi i campi (`notes` e `internal_notes`): rimosso `rows={N}`, aggiunto `className="resize-none overflow-hidden"`, `style={{ minHeight: '40px' }}`.
- Callback ref: `ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' } }}` — imposta l'altezza iniziale al contenuto pre-compilato.
- `onChange` aggiornato: resetta a `'auto'` poi imposta a `scrollHeight + 'px'` — il box cresce col testo.

**(2) Icona "Nuova voce" in CatalogPicker (CatalogPicker.tsx):**
- `<PackagePlus>` → `<Plus>` sul bottone "Nuova voce" (riga ~369). `PackagePlus` rimosso dagli import se inutilizzato.

**(3) Titoli categoria CatalogPicker più chiari (CatalogPicker.tsx):**
- Banda categoria: `bg-muted/50` → `bg-muted`; span: `font-semibold text-muted-foreground` → `font-bold text-foreground/70`. Si distingue nettamente dalle voci sottostanti.

### File toccati (sessione UI-Rev — commit 14)
```
app/(app)/preventivi/_components/PreventivoForm.tsx  [1: note/note-interne auto-espandibili]
app/(app)/preventivi/_components/CatalogPicker.tsx   [2: icona Plus; 3: header categoria]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde
- `npm test -- --run` → 178/178 verdi
- **Non testato in browser** — verificare da Eli.

### Esito finale
🟡 FIX APPLICATO — tsc+build+test verdi. Da verificare in browser da Eli.

---

## A. HANDOFF — SESSIONE UI-Rev (16 giugno 2026) — continuazione (8)

### Fix applicati — Sfondo grigio #fafafa su mobile (1 commit `5a16004`)

**COMMIT 13 — AppShell: bg-[#fafafa] su mobile**

- `app/(app)/_components/AppShell.tsx`: `<main>` → aggiunta classe `bg-[#fafafa] lg:bg-background`.
- Risultato: tutte le pagine app su mobile hanno sfondo #fafafa; le card e la fascia titolo bianca rimangono su `#fff`; su desktop resta `bg-background` (invariato).

### File toccati (sessione UI-Rev — commit 13)
```
app/(app)/_components/AppShell.tsx   [bg-[#fafafa] lg:bg-background su <main>]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde
- **Non testato in browser** — verificare da Eli che lo sfondo grigio compaia su mobile e non su desktop.

### Esito finale
🟡 FIX APPLICATO — tsc+build verdi. Da verificare in browser da Eli.

---

## A. HANDOFF — SESSIONE UI-Rev (16 giugno 2026) — continuazione (7)

### Fix applicati — Nuovo Preventivo / Nuova Fattura (1 commit `ab05d45`)

**COMMIT 12 — VociTable formatCurrency, griglia prezzo, AI pill, placeholder cliente, spaziatura**

**(1) Totale voce formato italiano:**
- `VociTable.tsx`: aggiunto import `formatCurrency` da `@/lib/utils`.
- Mobile (riga Totale): `€{lineTotal.toFixed(2)}` → `{formatCurrency(lineTotal)}` → es. "€ 2.800,00".
- Desktop (riga `= …`): stessa sostituzione.

**(2) Campo Prezzo più largo su mobile:**
- `VociTable.tsx` riga griglia numerica: `grid-cols-4` → `grid-cols-[52px_1fr_1.5fr_1fr]` (Unità fissa 52px, Q.tà normale, Prezzo 1.5fr, Sconto normale). Con IVA si torna a `sm:grid-cols-5` da sm+.

**(3) AiImportButton "IN ARRIVO" discreto:**
- `AiImportButton.tsx`: il branch `!AI_IMPORT_ENABLED` ora restituisce `<span>` (non Button) — fontSize 11, color `var(--cc-text-3)`, opacity 0.75, icona Wand2 11px. Testo: "Importa con AI · in arrivo". Meno ingombrante accanto al titolo VOCI.

**(4) Placeholder ClientAutocomplete:**
- `components/shared/ClientAutocomplete.tsx`: default `placeholder` cambiato da `'Cerca cliente…'` a `'Cerca o crea cliente…'`. Si applica ovunque il componente è usato (form preventivo, fattura, cliente nuovo).

**(5) Spaziatura card Cliente:**
- `PreventivoForm.tsx`: `<div className="cc-section-label">` nella card Cliente/Fattura → aggiunto `style={{ marginBottom: 0 }}`. La card ha `gap: 14` (flexbox), quindi il totale era gap(14) + marginBottom(12) = 26px. Ora è solo 14px.

### File toccati (sessione UI-Rev — commit 12)
```
app/(app)/preventivi/_components/VociTable.tsx      [1: formatCurrency; 2: grid 52px_1fr_1.5fr_1fr]
app/(app)/preventivi/_components/AiImportButton.tsx  [3: pillola discreta]
app/(app)/preventivi/_components/PreventivoForm.tsx  [5: marginBottom:0 su cc-section-label]
components/shared/ClientAutocomplete.tsx             [4: placeholder "Cerca o crea cliente…"]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde, tutte le route generate
- `npm test -- --run` → 178/178 verdi
- **Non testato in browser**: totale voce formato italiano; Prezzo non troncato; AI pillola discreta; placeholder cliente; spaziatura card — verificare da Eli.

### Esito finale
🟡 FIX APPLICATO — tsc+build+test verdi. Da verificare in browser da Eli.

---

## A. HANDOFF — SESSIONE UI-Rev (16 giugno 2026) — continuazione (6)

### Fix applicati — spaziatura Home, fascia-titolo, gap card (1 commit `6b66304`)

**COMMIT 11 — spaziatura Home, fascia bianca Preventivi/Fatture, marginBottom card**

**(1) Ombra ripristinata (via git revert):** commit `3e4fc8f` ha annullato `9a26537` (ombra troppo forte). L'ombra card è tornata a `0 1px 2px rgba(20,20,40,.04), 0 6px 16px -8px rgba(20,20,40,.13)` (valore originale in `--cc-shadow`).

**(2) Home — più spazio tra le card (dashboard/page.tsx + MobileScadenzaCard.tsx):**
- Banner quota: `margin: '13px 15px 0'` → `'18px 15px 0'`
- MobileScadenzaCard outer div: `margin: '13px 15px 0'` → `'18px 15px 0'`
- KPI grid: `margin: '15px 15px 0'` → `'20px 15px 0'`
- Activity card: `margin: '18px 15px 18px'` → `'23px 15px 18px'`

**(3) Fascia bianca titolo su Preventivi e Fatture (mobile only):**
- `preventivi/page.tsx` e `fatture/page.tsx`: aggiunto `<div className="lg:hidden -mx-4 -mt-4 mb-4" style={{ background: '#fff', borderBottom: '0.5px solid var(--cc-border-color)', padding: '15px 15px 13px' }}>` come primo figlio del container, con h1 dentro.
- Il `-mx-4 -mt-4` cancella il `p-4` del container mobile → la fascia va a piena larghezza.
- L'header originale (h1 + bottoni desktop) è diventato `hidden lg:flex` su entrambe le pagine.
- Il banner Free, la ricerca, i filtri e le card restano sul grigio di sfondo sotto la fascia.

**(4) Più spazio tra i documenti:**
- `preventivi/page.tsx` e `fatture/page.tsx`: card wrapper `marginBottom: 12` → `marginBottom: 16`.

### File toccati (sessione UI-Rev — commit 11)
```
app/(app)/dashboard/page.tsx                          [2: margini banner/KPI/activity]
app/(app)/dashboard/_components/MobileScadenzaCard.tsx [2: margin 13→18]
app/(app)/preventivi/page.tsx                         [3: fascia bianca mobile; 4: marginBottom 16]
app/(app)/fatture/page.tsx                            [3: fascia bianca mobile; 4: marginBottom 16]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde, tutte le route generate
- `npm test -- --run` → 178/178 verdi
- **Non testato in browser**: spaziatura Home; fascia bianca titolo Preventivi/Fatture; gap card — verificare da Eli.

### Esito finale
🟡 FIX APPLICATO — tsc+build+test verdi. Da verificare in browser da Eli.

---

## A. HANDOFF — SESSIONE UI-Rev (16 giugno 2026) — continuazione (5)

### Fix applicati — Home + badge + Ordina (1 commit `09d197f`)

**COMMIT 10 — KPI mese centrate, no logo, altri-N in card, WA precompilato; Visto lilla; Ordina min-w**

**(A1) KPI grid mobile (dashboard/page.tsx):** cards centrate (`textAlign:'center'`), padding `14px 12px`, label rinominate ("Preventivi accettati" / "Fatturato"), aggiunta riga mese corrente sotto il valore (`fontSize 11, color #8a887f, marginTop 2`). `meseCorrente` calcolato da `now.toLocaleDateString('it-IT', { month: 'long' })`.

**(A2) Rimozione logo azienda dall'header (dashboard/page.tsx):** rimosso blocco `{workspace.logo_url && (<img.../>)}`. Resta solo "Ciao, {fullName}" + workspaceName a sinistra e avatar a destra.

**(A3) "Altri N in scadenza" dentro la card (dashboard/page.tsx + MobileScadenzaCard.tsx):** rimossa la card separata "Altri N in scadenza" (`allPendingCount > 1` block). Aggiunta prop `otherPendingCount` a MobileScadenzaCard. Se > 0: dentro la card, sotto l'hint, linea grigia + Link a `/preventivi/scadenze` con `AlertTriangle` + conteggio.

**(A4) WhatsApp messaggio precompilato (MobileScadenzaCard.tsx):** aggiunte props `publicToken`, `workspaceName`, `expiresAt`. Se `publicToken` disponibile: `whatsappHref = https://wa.me/${phoneDigits}?text=${encodeURIComponent(msg)}`. Messaggio: "Buongiorno {clientName}, le ricordo il preventivo {docNumber} in scadenza il {gg/mm}. Può visionarlo qui: {link}. Cordiali saluti, {workspaceName}". Anche `public_token` aggiunto alla query in dashboard/page.tsx.

**(B) SortSelect min-w (SortSelect.tsx):** `<DropdownMenuContent>` → `className="min-w-[190px]"` per evitare che "Scadenza vicina" / "Ultima modifica" vadano a capo.

**(C) Badge "Visto" colore lilla (StatusBadge.tsx + dashboard/page.tsx):** viewed bg `#d8e8fb` → `#e2e3f7` (lilla-azzurro, distinto da sent `#d8e8fb`). `getMobileBadgeBg`: `sent` e `viewed` ora separati (non più nel fall-through).

### File toccati (sessione UI-Rev — commit 10)
```
app/(app)/dashboard/page.tsx                          [A1/A2/A3/A4/C: KPI, no logo, altri-N props, public_token, getMobileBadgeBg]
app/(app)/dashboard/_components/MobileScadenzaCard.tsx [A3/A4: otherPendingCount, publicToken, WA msg, Link+ArrowRight]
app/(app)/preventivi/_components/SortSelect.tsx        [B: min-w-[190px]]
app/(app)/preventivi/_components/StatusBadge.tsx       [C: viewed #e2e3f7]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde, tutte le route generate
- `npm test -- --run` → 178/178 verdi
- **Non testato in browser**: KPI centrate con mese; header senza logo; "Altri N" dentro la card; WA messaggio precompilato; badge Visto lilla; Ordina senza testo troncato.

### Fix aggiuntivi — 3 micro-fix (1 commit `3bad10f`)

**(A) Badge "Visto" rosa:** viewed bg `#e2e3f7` → `#fbe1ee` (StatusBadge + getMobileBadgeBg in dashboard).

**(B) SearchBar placeholder più piccolo:** aggiunta classe `placeholder:text-sm` all'Input — placeholder a 14px, testo digitato resta 16px → niente zoom automatico su iOS.

**(C) Placeholder unificato:** mobile SearchBar su Preventivi e Fatture usa "Cerca numero, cliente, voce…".

**(D) Ombra card più marcata (commit `9a26537`):** `--cc-shadow` aggiornato in `globals.css` → `0 2px 5px rgba(20,20,40,.07), 0 10px 28px -8px rgba(20,20,40,.22)`. Aggiornate anche le costanti `SH` hardcoded in `dashboard/page.tsx` e `MobileScadenzaCard.tsx`. Non tocca `--cc-shadow-md/fab/btn`.

### Esito finale
🟡 FIX APPLICATO — tsc+build+test verdi. Da verificare in browser da Eli.

---

## A. HANDOFF — SESSIONE UI-Rev (16 giugno 2026) — continuazione (4)

### Fix applicati — 5 fix CSS/UX (1 commit `2e76148`)

**COMMIT 9 — ombra pillola, Ordina→DropdownMenu, SearchBar focus, badge colori, sort scadenza vicina**

**(1) Ombra pillola non tagliata (globals.css):** `.cc-tabs` padding `6px 0` → `10px 0 15px`. Il container `.cc-tabs` aveva `overflow-x: auto` (da `.cc-filter-scroll`) che tagliava l'ombra verticale `.cc-tab-active`. Il padding extra crea spazio sopra/sotto l'ombra prima del clip.

**(2) SortSelect: Select → DropdownMenu modal={false}:** sostituito l'intero `<Select>` Radix con `<DropdownMenu modal={false}> + <DropdownMenuRadioGroup> + <DropdownMenuRadioItem>`. Il `<Select>` usava `react-remove-scroll` → aggiungeva `padding-right` al body per compensare la scrollbar → la pagina si restringeva all'apertura. Con `modal={false}` non blocca lo scroll e non compensa. Trigger: testo con `ChevronDown size 14`, border-0 bg-transparent. Mantenuta tutta la logica (sessionStorage, router.push ?sort=, displaySort ottimistico).

**(3) SearchBar: digitazione non cancellata dal sync URL:** aggiunto `inputRef = useRef<HTMLInputElement>(null)`. Nel `useEffect` che sincronizza il valore dall'URL, aggiunto guard: `if (inputRef.current && document.activeElement === inputRef.current) return`. L'Input ora ha `ref={inputRef}`. Problema precedente: il router ripristinava l'URL (con il debounce) e il `useEffect` rimpiazzava il valore locale mentre l'utente stava ancora digitando.

**(4) Colori StatusBadge allineati alla palette Home:** viewed `#f7e6c8` → `#d8e8fb` (blu chiaro = coerente con "Inviato"), rejected `#fadfdf` → `#f5dede` (rosa tenue), expired `#f7e6c8` → `#f5e9d0` (ambra tenue). Si applica su preventivi + fatture + dettaglio (intenzionale). La Home NON è stata toccata (usa `getMobileBadgeBg` separato).

**(5) Sort "Scadenza vicina" — pending prima:** il DB non supporta ORDER BY CASE via Supabase. Soluzione: quando `sort === 'expiry'`, limit aumentato a 200 (da 50) + JS sort dopo il fetch. Grouping: pending (status in ['sent','viewed','expired']) per `expires_at ASC` (null in fondo), gli altri (accepted/rejected/draft) per `updated_at DESC`. La variabile `displayDocuments` contiene il risultato ordinato; il render usa `displayDocuments.map(` invece di `(documents ?? []).map(`.

### File toccati (sessione UI-Rev — commit 9)
```
app/globals.css                                          [cc-tabs padding 10px 0 15px]
app/(app)/preventivi/_components/SortSelect.tsx          [Select → DropdownMenu modal=false]
components/shared/SearchBar.tsx                          [inputRef + guard activeElement]
app/(app)/preventivi/_components/StatusBadge.tsx         [viewed/rejected/expired colori]
app/(app)/preventivi/page.tsx                            [sort=expiry: limit 200 + JS sort displayDocuments]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde, tutte le route generate
- `npm test -- --run` → 178/178 verdi
- **Non testato in browser**: ombra pillola non tagliata; Ordina non restringe la pagina; digitazione non cancellata in SearchBar; badge colori aggiornati; "Scadenza vicina" mostra pending prima.

### Esito finale
🟡 FIX APPLICATO — tsc+build+test verdi. Da verificare in browser da Eli.

---

## A. HANDOFF — SESSIONE UI-Rev (16 giugno 2026) — continuazione (3)

### Fix applicati — 5 fix CSS/UX trasversali (1 commit)

**COMMIT 8 — CSS duplicato rimosso, Ordina popper, ricerca modificato, sort Fatture**

**(1) CSS duplicato rimosso (globals.css):** eliminato il blocco vecchio `.cc-tabs/.cc-tab/.cc-tab-active` con `border-bottom` (~righe 343-364) — causava la sottolineatura residua sui filtri. Resta solo la definizione pill-style.

**(2) SortSelect menu in basso (position popper):** `<SelectContent>` → `position="popper" align="end" sideOffset={6}`. Vale per Preventivi e (tramite lo stesso componente) Fatture.

**(3) Ricerca "modificato" su Preventivi:** nel blocco di ricerca testuale, prima del ramo statusMatch, aggiunto controllo `MODIFIED_KW` → `.not('updated_after_send_at', 'is', null)`. Parole: modificato/a/i/e (exact + prefisso min 4 chars).

**(4) Ricerca "modificata" su Fatture:** stesso pattern aggiunto nel blocco ricerca fatture.

**(5) "Ordina" funzionante su Fatture:** aggiunto `sort?` a searchParams, import `SortSelect`, ordinamento dinamico (default `updated_at ASC` = "Meno recenti", coerente con Preventivi). Il testo statico "Più recenti" è sostituito con `<SortSelect currentSort={sort} />`.

### File toccati (sessione UI-Rev — commit 8)
```
app/globals.css                          [rimosso blocco cc-tabs duplicato con border-bottom]
app/(app)/preventivi/_components/SortSelect.tsx  [SelectContent position=popper align=end]
app/(app)/preventivi/page.tsx            [ricerca "modificato"]
app/(app)/fatture/page.tsx               [ricerca "modificata" + sort funzionante]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde
- `npm test -- --run` → 178/178 verdi
- **Non testato in browser**: filtri senza sottolineatura; menu Ordina si apre sotto; ricerca "modificato/a" filtra correttamente; ordinamento Fatture funziona — verificare da Eli.

### Esito finale
🟡 FIX APPLICATO — tsc+build+test verdi. Da verificare in browser da Eli.

---

## A. HANDOFF — SESSIONE UI-Rev (16 giugno 2026) — continuazione (2)

### Fix applicati — Pagina Fatture: allineamento mockup + ⋮ per riga (1 commit)

**COMMIT 7 — Fatture: filtri pill, bottoni restyled, badge affiancato, ⋮ per riga, redirect fix**

**(0) CSS valori esatti del mockup (globals.css — condiviso Preventivi+Fatture):**
- `.cc-tab`: padding `6px 9px` → `6px 5px` (inattivo più compatto)
- `.cc-tab-active`: padding `7px 16px` → `10px 22px` (attivo più grande)

**(1) Filtri Fatture scorrevoli:** `className="cc-tabs"` → `className="cc-tabs cc-filter-scroll"`

**(2) Rimosso ⋮ mobile CSV:** eliminato `<a lg:hidden ... MoreVertical>`. Rimosso `MoreVertical` dall'import.

**(3) Badge "Modificata" affiancato al badge stato (riga 1):** rimosso da riga 2, spostato inline con StatusBadge in `<div display:flex gap:6>`. Stile: bg `#e9e0f7`, color `#2b2b2b`, 11px weight 600, radius 999, padding `2px 8px`.

**(4) Bottoni creazione restyled (mobile):**
- "Da preventivo" PRIMARIO a sinistra: navy bg, bianco, borderRadius 14, boxShadow navy, con icona `FileInput`
- "Nuova fattura" SECONDARIO a destra: bianco, bordo `#ededf0`, var(--cc-shadow), con icona `Plus`

**(5) Titolo "Fatture" fontWeight 500 → 600**

**(6) ⋮ per riga:**
- Card fattura avvolta in `<div position:relative marginBottom:12>`. Link padding `'14px 50px 14px 15px'`.
- `DocumentRowActions` in absolute top/right, fuori dal Link (tap su ⋮ non naviga).
- workspace select aggiornato con `name, ragione_sociale`; clients select con `email`.

**(DocumentRowActions — reso doc-type-aware):**
- Aggiunto prop `docType?: 'preventivo' | 'fattura'` (default 'preventivo').
- Dialog "Elimina preventivo" → dinamico. aria-label dinamico.

**(duplicateDocumentAction — fix redirect per fatture):**
- `lib/actions/documents.ts`: redirect ora va a `/fatture/${newDoc.id}` se `doc_type === 'fattura'`, altrimenti `/preventivi/`. Aggiunto `revalidatePath('/fatture')`.

### File toccati (sessione UI-Rev — commit 7)
```
app/globals.css                                          [cc-tab/cc-tab-active valori esatti mockup]
app/(app)/fatture/page.tsx                               [tutti i fix 0-6]
app/(app)/preventivi/_components/DocumentRowActions.tsx  [prop docType; dialog/aria dinamici]
lib/actions/documents.ts                                 [duplicateDocumentAction redirect doc-type-aware]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde
- `npm test -- --run` → 178/178 verdi
- **Non testato in browser reale**: filtri Fatture pill, bottoni restyled, badge affiancato, ⋮ per riga, redirect "Usa come modello" su fattura va a /fatture/ — verificare da Eli.

### Esito finale
🟡 FIX APPLICATO — tsc+build+test verdi. Da verificare in browser da Eli.

---

## A. HANDOFF — SESSIONE UI-Rev (16 giugno 2026) — continuazione

### Fix applicati — Allineamento mockup Preventivi + scaduti in "In attesa" (1 commit)

**COMMIT 6 — 7 fix Preventivi: shift, filtri CSS, ricerca, ordina, puntini, banner, scaduti**

**(1) Shift laterale — fix vero:**
- `app/(app)/_components/AppShell.tsx`: `<main>` → `style={{ scrollbarGutter: 'stable' }}`. Elemento corretto (scrollabile è `<main>`, non `html`).

**(2) Filtri CSS shared (no più inline):**
- `app/globals.css`: aggiunte classi `.cc-tabs`, `.cc-tab`, `.cc-tab-active` (pill style).
- `app/(app)/preventivi/page.tsx`: div filtri ora usa `className="cc-tabs cc-filter-scroll"` + `<Link className={isActive ? 'cc-tab-active' : 'cc-tab'}>`.

**(3) SearchBar più alta:**
- `components/shared/SearchBar.tsx`: aggiunto `h-11` all'Input (44px, combacia col mockup).

**(4) "Ordina" solo testo:**
- `app/(app)/preventivi/_components/SortSelect.tsx`: `SelectTrigger` → `border-0 bg-transparent shadow-none h-auto`. Appare come testo "Meno recenti ▾" senza riquadro.

**(5) Puntini ⋮ grigi:**
- `app/(app)/preventivi/_components/DocumentRowActions.tsx`: `MoreHorizontal` → `className="size-4 text-muted-foreground"`.

**(6) Banner Free — card corta oro:**
- `app/(app)/preventivi/page.tsx`: banner ambra lungo sostituito con card bianca, bordo sinistro oro `#c9a44c`, icona ♛, testo "{N}/{MAX} preventivi gratuiti" + link "Passa a Pro →".

**(7) "In attesa" include gli scaduti:**
- `app/(app)/preventivi/page.tsx`: query `status === 'attesa'` → `.in('status', ['sent','viewed','expired'])`. Mappa ricerca testuale 'attesa'/'in attesa' → stessa terna. Cast TypeScript aggiornato. I preventivi scaduti restano visibili sotto "In attesa" e non spariscono dal tab.

### File toccati (continuazione sessione UI-Rev — commit 6)
```
app/(app)/_components/AppShell.tsx                      [scrollbarGutter stable su main]
app/globals.css                                         [cc-tabs, cc-tab, cc-tab-active]
app/(app)/preventivi/page.tsx                           [filtri CSS, banner oro, scaduti in attesa]
components/shared/SearchBar.tsx                         [h-11]
app/(app)/preventivi/_components/SortSelect.tsx         [SelectTrigger senza bordo]
app/(app)/preventivi/_components/DocumentRowActions.tsx [MoreHorizontal grigio]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde
- `npm test -- --run` → 178/178 verdi
- **Non testato in browser reale**: verificare da Eli shift laterale, filtri pill, ordina testuale, banner oro, scaduti in "In attesa".

### Esito finale
🟡 FIX APPLICATO — tsc+build+test verdi. Da verificare in browser da Eli.

---

### Fix applicati — Pillole filtro e scroll orizzontale (1 commit)

**COMMIT 5 — Filtri Preventivi: pillole più piccole + niente slittamento laterale**

**(a) Pillole più piccole:**
- `app/(app)/preventivi/page.tsx`: tab attivo `8px 16px` → `6px 13px`; tab inattivo `6px 10px` → `5px 9px`.

**(b) Scroll orizzontale senza shift di pagina:**
- `app/globals.css`: aggiunta utility `.cc-filter-scroll` (overflow-x auto, scrollbar nascosta). Aggiunto `scrollbar-gutter: stable` su `html`.
- `app/(app)/preventivi/page.tsx`: aggiunto `className="cc-filter-scroll"` al container flex dei tab, così i 5 filtri scorrono DENTRO la barra senza spingere la pagina.

### File toccati (continuazione sessione UI-Rev)
```
app/(app)/preventivi/page.tsx   [pad pillole ridotto; cc-filter-scroll su container tab]
app/globals.css                 [utility cc-filter-scroll; scrollbar-gutter: stable su html]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde
- `npm test -- --run` → 178/178 verdi
- **Non testato in browser reale**: verificare da Eli che i filtri non causino più scroll laterale di pagina.

### Esito finale
🟡 FIX APPLICATO — tsc+build+test verdi. Da verificare in browser da Eli.

---

## A. HANDOFF — SESSIONE UI-Rev (16 giugno 2026)

### Fix applicati — Revisione UI mobile (4 commit)

**COMMIT 1 — Salvataggio lavoro non committato**
- `mockup-mobile/home_v2.html`: mockup di riferimento Home + Preventivi
- `ricerca-fatturazione-elettronica/implementazione-e-testi-legali.md`: nuova ricerca SDI
- `ricerca-fatturazione-elettronica/DECISIONE_SDI.md`, `fonti.md`: aggiornamenti

**COMMIT 2 — Normalizzazione fine-riga a LF**
- Creato `.gitattributes` con `* text=auto eol=lf`
- `git add --renormalize .` → eliminati ~81 file di rumore CRLF dal working tree
- `REVISIONE_UI.md`: aggiornato (segnata sessione Home implementata)

**COMMIT 3 — Home: testo Attività recente grigio scuro**
- `app/(app)/dashboard/page.tsx`: riga mobile activity feed — aggiunto `color: 'var(--cc-text-2)'` al div del nome/numero documento (era colore default del tema, troppo scuro/nero)

**COMMIT 4 — Preventivi (lista) mobile: restyling completo**

**(a) Rimosso ⋮ mobile (Export CSV):**
- `app/(app)/preventivi/page.tsx`: rimossa l'ancora `<a>` mobile con `MoreVertical` a lines ~263-266. Rimossi `MoreVertical` e `Bell` (inutilizzato) dall'import lucide-react.

**(b) Badge "Modificato" affiancato a StatusBadge in riga 1:**
- Riga 1 (numero · cliente | badge): StatusBadge e badge "Modificato" ora avvolti in `<div display:flex gap:6>`. Stile badge: `#e9e0f7` bg, `#2b2b2b` testo, fontSize 11, fontWeight 600, borderRadius 999, padding `2px 8px`.
- Rimosso il vecchio badge "Modificato" (viola scuro `#7c3aed`) dalla riga 2.

**(c) StatusBadge restyling globale:**
- `app/(app)/preventivi/_components/StatusBadge.tsx`: sostituito approccio Tailwind className con inline styles. Niente più bordi colorati. Testo sempre `#2b2b2b`, fontWeight 600. Sfondi tenue: draft `#e8e8e8` · sent `#d8e8fb` · viewed `#f7e6c8` · accepted `#d4efe2` · rejected `#fadfdf` · expired `#f7e6c8`. Si applica ovunque (fatture, dettaglio — intenzionale).

**(d) SearchBar più elegante:**
- `components/shared/SearchBar.tsx`: Input → `rounded-xl border-[#e6e6e6] bg-[#f7f7f8] focus:bg-white focus-visible:bg-white`. Si applica su tutte le pagine che usano SearchBar.

**(e) Più spazio attorno a "Ordina":**
- `app/(app)/preventivi/page.tsx`: riga Ordina → `py-3` → `py-4`.

**(f) Filtri tab stile B (pill):**
- Container filtri: `background:#f2f2f4, borderRadius:999, padding:3px 4px`. Rimosso `borderBottom`.
- Tab attivo: pillola bianca `bg:#fff`, `boxShadow` galleggiante, `color:var(--cc-navy)`, fontWeight 600, padding `8px 16px`.
- Tab inattivo: solo testo `color:var(--cc-text-2)`, padding `6px 10px`, nessun bg/bordo.

### File toccati (sessione UI-Rev)
```
.gitattributes                                          [nuovo — normalizzazione LF]
mockup-mobile/home_v2.html                              [nuovo — mockup riferimento]
ricerca-fatturazione-elettronica/implementazione-e-testi-legali.md  [nuovo — ricerca SDI]
ricerca-fatturazione-elettronica/DECISIONE_SDI.md       [aggiornato]
ricerca-fatturazione-elettronica/fonti.md               [aggiornato]
REVISIONE_UI.md                                         [aggiornato]
app/(app)/dashboard/page.tsx                            [COMMIT 3: color cc-text-2 su activity feed]
app/(app)/preventivi/page.tsx                           [COMMIT 4: no ⋮ mobile, badge affiancato, py-4, filtri B]
app/(app)/preventivi/_components/StatusBadge.tsx        [COMMIT 4: restyling inline style — si applica globalmente]
components/shared/SearchBar.tsx                         [COMMIT 4: rounded-xl, bg #f7f7f8, border #e6e6e6]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde, tutte le route generate
- `npm test -- --run` → 178/178 verdi
- **Non testato in browser reale**: filtri pill B, badge Modificato affiancato, StatusBadge nuovi colori, SearchBar restyle, testo activity feed grigio — verificare da Eli sul telefono.

### Esito finale
🟡 FIX APPLICATO — tsc+build+test verdi. Da verificare in browser da Eli.

---

## A. HANDOFF — SESSIONE G-QA-R (15 giugno 2026)

### Fix applicati — Re-test mobile (commit `fix(mobile): G-QA-R`)

**QA-R1 — Menu ⋮ bloccava l'app**
- `DocumentRowActions.tsx`: aggiunto `modal={false}` a `<DropdownMenu>` → Radix non imposta più `pointer-events:none` sul body durante l'apertura del menu → no freeze.
- `preventivi/[id]/page.tsx` e `fatture/[id]/page.tsx`: rimosso il pulsante `<a href="#mobile-altre-azioni">⋮</a>` dal mobile header (anchor scroll su pagine pesanti causava freeze). Sostituito con `<Link href="?edit=1"><Pencil /></Link>`.

**QA-R2 — "Condividi" icona senza etichetta vs "Anteprima" enorme**
- `ShareButton.tsx`: rimosso `hidden sm:inline` dalla span label → "Condividi" sempre visibile. Aggiunto prop `triggerStyle?: React.CSSProperties` applicato al Button trigger.
- `preventivi/[id]/page.tsx` e `fatture/[id]/page.tsx`: passato `triggerStyle={chipBase}` a ShareButton nella sezione chip mobile → stessa dimensione di "Anteprima".

**QA-R3 — Form editabile sempre visibile anche per doc non modificabili**
- `preventivi/[id]/page.tsx`: `searchParams` esteso con `edit?: string`; `PreventivoForm` avvolto in `<div className={edit !== '1' ? 'hidden lg:block' : undefined}>`. Pencil nel header → `?edit=1` mostra il form.
- `fatture/[id]/page.tsx`: stessa logica + fattura accepted/rejected → form non compare mai su mobile. Chip "Modifica" cambiato da `href="#fattura-form-section"` a `href="/fatture/[id]?edit=1"` (Link, non anchor scroll).

**QA-R4 — "Ordina:" vuoto su mobile**
- `SortSelect.tsx`: `SelectTrigger` da `w-full sm:w-40` → `w-36` (larghezza fissa, evita collapse nel flex container). Label mostrata con `useState` locale + aggiornamento ottimistico in `handleChange`, invece di `<SelectValue />` che non rendeva il testo su mobile.

### File toccati (sessione G-QA-R)
```
app/(app)/preventivi/_components/DocumentRowActions.tsx  [QA-R1: modal=false]
app/(app)/preventivi/_components/ShareButton.tsx         [QA-R2: label visibile + triggerStyle prop]
app/(app)/preventivi/_components/SortSelect.tsx          [QA-R4: w-36 + label con stato locale]
app/(app)/preventivi/[id]/page.tsx                       [QA-R1: no ⋮, Pencil→?edit=1; QA-R2: triggerStyle; QA-R3: form hidden]
app/(app)/fatture/[id]/page.tsx                          [QA-R1: no ⋮, Pencil→?edit=1; QA-R2: triggerStyle; QA-R3: form hidden + chip Modifica]
DECISIONI_REDESIGN_MOBILE.md                             [sezione G-QA-R aggiunta]
CLAUDE.md                                                [aggiornato]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde
- `npm test -- --run` → 178/178 verdi
- **Non testato in browser**: tutti e 4 i punti G-QA-R da verificare da Eli sul telefono.

### Esito finale
🟡 FIX APPLICATO — tsc+build+test verdi. Da verificare in browser da Eli (lista in `DECISIONI_REDESIGN_MOBILE.md` sezione G-QA-R).

---

## A-quater. HANDOFF — SESSIONE G-QA (14 giugno 2026)

### Fix applicati — QA mobile (3 commit: G-QA1+QA2, G-QA3)

**G-QA1.1 — Impostazioni: tab orizzontali su mobile**
- `app/(app)/impostazioni/page.tsx`: Tabs root → `flex flex-col` su mobile (invece del layout sidebar). Icone tab nascoste con `hidden lg:block`. Label sempre visibile.

**G-QA1.2 — Abbonamento Pro: card dettagli piano**
- `app/(app)/abbonamento/page.tsx`: aggiunta card Pro con feature list, fatturazione mensile/annuale, SwitchBillingButton, link "Gestisci abbonamento" via `createPortalSessionAction`.

**G-QA2.1 — Clienti: righe lista tappabili su tutta la riga**
- `app/(app)/clienti/page.tsx`: aggiunto `active:bg-muted/50 cursor-pointer` alle Link della lista.

**G-QA2.2 — Scheda cliente: sola lettura + Modifica via URL**
- `app/(app)/clienti/[id]/page.tsx`: form edit nascosto di default su mobile (`hidden lg:block`); chip "Modifica" usa `?edit=1`; chip "Preventivo" rimosso; chip "Chiama" rimasto.

**G-QA2.3 — Cestino: spinner infinito→stato vuoto**
- `app/(app)/cestino/page.tsx`: `setLoading(false)` negli early-return quando `!user` o `!workspaceId`.

**G-QA3.1 — Doppie etichette rimosse**
- `PreventivoForm.tsx`: rimossa Label "Cliente" ridondante. `VociTable.tsx`: rimosso h2 "Voci preventivo".

**G-QA3.2 — Header creazione compatto (✕ · Titolo)**
- `preventivi/nuovo/page.tsx` e `fatture/nuovo/page.tsx`: header mobile `lg:hidden` con X link + titolo centrato + spacer. Breadcrumb/titolo desktop in `hidden lg:block`.

**G-QA3.3 — FiscalSummary a piena larghezza**
- `FiscalSummary.tsx`: rimosso wrapper `flex justify-end`. Il riepilogo ora occupa tutta la larghezza disponibile.

**G-QA3.4 — Sconto dentro Riepilogo**
- `PreventivoForm.tsx`: rimossa Card 4 "Sconti globali" separata. Sconto spostato dentro FiscalSummary via prop `discountSlot`. Aggiunto stato `discountOpen` + hidden inputs quando il pannello sconto è chiuso.
- `FiscalSummary.tsx`: aggiunto `discountSlot?: React.ReactNode` con separatore visivo.

**G-QA3.5 — Banner accettato completo + Crea fattura su mobile**
- `preventivi/[id]/page.tsx`: banner "Accettato e firmato dal cliente" (sempre, non condizionale); IP mostrato se presente. `ConvertiFatturaButton` aggiunto anche nel gruppo azioni mobile (`lg:hidden`).

**G-QA3.6 — Catalogo: ⋮ header + IVA% in riga**
- `catalogo/page.tsx`: MoreVertical al posto del contatore voci nell'header mobile.
- `CatalogItemRow.tsx`: sottotitolo mobile `unit · IVA X%`; colonne unità e IVA desktop `hidden lg:inline`.

**G-QA3.7 — Wording: "Da catalogo" · "Salva" · badge scadenze**
- `CatalogPicker.tsx`: "Dal catalogo" → "Da catalogo".
- `template/page.tsx`: bottone navy "Personalizza" → "Salva".
- `altro/page.tsx`: query scadenze entro 3gg; badge oro con contatore su "Scadenze e solleciti".

### File toccati (sessione G-QA)
```
app/(app)/impostazioni/page.tsx                [QA1.1: flex-col mobile, icone hidden lg:block]
app/(app)/abbonamento/page.tsx                 [QA1.2: card Pro con dettagli]
app/(app)/clienti/page.tsx                     [QA2.1: active:bg-muted cursor-pointer]
app/(app)/clienti/[id]/page.tsx                [QA2.2: form hidden lg:block, ?edit=1, chip Preventivo rimosso]
app/(app)/cestino/page.tsx                     [QA2.3: setLoading(false) negli early-return]
app/(app)/preventivi/_components/PreventivoForm.tsx  [QA3.1: no Label Cliente; QA3.4: no Card4, discountSlot]
app/(app)/preventivi/_components/VociTable.tsx  [QA3.1: no h2 Voci]
app/(app)/preventivi/nuovo/page.tsx            [QA3.2: header mobile ✕·Titolo]
app/(app)/fatture/nuovo/page.tsx               [QA3.2: header mobile ✕·Titolo]
app/(app)/preventivi/_components/FiscalSummary.tsx  [QA3.3: no flex justify-end; QA3.4: discountSlot prop]
app/(app)/preventivi/[id]/page.tsx             [QA3.5: banner + IP + ConvertiFatturaButton mobile]
app/(app)/catalogo/page.tsx                    [QA3.6: MoreVertical]
app/(app)/catalogo/_components/CatalogItemRow.tsx  [QA3.6: mobile subtitle unit·IVA%]
app/(app)/preventivi/_components/CatalogPicker.tsx  [QA3.7: "Da catalogo"]
app/(app)/template/page.tsx                    [QA3.7: "Salva"]
app/(app)/altro/page.tsx                       [QA3.7: scadenze badge]
DECISIONI_REDESIGN_MOBILE.md                   [sezione G-QA aggiunta]
CLAUDE.md                                      [aggiornato]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde (dopo ogni gruppo G-QA1+QA2, G-QA3)
- `npm run build` → verde
- `npm test -- --run` → 178/178 verdi
- **Non testato in browser reale**: tutti e 13 i punti G-QA vanno verificati da Eli sul telefono.

### Esito finale
🟡 FIX APPLICATO — tsc+build+test verdi. Da verificare in browser da Eli (lista completa in `DECISIONI_REDESIGN_MOBILE.md` sezione G-QA).

---

## A-bis. HANDOFF — SESSIONE G6 (14 giugno 2026 — precedente)

### Fix applicati (commit `fix(mobile): G6 — template Classico no-Pro label + P.IVA spostata in tab Fiscale`)

**G6a — Template: Classico non mostra mai "Pro"**
- `app/(app)/template/page.tsx` riga 164: `{isActive ? 'Attivo' : (locked ? 'Pro' : 'Pro')}` → `{isActive ? 'Attivo' : preset.pro ? 'Pro' : ''}`. Entrambi i branch restituivano `'Pro'` — anche il Classico (senza `preset.pro`) mostrava "Pro" quando non era il preset attivo. Ora mostra stringa vuota per i preset senza `preset.pro`.

**G6b — Impostazioni: P.IVA / Codice Fiscale spostato da tab Generale a tab Fiscale**
- `app/(app)/impostazioni/tabs/generali.tsx`: rimosso il blocco `grid-cols-2` che conteneva P.IVA + Email account (righe 97-112). L'email (auth, read-only) ora è un campo standalone con label "Email" (non più "Email account").
- `app/(app)/impostazioni/tabs/fiscali.tsx`: aggiunto `Input` per "P.IVA / Codice Fiscale" in testa alla card (rinominata "Dati fiscali"); `useState` per `piva`; hidden field per inviarlo col form; campo controllato visibile.
- `lib/actions/workspace.ts`: `WorkspaceFiscalSchema` esteso con `piva: z.string().max(16).optional()`; `raw` del parsing include `formData.get('piva')`; l'update usa spread condizionale `...(parsed.data.piva !== undefined && { piva: parsed.data.piva || null })` per rispettare il tipo Supabase.

### File toccati (sessione G6)
```
app/(app)/template/page.tsx                   [riga 164: preset.pro ? 'Pro' : '' invece di always 'Pro']
app/(app)/impostazioni/tabs/generali.tsx      [rimosso P.IVA; Email standalone con label "Email"]
app/(app)/impostazioni/tabs/fiscali.tsx       [aggiunto Input piva + useState + hidden field; card rinominata "Dati fiscali"]
lib/actions/workspace.ts                      [WorkspaceFiscalSchema +piva; raw +piva; update spread condizionale]
DECISIONI_REDESIGN_MOBILE.md                  [FASE 6 aggiornata con nota G6]
CLAUDE.md                                     [aggiornato]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde, tutte le route generate
- `npm test -- --run` → 178/178 verdi
- Verifica per ispezione codice: `preset.pro` è definito solo su Bold/Tecnico/Elegante (non su Classico) → Classico ora mostra '' quando non attivo; campo P.IVA in Fiscale usa `useState` + hidden field (pattern identico a `bolloAuto`, `fiscalRegime` etc.).
- **Non testato in browser reale**: (1) pagina Template su mobile → Classico inattivo mostra stringa vuota; (2) Impostazioni → tab Fiscale mostra il campo P.IVA con il valore attuale; (3) salvataggio P.IVA dal tab Fiscale funziona.

### Esito finale
🟡 FIX APPLICATO — tsc+build+test verdi. Da verificare in browser da Eli: i 3 punti sopra.

---

## ⚠️ CONFIG STRIPE DA FARE (sessione 26 — cambio fatturazione SOLO mensile→annuale)

> **Decisione prodotto:** consentito SOLO l'upgrade mensile → annuale, MAI il downgrade
> annuale → mensile. Il bottone "Passa alla fatturazione annuale" in `/abbonamento` compare
> solo per gli abbonamenti mensili e usa `switchToAnnualAction` → portale Stripe con flow
> `subscription_update_confirm` e prezzo annuale **pre-selezionato** (l'utente vede solo la conferma).
>
> **Config Stripe Dashboard (1 volta, sia in sandbox/test sia poi in live):**
> Stripe Dashboard → Settings → Billing → **Customer portal** (in italiano: Impostazioni →
> Fatturazione → Portale clienti):
> 1. Sezione **"Subscriptions"** → attivare **"Customers can switch plans"** (necessario perché
>    il flow `subscription_update_confirm` funzioni).
> 2. Aggiungere il prodotto **Pro** con entrambi i prezzi (Mensile + Annuale).
> 3. Proration: **"Create prorations"** (accredita i giorni non usati al cambio).
>
> ⚠️ **Sandbox vs Live:** la config va rifatta anche in modalità LIVE quando si va in produzione
> (le impostazioni sandbox NON si propagano al live).
>
> **Nota one-directional:** la nostra app offre solo l'upgrade. Stripe però, con "switch plans"
> attivo, tecnicamente permetterebbe il downgrade a chi raggiunge il portale generico
> ("Gestisci abbonamento"). Esposizione minima (l'app non offre quel percorso). Se in futuro
> serve blindarlo del tutto: fare lo switch via `stripe.subscriptions.update()` diretto + dialog
> di conferma in-app, e disabilitare lo switch nel portale.
> Il webhook `customer.subscription.updated` sincronizza già `billing_interval` nel DB.

---

## ⏰ TASK IMMINENTI DA FARE NEI PROSSIMI GIORNI (confermati dall'utente — sessione 25)

> **1. DMARC → quarantine** (azione manuale OVH dell'utente)
> L'utente riceve le email. Prima di passare a `p=quarantine`: controllare i report DMARC
> (SPF+DKIM pass) + test reale a Gmail/Outlook (inbox, non spam). Vedi checklist completa sotto.
> Sequenza obbligatoria: `none → quarantine → reject` (mai saltare a reject).
>
> **2. Attivare AI Import**
> Bottone oggi "IN ARRIVO" disabilitato. Per attivare: `NEXT_PUBLIC_AI_IMPORT_ENABLED=true` su Vercel
> + chiavi `OPENAI_API_KEY` / `MISTRAL_API_KEY`. Da fare dopo i test del piano Pro.
>
> **3. Fatturazione elettronica (SDI)** — task grosso pianificato. Richiede provider SDI gestito (~€0.10/fattura).

---

## ⏰ PROMEMORIA DATATO — DA LEGGERE SE LA DATA È INTORNO AL 15 GIUGNO 2026

> **DMARC cartacanta.app — verifica e aggiornamento policy**
>
> Il 15 maggio 2026 è stato configurato DMARC su OVH Cloud con `p=none`.
> Trascorse ~4 settimane → è il momento di controllare i report e aggiornare.
>
> **Checklist:**
> 1. Verifica report DMARC nella casella `rua=` — devono esserci report XML da Gmail/Outlook.
>    Se SPF e DKIM passano → si può procedere.
> 2. Invia preventivo di test a Gmail e Outlook → verifica inbox, non spam.
> 3. Se tutto ok: OVH Cloud → DNS → `_dmarc.cartacanta.app` → cambia da `p=none` a `p=quarantine`
>    Nuovo valore: `v=DMARC1; p=quarantine; rua=mailto:tuaemailpersonale@gmail.com;`
> 4. Se ci sono errori → NON cambiare policy. Segnala e risolvi prima.
>
> **Regola ferrea:** mai saltare da `p=none` a `p=reject`. Sequenza: `none → quarantine → reject`.

---

## B. REGOLE DI COMPORTAMENTO

### B.1 Regole TypeScript / codice

1. MAI `any` senza commento ESLint esplicito
2. MAI chiavi API nel client — tutto passa da Server Actions o API Routes
3. MAI skipare i test sui calcoli fiscali — coverage 100% obbligatoria su `lib/fiscal/`
4. Commit atomici con conventional commits: `feat/fix/chore/docs/test`
5. Ogni modifica: `npx tsc --noEmit` + `npm run build` devono essere verdi prima del commit
6. `types/database.ts` va rigenerato dopo ogni migration (`npx supabase gen types typescript --project-id ivbzuhgwszkdnlsybsao > types/database.ts`). Non editare manualmente salvo aggiunta urgente documentata.

### B.2 Regole UX/UI permanenti

- **Mobile-first è non negoziabile.** Ogni funzionalità deve funzionare perfettamente su telefono prima che su desktop.
- `ClientAutocomplete`, `AtecoMultiSelect`, `CatalogPicker`: usano `<PopoverContent>` Radix (portal su `document.body`) — NON rimuovere, evita clipping da `Card overflow-hidden`.
- Dropdown bot `KanbanView` e `ViewToggle` sono stati rimossi definitivamente (session 12). Non re-aggiungere.
- `StatusBadge` con prop `docType` per distinguere fatture da preventivi (accepted→"Pagata", rejected→"Annullata").
- IVA visibile su mobile per regime ordinario (grid-cols-5 nel VociTable mobile).
- `safeAccentColor` obbligatorio in `TemplatePreview.tsx` e `template.ts` per evitare testo chiaro su sfondo bianco.
- **Ordinamento lista preventivi (aggiornato sessione 26):** default = **`oldest` ("Meno recenti", `updated_at ASC`)** — NON più `recent`. La preferenza utente è in **sessionStorage** (chiave `preventivi_sort_v2`), vale solo per la sessione. Questo elimina il "flip" all'apertura della pagina (prima il default server `recent` + localStorage `oldest` causava un `router.replace` visibile). NB: supera le note della sessione 18 che descrivevano localStorage + default `recent`.

### B.3 Regole numerazione documenti

**⚠️ AGGIORNATO sessione 25: NON ci sono più prefissi Prev/Fatt.**
I numeri sono nel formato `{NNN}/{YYYY}` (es. `001/2026`) per **entrambi** preventivi e fatture.
In `lib/actions/documents.ts`:
- `allocateDocNumber()` → `{NNN}/{YYYY}` (es. "001/2026") — sequenza `doc_type = 'preventivo'`
- `allocateInvoiceNumber()` → `{NNN}/{YYYY}` (es. "001/2026") — sequenza `doc_type = 'fattura'`
- `peekNextDocNumber()` / `peekNextInvoiceNumber()` → preview (usano colonna `doc_type` su `invoice_sequences`, NON `seq_type`)
- `formatDocNumber()` in `lib/utils/index.ts` rimuove eventuali prefissi letterali legacy (`replace(/^[A-Za-z]+/, '')`) per i documenti vecchi che avevano "Prev"/"Fatt".

**Differenziazione fattura (sessione 25):** il numero salvato nel DB è identico per entrambi
("001/2026"), MA in **visualizzazione in-app** `formatDocNumber(num, 'fattura')` antepone il
marcatore **"Fatt."** → le fatture appaiono come **"Fatt. 001/2026"**, i preventivi come "001/2026".
Questo evita confusione senza migration. Email e PDF usano il numero grezzo (il PDF ha già la
testata "FATTURA"/"PREVENTIVO"). I punti che mostrano una fattura collegata DENTRO un testo già
prefissato (es. "Fattura {numero}") NON passano 'fattura' per evitare "Fattura Fatt. ..." ridondante.

**Non c'è più una card "Numerazione documenti" in impostazioni** (rimossa in session 13 — 3d671d3). Il formato non è configurabile dall'utente.

**⚠️ AGGIORNATO sessione 26 — il numero viene assegnato SUBITO alla creazione (anche per le bozze).**
`createDocumentAction` chiama `allocateDocNumber()` prima dell'INSERT per OGNI nuovo documento
(sia "Salva bozza" sia "Invia al cliente"), a meno che non sia stato passato un numero manuale valido.
Quindi **una bozza ha già un `doc_number` dal momento della creazione** (non più `null`).
Motivo: l'utente vuole vedere il numero progressivo subito.
Conseguenza nota: le bozze cancellate lasciano "buchi" nella sequenza (la RPC non li riempie). Accettato.

**`intent` nel form:** valori usati = `'save_draft'` | `'send'` (preventivo), `'save'` | `'send'` (FatturaForm),
`'create'` (preventivo→fattura). Nello schema Zod `DocumentFormSchema.intent` è `z.string().optional()`
(NON un enum ristretto: un enum `['save','send']` rompeva il salvataggio bozza con
"Invalid option: expected one of save|send"). Ogni action interpreta i valori che le servono.

**`send-email/route.ts`** mantiene il fallback: se per qualche motivo `doc_number` è ancora null al primo invio, lo assegna lì.

**La RPC usa INSERT ... ON CONFLICT DO UPDATE incrementando `last_number`** — non riempie i buchi. Se l'ultimo allocato è 5, il prossimo è 6 anche se 3 e 4 sono stati cancellati.

### B.4 Regole preventivi / fatture / collegamenti

**Soft delete:** i documenti vengono spostati nel cestino (`deleted_at = now()`), non cancellati. Il cestino è a `/cestino`, recupero entro 15 giorni, poi purge automatico via cron. Tutte le query lista **devono filtrare `deleted_at IS NULL`** — se aggiungi una query sui documenti, controlla.

**Preventivo accettato — re-edit:** un preventivo `accepted` può essere ri-editato (saveDraftAction lo resetta a `draft`) **a meno che non abbia una fattura collegata con status accepted**. In quel caso è locked.

**Preventivo → fattura:** 
- Entry point 1: dal dettaglio preventivo accettato → "Converti in fattura"
- Entry point 2: `/fatture/nuovo` → `CreateFromPreventivoButton` — mostra tutti i preventivi non-bozza/non-scaduti con status badge; se non-accepted, chiede conferma prima di convertire
- La funzione `convert_preventivo_to_fattura` SQL è idempotente: se la fattura esiste già la restituisce
- Collegamento bidirezionale: la fattura ha `origin_document_id`; sul dettaglio fattura c'è `LinkToPreventivoButton` per agganciare/sganciare manualmente

**Fattura → preventivo:** su `/fatture/[id]` c'è il banner collegato o il pulsante "Collega a preventivo" se `origin_document_id = null`.

**DocumentTimeline:** presente su tutti i preventivi (bozze incluse). Mostra eventi created/sent/viewed/accepted/rejected/expired + eventuale "Fattura collegata". Non c'è una colonna `rejection_at` — usa `sent_at` come fallback per l'evento Rifiutato.

### B.5 Regole autenticazione / rate limiting

**Login rate limit** (post-fix sessione 13): il rate limit viene chiamato SOLO su autenticazione fallita. I login riusciti non consumano token. Limite: 10 fallimenti / 15 min per IP. Key: `auth:login-fail:{ip}`.

**Verifica email:** `/verifica-email` è in `PUBLIC_PATHS` del proxy. Gli utenti non autenticati (appena registrati con email non confermata) possono accedere a questa pagina senza essere rimandati al login.

**OAuth bfcache:** `OAuthButtons.tsx` ha listener `pageshow` che resetta lo stato loading quando `e.persisted === true` (tornare dalla pagina Google su mobile).

### B.6 Regole email / deliverability

**`sendEmail`** in `lib/email/send.ts` invia sia HTML che plain-text (generato automaticamente strippando i tag HTML). NON aggiungere emoji nei subject o nel body — peggiorano lo spam score.

**FROM:** `Carta Canta <noreply@send.cartacanta.app>` — non modificare il dominio mittente senza aggiornare anche DKIM/SPF.

**replyTo:** le email di invio preventivo al cliente usano l'email dell'owner come `reply_to` — se il cliente risponde, arriva all'artigiano.

### B.7 Regola migration — COME COMUNICARLE ALL'UTENTE

**OGNI VOLTA che il codice richiede una nuova migration SQL, incollare il testo della migration in fondo al messaggio inviato all'utente**, in un blocco SQL ben visibile con titolo "⚠️ Migration da applicare". L'utente la copia direttamente su Supabase SQL Editor.

Formato obbligatorio da usare alla fine del messaggio:

```
---
### ⚠️ Migration da applicare su Supabase SQL Editor

\```sql
-- testo della migration qui
\```
```

**Non inviare il messaggio senza questo blocco se c'è una migration.** L'utente non deve cercarla nel codice.

### B.8 Regole PDF — ARCHITETTURA POST-SESSIONE 16 (aggiornata sessione 23)

**`buildPdfHtml()` in `lib/pdf/template.ts` è LA FONTE UNICA DI VERITÀ.**
Tutte le superfici visive usano questa funzione. Non creare layout alternativi.

**Watermark (sessione 23):** Il watermark diagonale "Carta Canta" è stato RIMOSSO per tutti i piani.
Rimane solo il footer `"Preventivo generato con Carta Canta · cartacanta.app"` (10px, visibile solo se `showWatermark=true` = Free).
Pro può disabilitare anche il footer impostando `show_watermark=false`.

**Font size (sessione 23):** tutti i font size in `lib/pdf/template.ts` sono stati scalati ×1.2 (es. 11px→13px, 14px→17px, 26px→31px).
Anche `TemplatePreview.tsx` è stato allineato con le stesse proporzioni.

**Email non allega PDF:** Il documento viene inviato come LINK pubblico (`/p/[token]`). Nessun allegato PDF.
Il testo default del messaggio email è "Le faccio avere il link a ${ref} come da nostra intesa."

**⚠️ Chromium headless NON funziona su Vercel Lambda** — nessuna versione di `@sparticuz/chromium` funziona (manca `libnss3` nel runtime serverless). Non tentare di reintrodurlo senza un piano alternativo (microservizio separato su Render/Railway).

**Architettura definitiva:**

```
buildPdfHtml(data: PdfDocumentData) → HTML string
  → /api/documents/[id]/pdf?preview=1  → tab solo visualizzazione (no stampa)
  → /api/documents/[id]/pdf            → tab con window.print() automatico → utente salva come PDF
  → /api/p/[token]/pdf                 → idem (pagina pubblica cliente)
  → lib/pdf/generate.ts → generatePdfBuffer() → @react-pdf/renderer → Buffer
      → /api/documents/[id]/send-email  (allegato email — visivamente diverso ma funzionale)

buildPdfHtml(data) → HTML string
  → app/p/[token]/page.tsx → <DocumentFrame html={html} />  → <iframe srcDoc> 
  → app/(app)/preventivi/[id]/page.tsx → <DocumentFrame> (anteprima in-app)
```

**`preparePrintHtml(html, triggerPrint)`** in `lib/pdf/logo.ts`:
- Inietta `@media print { print-color-adjust: exact }` — forzare colori/sfondi senza che l'utente spunti "Grafica in background"
- Se `triggerPrint=true`: inietta `window.onload=()=>window.print()`

**PdfActions** (`app/(app)/preventivi/_components/PdfActions.tsx`):
- "Anteprima": `/api/documents/[id]/pdf?preview=1` → solo visualizzazione
- "Salva come PDF": `/api/documents/[id]/pdf` → apre dialogo stampa automaticamente

**Logo:** `fetchLogoBase64()` in `lib/pdf/logo.ts` — URL → data-URI base64 (timeout 5s).

**`template_snapshot`** congela il template al momento dell'invio.
- `saveDraftAction` salva lo snapshot se viene cambiato `template_id`
- `send-email/route.ts` sovrascrive sempre lo snapshot al primo invio

**Fallback chain per il template** (identica in tutti i route e pagine):
1. `doc.template_snapshot` (congelato all'invio)
2. Template default del workspace (`is_default = true`)
3. Qualsiasi template del workspace (`limit 1`)
4. `null` → `buildPdfHtml()` usa stili hardcoded di default

**Performance:** `maxDuration = 60` sulle route PDF (Vercel Pro). Chromium startup ~5-15s. Cold start può richiedere fino a 20s al primo invio.

**`PreventivoPDF.tsx`** — NON più in uso nella chain di produzione. Candidato alla rimozione.

---

## C. FORMATO RISPOSTA OBBLIGATORIO PER OGNI TASK

Quando chiudi (o aggiorni) un task, la risposta **deve** contenere:

```
1. Bug/problema trovato
   - Causa reale confermata (dove nel codice, quale riga)

2. Fix implementato
   - Cosa esattamente è cambiato

3. File toccati
   - Lista con motivo della modifica

4. Migration necessarie
   - Sì / No — se sì, specifica SQL e se applicata

5. Test eseguiti
   - Cosa è stato verificato e COME (codice tracciato / browser reale / nessun test)

6. Esito finale
   - ✅ CHIUSO — verificato end-to-end nel browser
   - ⚠️ PARZIALE — fix codice ok, ma parte del fix richiede azione esterna o test non ancora fatto
   - 🟡 FIX APPLICATO — codice corretto per logica, da verificare manualmente
   - ❌ APERTO — causa identificata ma fix non ancora implementato
```

**Regola assoluta:** non scrivere "✅ CHIUSO" se non è stato verificato end-to-end nel browser reale o in un test automatico che riproduce il flusso.

---

## D. STATO PROGETTO — FEATURE COMPLETE (aggiornato sessione 23)

| Area | Stato | Note |
|---|---|---|
| Auth (email + OAuth) | ✅ Stabile | bfcache fix; rate limit fallimenti; reset password via /auth/confirm |
| Onboarding multi-step | ✅ Stabile | |
| Password sicura | ✅ Implementato | `PasswordStrength.tsx` — 4 requisiti validati client+server |
| Rinvia email verifica | ✅ Implementato | `/verifica-email` ha form resend via `supabase.auth.resend()` |
| Preventivi CRUD | ✅ Stabile | soft delete, re-edit, timeline, scadenze, Modificato banner |
| Fatture CRUD | ✅ Stabile | doppio entry point, Invia al cliente, timeline, Modificato banner |
| Clienti rubrica | ✅ Stabile | email/telefono obbligatori, full-text search, CF dedup |
| Catalogo CRUD | ✅ Stabile | |
| Template PDF — 4 preset | ✅ Stabile | font +20%, watermark diagonale rimosso, footer solo Free |
| Template — personalizzazioni Pro | ✅ Stabile | logo, font, legal notice |
| DocumentTimeline | ✅ Stabile | preventivi + fatture; eventi: sent/resent/modified/restored/accepted/rejected |
| Piano Free — quota storica | ✅ Stabile | `FREE_DOC_LIMIT = 8` |
| Soft delete + cestino | ✅ Stabile | `/cestino`, 15gg, cron purge |
| Dashboard KPI | ✅ Stabile | 4 card (accettati, valore prev, valore fatt, bozze); KPI fatturato → `/fatture?q=Pagata`; Prossima Scadenza → expires_at ASC |
| RevenueChart | ✅ Stabile | dual-bar accettati + fatturato |
| Referral system | ✅ Stabile | Team rimosso dall'UI referral |
| Piano Team | ⏸️ Nascosto | Card nascosta da abbonamento + referral fino al lancio |
| Stripe webhook | ✅ Stabile | |
| Voice input | ✅ Implementato | AssemblyAI SDK v4 |
| Export CSV preventivi | ✅ Implementato | |
| Cron scadenze + reminder | ✅ Stabile | |
| AI import | ⏸️ Disabilitato via flag | Bottone "IN ARRIVO" (flag `NEXT_PUBLIC_AI_IMPORT_ENABLED`). Per attivare: flag=true + chiavi OpenAI/Mistral |
| PostHog / Flagsmith / Sentry | ⏸️ Non configurati | |

---

## E. DECISIONI DI PRODOTTO CONFERMATE

| Decisione | Stato |
|---|---|
| Piano Team nascosto | ✅ Sessione 23 — nascosto da abbonamento + referral fino al lancio |
| Piano Team ⊇ Piano Pro | ✅ Confermato — nella logica interna Team include Pro |
| Limite Free: 8 preventivi storici (sent_quota_used) | ✅ Confermato — `FREE_DOC_LIMIT = 8` |
| Consumo Free: conta al primo invio | ✅ Implementato — non si decrementa alla cancellazione |
| Soft delete + cestino 15gg | ✅ Implementato |
| Numerazione: formato {NNN}/{YYYY} senza prefissi (no Prev/Fatt) | ✅ Confermato sessione 25 |
| Watermark diagonale rimosso | ✅ Sessione 23 — rimosso per tutti; solo footer Free |
| Font PDF +20% | ✅ Sessione 23 — confermato definitivo |
| `expires_at` riparte SOLO al (re)invio | ✅ Sessione 23 — salvataggio manuale non cambia scadenza |
| Email/telefono obbligatori per ogni cliente | ✅ Sessione 23 — bloccante in tutti i form creazione |
| Password: 4 requisiti obbligatori | ✅ Sessione 23 — maiuscola, minuscola, numero, simbolo |
| Email invio: link (no PDF allegato) | ✅ Confermato — testo default aggiornato |
| Template Free: preset non resetta colore | ✅ Confermato |
| Template Elegante: doc number NO brand color | ✅ Confermato — usa `safeAccentColor` |
| Preventivo accepted re-editabile se no fattura | ✅ Implementato |
| Kanban view rimosso | ✅ Definitivamente rimosso |
| AI import: attivare dopo test Pro | ✅ Confermato — key mancanti in prod |

---

## F. COSA NON TOCCARE SENZA SCREENSHOT/TEST

| Area | Motivo | Regola |
|---|---|---|
| `lib/fiscal/calcoli.ts` | Motore fiscale — 100% test coverage | Non toccare senza test. Nessuna eccezione. |
| `lib/pdf/template.ts` | 4 layout PDF su design di riferimento | Non modificare senza screenshot aggiornati |
| `TemplatePreview.tsx` | 4 layout React distinti, safeAccentColor | Non modificare senza screenshot |
| Stripe webhook handler | Funziona in produzione | Testare sempre in Stripe test mode prima |
| `template_snapshot` formato | I PDF vecchi usano snapshot congelato | Non cambiare formato senza considerare retrocompatibilità |

---

## 0. REGOLE BASE PER CLAUDE CODE

1. Leggi TUTTO questo file prima di scrivere codice
2. Un task alla volta — output sempre: file toccati + commit hash + tsc verde + build verde
3. Sequenza: capire → implementare → `npx tsc --noEmit` → `npm run build` → verificare → commit
4. Mai interpretare arbitrariamente una decisione di prodotto — se non è documentata qui, chiedi
5. Non reimplementare da zero senza prima trovare la causa precisa del problema
5-B. Prima di cambiare UI/copy/comportamento, leggi DECISIONI_E_FEEDBACK.md. NON annullare le voci ✅ (bloccate) senza istruzione esplicita di Eli.
6. **A fine di OGNI task** (non solo a fine sessione): aggiornare CLAUDE.md + `git push` (origin → Vercel) — questo è il backup primario. Confermare all'utente che il push è andato a buon fine. **Backup NAS (`git push nas master`) ora OPZIONALE** (decisione Eli 14 giu 2026): GitHub è la fonte di verità/backup; il NAS solo occasionale e solo quando il drive Z: è montato (utente `moian`). Con l'utente `elisa` il push NAS fallisce ed è normale — non bloccarsi.
7. `types/database.ts` va rigenerato dopo ogni migration
8. **Non dichiarare risolto un bug solo perché hai trovato la causa nel codice.** Usa il formato sezione C.

---

## 0-B. BACKUP NAS

```
NAS path:    Z:\CARTA CANTA
Remote git:  nas   (già configurato)
Comando:     git push nas master

File da ESCLUDERE sempre: node_modules/ .next/ dist/ build/ .claude/worktrees/ supabase/.temp/

⚠️ AGGIORNATO 14 giu 2026 — il NAS NON è più obbligatorio a ogni task. GitHub (origin) è il backup primario.
  1. Aggiorna CLAUDE.md
  2. git add <file specifici> && git commit -m "..."
  3. git push              (origin → Vercel Production, deploy automatico entro 1-3 min) — OBBLIGATORIO
  4. git push nas master   (OPZIONALE — backup NAS, solo se il drive Z: è montato; con utente 'elisa' fallisce ed è normale)
  5. Confermare all'utente: "Push origin riuscito — deploy Vercel partito. URL: https://cartacanta.app"

Nota: il drive Z: (NAS) è montato solo con l'utente 'moian'. Con l'utente 'elisa'
git push nas master fallisce con "does not appear to be a git repository".
In quel caso: eseguire solo git push origin, segnalare il fallimento NAS all'utente.
```

---

## 1. IDENTITÀ E POSIZIONAMENTO

**Carta Canta** è una SaaS italiana per preventivi e fatture, rivolta ad artigiani, freelance e piccole imprese.

- **Target primario:** Artigiani italiani (idraulici, elettricisti, falegnami, imbianchini, installatori) — usano prevalentemente il telefono, spesso in cantiere
- **Target secondario:** Freelance/professionisti in regime forfettario o ordinario
- **Target terziario:** Piccole realtà 2-5 persone (imprese edili, studi tecnici)

**Promessa:** *"Preventivi professionali in 60 secondi. Senza Excel, senza carta."*

UX mobile-first è **non negoziabile**: ogni funzionalità deve funzionare perfettamente dal telefono prima che dal computer.

---

## 2. TECH STACK

| Componente | Tecnologia | Versione / Note |
|---|---|---|
| Framework | Next.js App Router | **16.2.3** — NON 15 |
| Runtime UI | React | 19.2.4 |
| Database | Supabase (PostgreSQL 16) | `@supabase/supabase-js` 2.103 |
| Auth | Supabase Auth (PKCE flow) | Route Handler `/auth/callback`, NON Server Action |
| Hosting | Vercel Pro | Frankfurt fra1 — EU data residency |
| Pagamenti | Stripe | SDK 22.x |
| Email | Resend + React Email | HTML + plain-text (generato da strip HTML) |
| AI import | Mistral (primario) + OpenAI (fallback) | Disabilitato in prod (chiavi vuote) |
| Voice input | AssemblyAI SDK | 4.32.1 — `speech_models: ['universal']` (array, NON singolare) |
| Rate limiting | Upstash Redis + `@upstash/ratelimit` | sliding window |
| CSS | Tailwind CSS v4 | |
| Componenti UI | shadcn/ui (Radix UI) | `radix-ui` 1.4.x |
| PDF | `playwright-core` + `@sparticuz/chromium` | `buildPdfHtml()` → HTML → Chromium headless → PDF. `@react-pdf/renderer` / `PreventivoPDF.tsx` non più usati in produzione. |
| Analytics | PostHog EU | Non configurato in prod |
| Feature flags | Flagsmith | Non configurato in prod |
| Error tracking | Sentry | Non configurato in prod |
| Testing | Vitest (unit) + Playwright (E2E) | |
| Linguaggio | TypeScript 5.x strict mode | |

---

## 3. INFO OPERATIVE

```
Repo:           github.com/Elis93/carta-canta
Dev locale:     C:\Users\Public\carta-canta   (⚠️ spostato da C:\progetti\carta-canta — giugno 2026)
Backup NAS:     Z:\CARTA CANTA  (remote git "nas")
Hosting:        Vercel Pro fra1
DB:             Supabase — project ID ivbzuhgwszkdnlsybsao
URL prod:       https://cartacanta.app
Deploy:         push su master → Vercel Production automatico entro 1-3 min
```

---

## 4. STRUTTURA PROGETTO (rilevante)

```
app/
├── (app)/
│   ├── dashboard/                  # KPI, attività recente, PendingDocCard
│   ├── preventivi/
│   │   ├── page.tsx                # Lista con search unificata, filtri, tab status
│   │   ├── [id]/page.tsx           # Dettaglio con timeline, PDF, send
│   │   ├── scadenze/page.tsx       # Preventivi in scadenza entro 3gg
│   │   └── _components/           # PreventivoForm, VociTable, CatalogPicker,
│   │                               # DocumentTimeline, PdfActions, StatusBadge...
│   ├── fatture/
│   │   ├── page.tsx
│   │   ├── [id]/page.tsx           # Con LinkToPreventivoButton
│   │   └── _components/           # CreateFromPreventivoButton, LinkToPreventivoButton
│   ├── cestino/page.tsx            # Soft delete — recupero/purge (15gg)
│   ├── clienti/[id]/page.tsx
│   ├── template/                   # 4 preset, PresetSelector, TemplateEditor, Preview
│   ├── catalogo/                   # CRUD + AtecoCatalogSuggestion
│   ├── impostazioni/tabs/          # generali, fiscali (senza card Numerazione), piano, notifiche
│   ├── abbonamento/page.tsx        # Quota bar free, piano explanation
│   └── referral/
├── (auth)/
│   ├── login/page.tsx
│   ├── signup/
│   ├── verifica-email/page.tsx     # Accessibile senza auth (in PUBLIC_PATHS)
│   └── actions.ts                  # loginAction, signupAction, ecc.
├── p/[token]/                      # Pagina pubblica preventivo
├── api/
│   ├── documents/[id]/pdf/         # GET — genera/serve PDF (inline o attachment)
│   ├── documents/[id]/send-email/  # POST — invia email con PDF allegato
│   ├── preventivi/[id]/status/     # PATCH — cambio stato manuale
│   ├── p/[token]/accept|decline|view/
│   ├── cron/expire-documents/
│   ├── cron/referral/
│   └── webhooks/stripe/
lib/
├── actions/documents.ts            # Server Actions: create, saveDraft, send, duplicate,
│                                   # restore, purge, linkDocument, peekNextDoc/Invoice
├── actions/templates.ts            # CRUD template + selectPresetAction
├── fiscal/calcoli.ts               # INTOCCABILE — 100% coverage
├── pdf/template.ts                 # buildPdfHtml — 4 layout — INTOCCABILE senza screenshot
├── pdf/generate.ts                 # Playwright HTML→PDF + cache Supabase Storage
├── email/send.ts                   # sendEmail — HTML + plain-text generato
├── free-trial.ts                   # checkFreeBlock — FREE_DOC_LIMIT = 8
└── auth-rate-limit.ts              # isAuthRateLimited — Upstash Redis
proxy.ts                            # Middleware Next.js — PUBLIC_PATHS include /verifica-email
types/database.ts                   # GENERATO — non modificare manualmente
```

---

## 5. VARIABILI D'AMBIENTE

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_PRO_MONTHLY=
STRIPE_PRICE_PRO_YEARLY=
STRIPE_PRICE_TEAM_MONTHLY=
STRIPE_PRICE_TEAM_YEARLY=
STRIPE_PRICE_LIFETIME=
OPENAI_API_KEY=           # Fallback AI (vuota in prod)
MISTRAL_API_KEY=          # Primario AI (vuota in prod)
ASSEMBLYAI_API_KEY=
RESEND_API_KEY=
RESEND_FROM_EMAIL=noreply@send.cartacanta.app
RESEND_FROM_NAME=Carta Canta
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
CRON_SECRET=
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://eu.posthog.com
NEXT_PUBLIC_FLAGSMITH_KEY=
SENTRY_DSN=
NEXT_PUBLIC_APP_URL=https://cartacanta.app
NEXT_PUBLIC_APP_NAME=Carta Canta
NEXT_PUBLIC_AI_IMPORT_ENABLED=    # 'true' per mostrare il bottone AI Import (richiede anche OPENAI/MISTRAL key)
```

---

## 6. PIANI E FEATURE GATING

```typescript
// lib/stripe/plans.ts — valori effettivi in produzione
Piano Free:         limit = 8 preventivi storici (sent_quota_used in lib/free-trial.ts)
                    1 template, watermark visibile, voice 300s/mese
Piano Pro:          preventivi illimitati, template illimitati, no watermark, voice 3600s/mese
Piano Team:         tutto Pro + 5 collaboratori + approval workflow
Piano Lifetime:     tutto Pro, pagamento one-time
```

**Prezzi Stripe:**
```
Free:           €0
Pro Mensile:    €19.00/mese
Pro Annuale:    €182.00/anno
Team Mensile:   €49.00/mese
Team Annuale:   €470.00/anno
Lifetime:       €299.00 one-time
```

**Template gating:**
- Free: scelta 4 preset base, 1 template max, nessuna personalizzazione avanzata
- Pro/Team: colore, font, logo position, watermark, legal notice, header/footer HTML, template illimitati

---

## 7. DATABASE SCHEMA

### Enums
```sql
plan_type:     free | pro | team | lifetime
fiscal_regime: forfettario | ordinario | minimi
doc_status:    draft | sent | viewed | accepted | rejected | expired
```

### Tabelle principali

**`workspaces`**: `owner_id`, `plan`, `stripe_customer_id`, `stripe_subscription_id`, `billing_interval`, `fiscal_regime`, `ateco_codes TEXT[]`, `validity_days`, `logo_url`, `bollo_auto`, `ritenuta_auto`, `sent_quota_used INT`.

**`documents`**: `doc_type` ('preventivo'|'fattura'), `status`, `public_token`, `doc_number`, `doc_year`, `doc_seq`, `template_snapshot JSONB`, `signature_image`, `rejection_reason`, `bonus_edilizio`, `origin_document_id UUID` (per fatture da preventivo), `last_reminder_at TIMESTAMPTZ`, `deleted_at TIMESTAMPTZ` (null = attivo, non-null = nel cestino), `accepted_at`, `accepted_ip`, `accepted_ua`, `signer_name`.

**`document_items`**: `sort_order`, `description`, `unit`, `quantity`, `unit_price`, `discount_pct`, `vat_rate`, `total`, `bonus_tipo`.

**`invoice_sequences`**: PK `(workspace_id, year, doc_type)`. Colonne: `doc_type TEXT`, `seq_type TEXT` (legacy), `last_number INT`, `year`, `workspace_id`. Funzione RPC `next_invoice_number(p_workspace, p_year, p_doc_type)` — atomica, usa INSERT ON CONFLICT DO UPDATE.

**`templates`**: `preset_key TEXT CHECK('classico'|'bold'|'tecnico'|'elegante')`, `color_primary`, `font_family`, `show_logo`, `show_watermark`, `legal_notice`, `header_html`, `footer_html`, `logo_position TEXT('left'|'right')`, `is_default`.

**`catalog_items`**: `workspace_id`, `name`, `description`, `unit`, `unit_price`, `vat_rate`, `category`, `is_active`.

**`document_views`**: `document_id`, `viewed_at`, `user_agent`, `ip_address`.

**`referral_codes`**, **`referral_uses`**, **`referral_rewards`**: vedi sezione 13.

**`voice_usage`**: `workspace_id`, `period TEXT` (YYYY-MM), `seconds_used`. UNIQUE su `(workspace_id, period)`.

### Migration applicate (001–031)

| # | Contenuto |
|---|---|
| 001 | Schema completo: workspaces, clients, templates, documents, RLS |
| 002 | `doc_year`, `doc_seq` generated columns |
| 003–010 | signer_name, viewed_status, document_views, notification_prefs, catalog_items, fatture, signature_image, rejection_reason |
| 011 | rate_limit_events |
| 012–013 | invoice_sequences per doctype, next_invoice_number unificata |
| 014–017 | ateco_codes array, bonus_edilizio, workspace_validity_days, storage logos |
| 018 | Referral system + trigger + RLS + my_workspace_ids() |
| 019 | voice_usage |
| 020 | billing_interval su workspaces + reward_month su referral_rewards |
| 021 | template preset_key CHECK |
| 022 | template logo_position + number_format |
| 023 | pdf_downloaded_at |
| 024 | free_trial_expires_at |
| 025 | sent_quota_used su workspaces |
| 026 | origin_document_id su documents |
| 027 | fix doc_seq prefix per prefissi non-numerici |
| 028 | repair invoice_sequences (aggiunge doc_type, ricrea PK, aggiorna RPC) |
| 029 | last_reminder_at TIMESTAMPTZ su documents |
| 030 | deleted_at TIMESTAMPTZ su documents + indici parziali (soft delete) |
| 031 | next_invoice_number: SECURITY DEFINER + GREATEST anti-gap (applicata 20 mag 2026) |

---

## 8. MOTORE FISCALE — REGOLE INVIOLABILI

```typescript
// lib/fiscal/calcoli.ts — NON TOCCARE senza test

// ARROTONDAMENTO: sempre round half up — MAI toFixed() — MAI banker's rounding
function roundFiscale(v: number) { return Math.round((v + Number.EPSILON) * 100) / 100 }

// ORDINE CALCOLO OBBLIGATORIO:
// 1. totale per voce (qty × price × (1 - discount%))
// 2. subtotale
// 3. sconto globale
// 4. IVA PER VOCE (non sul totale — obbligatorio per legge IT)
// 5. ritenuta d'acconto
// 6. marca da bollo (forfettari con afterDiscount > 77.47 → €2.00)
// 7. totale finale
```

---

## 9. FLOWS UTENTE

### Creazione preventivo
1. Nuovo → seleziona cliente → aggiunge voci (con microfono) → salva bozza
2. Invia al cliente → email con PDF → public_token generato → status 'sent'
3. Cliente apre `/p/[token]` → accetta/rifiuta → notifica email all'artigiano
4. Accettazione: salva IP + UA + timestamp → status 'accepted'
5. Opzionale: converte in fattura (doppio entry point)

### Link pubblico cliente
- URL: `/p/[token]` — MAI `/preventivi/[id]`
- No auth, mostra preventivo nel template
- Email `reply_to` impostata sull'email dell'owner

### Re-edit preventivo accepted
- Disponibile se non ha fattura collegata con status accepted
- `saveDraftAction` resetta status a 'draft', azzera `accepted_at`
- Se ha fattura collegata accepted → locked, solo lettura

### Soft delete
- `deleteDocumentAction` imposta `deleted_at = now()`
- `/cestino` mostra i documenti nel cestino con countdown 15gg
- `restoreDocumentAction` azzera `deleted_at`
- `purgeDeletedDocumentAction` cancella definitivamente
- Cron auto-purge documenti con `deleted_at > 15gg`

---

## 10. RATE LIMITING

```typescript
// lib/auth-rate-limit.ts
// Auth login: 10 fallimenti / 15min per IP — conta solo errori, non login riusciti
// Key: auth:login-fail:{ip}

// lib/rate-limit.ts (in-memory fallback)
// send-email: 10/ora per user
// accept/decline: 5/ora per token
// AI extract: 5/min
// PDF: 10/min
```

---

## 11. FEATURE FLAGS (Flagsmith — non configurato in prod)

```typescript
FEATURE_AI_IMPORT: true (ma chiavi vuote)
FEATURE_VOICE_INPUT: true
FEATURE_REFERRAL: true
FEATURE_SDI_INTEGRATION: false
FEATURE_MARKETPLACE: false
FEATURE_PUBLIC_API: false
```

---

## 12. FUNZIONALITÀ IMPLEMENTATE (sintesi)

- Auth: email/password + OAuth Google (solo Google — GitHub non implementato) + bfcache fix mobile
- Onboarding multi-step (fiscali, ATECO, logo)
- Preventivi CRUD + status workflow + DocumentTimeline + re-edit accepted
- Soft delete + cestino + recupero 15gg
- Pagina scadenze `/preventivi/scadenze`
- Fatture CRUD + conversione da preventivo (doppio entry point + idempotenza)
- Collegamento bidirezionale preventivo ↔ fattura
- Clienti: rubrica + full-text search + StatusBadge + CF dedup
- Catalogo: CRUD + suggerimento ATECO verificato in produzione
- Template PDF: 4 preset (Classico, Bold, Tecnico, Elegante)
- Template: personalizzazioni Free/Pro + safeAccentColor + logo position
- PdfActions: server-side links (non più client-side)
- Dashboard: 5 KPI + RevenueChart dual-bar + PendingDocCard solleciti
- Referral: codici, cron premi mensili, pagina piano-specifica
- Stripe: webhook + billing_interval + subscription lifecycle
- Voice input: AssemblyAI SDK v4, quota mensile per piano
- AI import: endpoint pronto, disabilitato in prod (chiavi vuote)
- Export CSV preventivi
- Cron: scadenze + last_reminder_at + referral premi
- Email: HTML + plain-text, replyTo owner, no emoji nei subject/body

---

## 13. LOGICA REFERRAL

La logica viene calcolata il **1° di ogni mese** dal cron `/api/cron/referral`. Premio quando il referrer ha **3+ referee con abbonamento attivo**.

| Piano referrer | Tipo referee | Beneficio |
|---|---|---|
| Free | Qualsiasi abbonamento | 1 mese Pro gratis |
| Pro mensile | Qualsiasi abbonamento | Rinnovo €19 non addebitato |
| Pro annuale | Qualsiasi abbonamento | Scadenza +1 mese |
| Team mensile | 3+ Piano Team | Rinnovo €49 non addebitato |
| Team mensile | 3+ Piano Pro (non Team) | 50% sconto rinnovo (€24,50) |
| Team annuale | 3+ Piano Team | Scadenza +1 mese |
| Team annuale | 3+ Piano Pro (non Team) | Scadenza +2 settimane |

---

## 14. 4 TEMPLATE PDF — SPECIFICHE VISIVE

**NON modificare senza screenshot di riferimento aggiornati.**

| Preset | Font | Target | Caratteristica chiave |
|---|---|---|---|
| **Classico** | Inter | Artigiani, imprese | Header bianco, "PREVENTIVO" 26px a destra, table header scuro |
| **Bold** | Helvetica | Imprese, ristrutturazioni | Header dark full-width, badge pillola doc number, box "TOTALE DA PAGARE" |
| **Tecnico** | GeistSans | Elettricisti, idraulici, geometri | Strip 4 celle, colonna COD, totale sulla seconda riga voce |
| **Elegante** | Georgia | Consulenti, creativi, architetti | Logo bordato (non riempito), serif, doc number grande italic, no fill header table |

`safeAccentColor` è obbligatorio: se il colore brand è chiaro (luminosità > soglia), usa `#1a1a2e` per il testo — mai testo chiaro su sfondo bianco.

---

## 15. DEBITO TECNICO

| Voce | Priorità | Stato |
|---|---|---|
| AI import attivazione | Media | Chiavi vuote in prod — attivare quando pronto |
| PostHog / Flagsmith / Sentry | Bassa | Configurare chiavi in prod |
| INET → TEXT per `ip_address` | Bassa | Opzionale, non urgente |
| `referee_workspace_id` nullable | Bassa | Decisione aperta |
| Logo PNG nel PDF | Alta | Non testato con logo reale — da verificare |
| Email spam | Alta | Fix codice applicato (plain-text + no emoji). DNS da verificare. |

---

## 16. ROADMAP — DECISO MA RIMANDATO

| Feature | Note |
|---|---|
| Numerazione bozze separata | "Bozza 001" vs "Prev001/2026" — proposta non confermata. Migration + logica separata. |
| TASK 13 — Template preview consistency | Descrizione vaga. Non procedere. |
| SDI / fatturazione elettronica | Provider gestito, ~€0.10/fattura. Rimandato. |
| Team collaboration UI | DB pronto, manca UX inviti. |
| Portale cliente avanzato | Diverso da p/[token]. |
| Notifiche push mobile | — |
| Multi-lingua PDF | Fase 2. |
| Marketplace ATECO | Fase 3. |

---

## 17. COMMIT RECENTI RILEVANTI

```
83f1b89  fix(bugs): 7 bug fix — auth, PDF, numerazione, email, mobile         ← SESSIONE 13
a9ea4fe  fix(ux): tasks 29-45 — doc number prefix, template fields, CF dedup  ← pre-sessione 13
53b2c61  fix(ux): mobile fixes, auth email URL, fattura-da-preventivo          ← pre-sessione 13
58438b1  feat(preventivi): timeline always visible, link fattura, quota fix    ← pre-sessione 13
741ee8c  feat(preventivi): accepted→draft re-edit, DocumentTimeline            ← pre-sessione 13
d4dbddf  fix(ux): doc number prefixes, segna accettato, status dropdown        ← pre-sessione 13
92670ce  fix(ux): sollecito ripetibile, login hints, VociTable lg, dual-bar    ← SESSIONE 12
225c949  fix(ux): OAuth bfcache, login error hints, VociTable mobile, no kanban← SESSIONE 12
7ec389b  feat(ux): soft delete cestino + dashboard KPI fatturato               ← pre-sessione 12
3d671d3  fix(ux): hardcode prefixes + scadenze page + update overlay           ← pre-sessione 12
066dee1  feat(solleciti): last_reminder_at + email deliverability fixes        ← SESSIONE 11
356b9f3  fix(dashboard): split draft KPI preventivi + fatture                  ← SESSIONE 11
```

---

## 18. COMANDI UTILI

```bash
# Sviluppo
npm run dev

# Type check (OBBLIGATORIO prima di ogni commit)
npx tsc --noEmit

# Rigenerare tipi Supabase (dopo ogni migration)
npx supabase gen types typescript --project-id ivbzuhgwszkdnlsybsao > types/database.ts

# Build
npm run build

# Test
npm test

# Backup NAS
git push nas master

# Forzare rigenerazione PDF
GET /api/documents/[id]/pdf?force=1
```

---

## 19. CHECKLIST PER RIPRENDERE IL LAVORO

- [ ] Leggi questo file per intero (almeno sezioni A, B, C, D)
- [ ] `git log --oneline -5` — capire l'ultimo stato
- [ ] Verifica bug aperti in sezione A prima di iniziare nuovi task
- [ ] Prima di ogni modifica: capire la causa reale nel codice
- [ ] Dopo ogni modifica: `npx tsc --noEmit` + `npm run build` — entrambi verdi
- [ ] Aggiorna CLAUDE.md a fine sessione con formato sezione C
- [ ] Backup NAS + push origin prima di chiudere
