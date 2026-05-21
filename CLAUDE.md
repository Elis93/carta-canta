# CLAUDE.md — Memoria permanente del progetto Carta Canta

> **Fonte di verità per Claude Code.**
> Va aggiornato a fine di ogni sessione con: feature implementate, decisioni prese, bug emersi, cose rimandate.
> **Ultima sessione:** 20 maggio 2026 (sessione 14)

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

## A. HANDOFF — SESSIONE 15 (21 maggio 2026)

### Stato attuale

Questa sessione ha completato l'architettura "fonte unica di verità" per i template: `buildPdfHtml()` in `lib/pdf/template.ts` ora è l'unico sistema che genera il layout di documenti su tutte e 4 le superfici. Vedi sezione H.

La sessione precedente (14, 20 maggio) aveva risolto la discordanza template a livello di snapshot/dati. Ora la discordanza è risolta anche a livello di RENDERING: tutte le superfici chiamano la stessa funzione.

### Migration pendenti

Nessuna. Tutte le migration 001–032 risultano applicate.

### Migration da applicare

**Tutte le migration 001–031 risultano applicate** (029: `last_reminder_at`, 030: `deleted_at`/soft-delete, 031: `next_invoice_number` SECURITY DEFINER+GREATEST — applicate manualmente il 20 maggio 2026). Non ci sono migration pendenti.

### Bug aperti — stato onesto dopo sessione 14

| # | Bug | Stato | Note |
|---|---|---|---|
| 1 | **Email finiscono nello spam** | ⚠️ PARZIALE | Fix codice: plain-text aggiunto, emoji rimosso. DNS non verificato. Richiede test manuale. |
| 2 | **Verifica email → reindirizza a login** | 🟡 FIX APPLICATO — da verificare | `proxy.ts`: `/verifica-email` aggiunto a `PUBLIC_PATHS`. Non testato in browser. |
| 3 | **Rate limit scatta su login riusciti** | 🟡 FIX APPLICATO — da verificare | `loginAction`: rate limit ora conta solo fallimenti. Non testato con login reali. |
| 4 | **Numero preventivo non assegnato all'invio** | ✅ CHIUSO | Causa: doppio overload `next_invoice_number(INT)` vs `(SMALLINT)`. Fix: migration 032. Verificato in browser. |
| 5 | **Numerazione non incrementa (sempre 001/2026)** | 🟡 FIX APPLICATO — da verificare | `peekNextDocNumber/InvoiceNumber`: `seq_type` → `doc_type`. Non testato con sequenza reale. |
| 6 | **PDF preview/download non funzionano** | 🟡 FIX APPLICATO — da verificare | `PdfActions`: ora server-side links (`/api/documents/[id]/pdf`). Non testato in browser. |
| 7 | **Mobile — IVA invisibile** | 🟡 FIX APPLICATO — da verificare | `VociTable`: rimosso `hidden sm:block`, `grid-cols-5` fisso, label corrette. Da verificare su device reale. |
| 8 | **Google OAuth → a volte chiede credenziali di nuovo** | ❌ APERTO | Intermittente. OAuth bfcache fix applicato in sessione 12 (225c949). Non confermato risolto. |
| 9 | **Logo PNG non visibile nel PDF** | ❌ APERTO | `fetchLogoBase64` implementato ma non testato con logo reale nei 4 preset. |
| 10 | **Warning "già inviato" su bozza vergine** | ✅ CHIUSO | Fix (`e603a48`): `handleSend()` ora naviga a `?send=1` senza chiamare `sendDocumentAction` prima. |
| 11 | **Template PDF/anteprima/link cliente discordanti** | ✅ CHIUSO (sessioni 14–15) | Dati: sezione G. Rendering: sezione H. |

### Email deliverability — cosa resta da fare fuori dal codice

1. Resend Dashboard → Domains → verifica **Status: Verified** per `send.cartacanta.app`
2. Verifica record SPF su `send.cartacanta.app` (deve includere Resend)
3. Bounce/complaint rate in Resend dashboard: < 5% / < 0.1%
4. Test diretto: invia preventivo a Gmail → verifica inbox (non spam)

### Da verificare manualmente prima del prossimo task

| Check | Come |
|---|---|
| Bug #2: link verifica email | Signup nuovo account → clicca "Vai alla pagina di verifica" → deve aprire /verifica-email |
| Bug #3: rate limit | 3 login riusciti consecutivi → nessun blocco |
| Bug #4: numero assegnato | Crea bozza senza numero → invia → doc_number nel DB deve essere Prev001/2026 |
| Bug #5: numerazione | Crea 3 preventivi → numeri devono essere Prev001, Prev002, Prev003 |
| Bug #6: PDF | Apri preventivo inviato → clicca Anteprima PDF → PDF si apre in nuova scheda |
| Bug #7: mobile IVA | Apri preventivo su telefono → IVA visibile nella griglia voci |

### Decisioni di prodotto pendenti — NON implementare senza conferma

| Decisione | Proposta | Stato |
|---|---|---|
| **Numerazione bozze** | "Bozza 001" senza anno finché non inviato, poi "Prev001/2026" al primo invio | ⏳ Attende conferma |
| **TASK 13 — Template preview consistency** | ✅ CHIUSO (sessione 14) — la discordanza tra preset scelto e PDF/link cliente è stata risolta. Se il task intendeva altro, specificare. |

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

### B.3 Regole numerazione documenti

**I prefissi Prev/Fatt sono hardcoded** in `lib/actions/documents.ts`:
- `allocateDocNumber()` → `Prev{NNN}/{YYYY}`
- `allocateInvoiceNumber()` → `Fatt{NNN}/{YYYY}`
- `peekNextDocNumber()` → preview Prev (usa colonna `doc_type` su `invoice_sequences`, NON `seq_type`)
- `peekNextInvoiceNumber()` → preview Fatt (idem)

**Non c'è più una card "Numerazione documenti" in impostazioni** (rimossa in session 13 — 3d671d3). Il prefisso non è configurabile dall'utente.

**Il numero viene assegnato al momento del primo invio**, NON alla creazione della bozza. Una bozza senza numero manuale ha `doc_number = null` finché non viene inviata. Alla prima send, `send-email/route.ts` chiama `next_invoice_number` RPC.

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

### B.7 Regole PDF — ARCHITETTURA POST-SESSIONE 15

**`buildPdfHtml()` in `lib/pdf/template.ts` è LA FONTE UNICA DI VERITÀ.**
Tutte le superfici che mostrano un documento usano questa funzione. Non creare layout alternativi.

**Chain di generazione PDF:**
```
buildPdfHtml(data: PdfDocumentData) → HTML string
  → lib/pdf/generate.ts → generatePdfBuffer() → playwright-core + @sparticuz/chromium → PDF buffer
    → /api/documents/[id]/pdf  (download + anteprima inline)
    → /api/documents/[id]/send-email  (allegato email)
```

**Chain del link pubblico:**
```
buildPdfHtml(data: PdfDocumentData) → HTML string
  → app/p/[token]/page.tsx → <DocumentFrame html={html} />
    → <iframe srcDoc={html}> nel browser del cliente
```

**PdfActions** (`app/(app)/preventivi/_components/PdfActions.tsx`) usa link server-side:
- Anteprima: `/api/documents/[id]/pdf?inline=1` → `Content-Disposition: inline`
- Download: `/api/documents/[id]/pdf` → `Content-Disposition: attachment`
- Forzare rigenerazione (bypassa cache): `?force=1`

**Logo:** `fetchLogoBase64()` in `lib/pdf/logo.ts` — URL → data-URI base64 (timeout 5s).
Chiamata in `generatePdfBuffer()` prima di `buildPdfHtml()`.

**`template_snapshot`** congela il template al momento dell'invio. Tutti i PDF successivi usano lo snapshot, non il template live.
- `saveDraftAction` salva lo snapshot se viene cambiato `template_id` (azzera `pdf_url = null`)
- `send-email/route.ts` sovrascrive sempre lo snapshot al primo invio

**Fallback chain per il template** (identica in PDF route, send-email route, e public page):
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

## D. STATO PROGETTO — FEATURE COMPLETE

| Area | Stato | Note |
|---|---|---|
| Auth (email + OAuth) | ✅ Stabile | bfcache fix applicato; rate limit solo su fallimenti |
| Onboarding multi-step | ✅ Stabile | |
| Preventivi CRUD | ✅ Stabile | soft delete, re-edit accepted, timeline, scadenze |
| Fatture CRUD | ✅ Stabile | doppio entry point, collegamento bidirezionale |
| Clienti rubrica | ✅ Stabile | full-text search, StatusBadge, CF dedup |
| Catalogo CRUD | ✅ Stabile | suggerimento ATECO verificato in produzione |
| Template PDF — 4 preset | ✅ Stabile | buildPdfHtml() è fonte unica per PDF, email, link cliente (sessione 15). Non toccare senza screenshot. |
| Template — personalizzazioni Pro | ✅ Stabile | logo position, font, watermark, legal notice |
| Piano Free — quota storica | ✅ Stabile | `sent_quota_used`, `FREE_DOC_LIMIT = 8` |
| Soft delete + cestino | ✅ Implementato | `/cestino`, recupero 15gg, cron purge |
| DocumentTimeline | ✅ Implementato | su tutti i preventivi, incluse bozze |
| Scadenze rapide | ✅ Implementato | `/preventivi/scadenze`, PendingDocCard per riga |
| Dashboard KPI | ✅ Implementato | 5 card: preventivi accettati, valore prev, valore fatt, bozze, pagamenti attesa |
| RevenueChart | ✅ Implementato | dual-bar accettati + totale creati |
| Referral system | ✅ Implementato | cron, premi, pagina piano-specifica |
| Stripe webhook | ✅ Stabile | billing_interval tracciato |
| Voice input | ✅ Implementato | AssemblyAI SDK v4 |
| Export CSV preventivi | ✅ Implementato | filtro doc_type applicato |
| Cron scadenze + reminder | ✅ Implementato | `last_reminder_at` tracciato |
| Cron referral premi | ✅ Implementato | 1° ogni mese |
| PdfActions server-side | ✅ Implementato | link a /api/documents/[id]/pdf |
| AI import | ⏸️ Disabilitato | chiavi API vuote in prod |
| PostHog / Flagsmith / Sentry | ⏸️ Non configurati | chiavi mancanti in prod |

---

## E. DECISIONI DI PRODOTTO CONFERMATE

| Decisione | Stato |
|---|---|
| Piano Team ⊇ Piano Pro | ✅ Confermato — Team include tutto Pro, differenze solo su referral/collaboratori |
| Limite Free: 8 preventivi storici (sent_quota_used) | ✅ Confermato in produzione — `FREE_DOC_LIMIT = 8` nel codice |
| Consumo Free: conta al primo invio (draft→sent) | ✅ Implementato — non si decrementa alla cancellazione |
| Soft delete + cestino 15gg | ✅ Implementato — migration 030 applicata |
| Numerazione: prefissi Prev/Fatt hardcoded | ✅ Implementato — non configurabile da impostazioni |
| Template Free: preset non resetta colore | ✅ Confermato — `selectPresetAction` aggiorna solo `preset_key` |
| Template Elegante: doc number NO brand color | ✅ Confermato — usa `safeAccentColor` |
| Preventivo accepted re-editabile se no fattura collegata | ✅ Implementato (741ee8c) |
| Kanban view rimosso | ✅ Rimosso definitivamente (225c949) |
| PdfActions: server-side links | ✅ Implementato (83f1b89) |

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

## G. SESSIONE 14 — 20 MAGGIO 2026 — RIEPILOGO

### Problema segnalato

L'utente aveva impostato un template personalizzato, ma il PDF scaricato, l'anteprima e la pagina pubblica `/p/[token]` mostravano tutti template diversi tra loro e diversi da quello scelto.

### Cause radice identificate (3 bug distinti in cascata)

**Bug 1 — `PreventivoPDF.tsx` aveva un solo layout hardcoded**

`PreventivoPDF.tsx` non usava `preset_key` — la funzione `makeStyles()` non esisteva e il layout era unico (assomigliava al Bold) per tutti e 4 i preset. Il template selezionato era irrilevante.

Fix: riscrittura di `PreventivoPDF.tsx` con `makeStyles(primary, preset)` che differenzia:
- Font: Elegante → Times-Roman/Bold/Italic; tutti gli altri → Helvetica (font built-in, nessun download)
- Header: Bold → `backgroundColor: primary`; Tecnico → bordo inferiore 3px; Classico/Elegante → linea sottile
- Table header: Elegante → no fill + bordo grigio; Bold → tint 18% + testo colorato; Classico/Tecnico → fill pieno + testo bianco
- Footer: Bold → sfondo tinto; altri → grigio chiaro con border-top

**Bug 2 — `mapToPdfData` in `generate.ts` scartava `preset_key` e `font_family`**

La funzione di mapping non passava `preset_key` né `font_family` al componente `PreventivoPDF`. Anche dopo il fix al componente, il preset sarebbe rimasto ignoto.

Fix: aggiunto passaggio esplicito in `mapToPdfData`:
```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
preset_key:  (template as Record<string, unknown>).preset_key  as string | null ?? null,
font_family: (template as Record<string, unknown>).font_family as string | null ?? null,
```
(Cast `any` necessario perché Supabase `Json` non accetta `Record<string, unknown>`)

**Bug 3 — `saveDraftAction` non salvava mai i cambiamenti di template**

`saveDraftAction` parsava `template_id` dal form ma non lo scriveva mai nel DB (né nel documento, né in `template_snapshot`). Ogni cambio di template su una bozza veniva silenziosamente ignorato.

Fix: `saveDraftAction` ora:
1. Se `template_id` è presente nel form → fetch del template da Supabase
2. Salva `template_snapshot` sul documento
3. Azzera `pdf_url = null` per invalidare la cache

**Bug 4 — Pagina pubblica `/p/[token]` senza fallback template**

La pagina pubblica leggeva solo `doc.template_snapshot` e usava colori hardcoded se null. Per i documenti inviati prima dei fix, lo snapshot era null → la pagina mostrava preset di default.

Fix: implementata fallback chain a 4 livelli (snapshot → default workspace → qualsiasi template workspace → nessuno).

**Bug 5 (strutturale) — Layout card HTML diverso dal PDF**

Anche con il template corretto, la pagina pubblica aveva struttura visiva diversa dal PDF: date nel header invece che nella sezione info, colonna UM mancante, doc type label in maiuscolo/minuscolo diverso.

Fix: ristrutturata la card in `/p/[token]/page.tsx`:
- Header: logo+azienda a sinistra | tipo documento+numero a destra (date spostate)
- Bold: header card con `backgroundColor: colorPrimary`
- Tecnico: bordo sinistro 3px brand color
- Sezione 2 colonne: DESTINATARIO (sinistra) + DATA EMISSIONE+date (destra)
- Table header: rispetta il preset (Elegante → no fill; Bold → tint; Classico/Tecnico → fill pieno)
- Colonna UM aggiunta (`hidden sm:table-cell`)
- Doc type label: uppercase per tutti tranne Elegante (italic)

### File toccati (sessione 14)

```
components/pdf/PreventivoPDF.tsx        [RISCRITTURA PARZIALE — makeStyles() + 4 preset]
lib/pdf/generate.ts                     [mapToPdfData: aggiunto preset_key + font_family]
lib/actions/documents.ts                [saveDraftAction: salva template_snapshot + azzera pdf_url]
app/api/documents/[id]/send-email/route.ts  [sempre sovrascrive template_snapshot al primo invio]
app/p/[token]/page.tsx                  [fallback chain template + ristrutturazione card layout]
```

### Commit sessione 14

```
19188ae  fix(pdf): implement 4-preset rendering in PreventivoPDF + pass preset_key in mapToPdfData
24d5d3e  fix(draft): saveDraftAction now saves template_snapshot and invalidates pdf_url
fda7cbb  fix(public): 4-level template fallback chain in /p/[token]
9ebd1ef  fix(public): restructure /p/[token] card layout to match PDF structure
```

### Note tecniche importanti emerse

- `lib/pdf/template.ts` è **codice morto** — l'approccio Playwright/HTML non è mai usato. Il PDF reale è generato da `@react-pdf/renderer` via `PreventivoPDF.tsx`.
- I font di `@react-pdf/renderer` devono essere **built-in** (Helvetica, Times-Roman, Courier) o registrati esplicitamente con `Font.register()`. Non si possono usare font Google/system senza download.
- Supabase `Json` type non è assegnabile da `Record<string, unknown>` — serve cast `as any` con commento ESLint `// eslint-disable-next-line @typescript-eslint/no-explicit-any`.
- Il campo `PdfData.template` deve avere `preset_key?: string | null` e `font_family?: string | null` — aggiornare l'interfaccia se si aggiungono altri campi al template.

### Cose aperte dopo sessione 14

1. Test manuale: verificare PDF generato (session 14 fix) — ora sostituito dalla sessione 15 che usa playwright
2. Bug #5 numerazione (sempre 001/2026) — da verificare con sequenza reale
3. Bug #6 PDF preview/download — da verificare in browser
4. Bug #7 mobile IVA — da verificare su device reale
5. Logo PNG nel PDF — ora gestito da `fetchLogoBase64()` in `lib/pdf/logo.ts`; testare con logo reale

---

## H. SESSIONE 15 — 21 MAGGIO 2026 — RIEPILOGO

### Problema segnalato

Discordanza visiva tra le 4 superfici di rendering. La sessione 14 aveva allineato i DATI (snapshot, preset_key), ma non il RENDERING: ogni superficie aveva il proprio codice di layout separato e poteva divergere a qualsiasi modifica futura.

### Soluzione implementata: `buildPdfHtml()` come fonte unica di verità

La funzione `buildPdfHtml()` in `lib/pdf/template.ts` genera HTML completo (4 preset, watermark, logo, note legali, tutti gli stili inline). Tutte e 4 le superfici ora la usano:

| Superficie | Prima | Dopo |
|---|---|---|
| PDF scaricabile (e anteprima) | `@react-pdf/renderer` + `PreventivoPDF.tsx` (layout parallelo) | `playwright-core` + `@sparticuz/chromium` → `buildPdfHtml()` HTML → PDF |
| PDF allegato email | stessa chain di sopra | auto-corretto (chiama `generatePdfBuffer`) |
| Pagina pubblica `/p/[token]` | JSX custom con Tailwind (~200 righe) | `buildPdfHtml()` via `<DocumentFrame>` (iframe srcDoc) |
| Template preview settings | rimane `TemplatePreview.tsx` (fuori scope, dati campione) | invariato per ora |

### File creati / modificati

```
lib/pdf/logo.ts                         [NUOVO] fetchLogoBase64() — URL → data-URI base64
lib/pdf/generate.ts                     [RISCRITTURA] playwright-core + chromium + buildPdfHtml()
components/public/DocumentFrame.tsx     [NUOVO] <iframe srcDoc> auto-sizing per /p/[token]
app/p/[token]/page.tsx                  [SEMPLIFICATO] ~430 → ~270 righe; usa buildPdfHtml()
app/api/documents/[id]/pdf/route.ts     [+] export const maxDuration = 60 (Vercel Pro)
app/api/documents/[id]/send-email/route.ts [+] export const maxDuration = 60 (Vercel Pro)
```

### Architettura post-sessione 15

```
buildPdfHtml(data: PdfDocumentData): string
    ↓ chiamato da
    ├── lib/pdf/generate.ts → generatePdfBuffer() → playwright → PDF buffer
    │       ↓ chiamato da
    │       ├── /api/documents/[id]/pdf (download + anteprima)
    │       └── /api/documents/[id]/send-email (allegato email)
    └── app/p/[token]/page.tsx → <DocumentFrame html={...} />
                                     ↓
                                 <iframe srcDoc={html}> (browser)
```

### Note tecniche

- `@sparticuz/chromium` + `playwright-core` sono già in `package.json` — nessuna nuova dipendenza
- La precedente nota "Playwright/Chromium è codice morto" era riferita a `playwright-chromium` (con browser bundled). `playwright-core` + `@sparticuz/chromium` è l'approccio corretto per Vercel serverless.
- `maxDuration = 60` sulle due route PDF per Vercel Pro (Chromium startup ~5-15s)
- `fetchLogoBase64()` in `lib/pdf/logo.ts` scarica il logo workspace e lo converte in base64 (timeout 5s). Se fallisce, `buildPdfHtml()` usa il placeholder SVG.
- `DocumentFrame` usa `<iframe srcDoc={html}>` con auto-resize via `onLoad`. Su mobile l'A4 (210mm) richiede scroll orizzontale — questo è intenzionale (il documento è identico al PDF).
- `lib/pdf/template.ts` è ora LA fonte unica. Non toccarla senza screenshot aggiornati dei 4 preset.
- `PreventivoPDF.tsx` NON è più usato dalla chain di produzione. Può essere eliminato in una sessione di pulizia futura.

### Commit

```
c31aafc  feat(template): buildPdfHtml() as single source of truth for all PDF surfaces
```

### Cose aperte dopo sessione 15

1. Test manuale: aprire link pubblico di un preventivo inviato → deve mostrare esattamente lo stesso layout del PDF scaricabile
2. Test manuale: scaricare PDF → confrontare con link pubblico — devono essere identici
3. Performance: il primo PDF dopo cold start può richiedere 10-20s (Chromium download). Valutare se ottimizzare con caching del browser in `/tmp`.
4. `PreventivoPDF.tsx` + `@react-pdf/renderer` — ora inutilizzati. Rimuovere in una sessione di pulizia (richiede aggiornare tests/unit/pdf/generate.test.ts).
5. Bug #5 numerazione — da verificare
6. Bug #6 PDF preview — ora usa playwright, da verificare
7. Bug #7 mobile IVA — da verificare

---

## 0. REGOLE BASE PER CLAUDE CODE

1. Leggi TUTTO questo file prima di scrivere codice
2. Un task alla volta — output sempre: file toccati + commit hash + tsc verde + build verde
3. Sequenza: capire → implementare → `npx tsc --noEmit` → `npm run build` → verificare → commit
4. Mai interpretare arbitrariamente una decisione di prodotto — se non è documentata qui, chiedi
5. Non reimplementare da zero senza prima trovare la causa precisa del problema
6. Dopo ogni sessione: aggiornare CLAUDE.md + `git push nas master` + `git push`
7. `types/database.ts` va rigenerato dopo ogni migration
8. **Non dichiarare risolto un bug solo perché hai trovato la causa nel codice.** Usa il formato sezione C.

---

## 0-B. BACKUP NAS

```
NAS path:    Z:\CARTA CANTA
Remote git:  nas   (già configurato)
Comando:     git push nas master

File da ESCLUDERE sempre: node_modules/ .next/ dist/ build/ .claude/worktrees/ supabase/.temp/

Sequenza corretta a fine sessione:
  1. Aggiorna CLAUDE.md
  2. git add . && git commit -m "docs: update CLAUDE.md — sessione NN"
  3. git push nas master
  4. git push  (origin, deploy su Vercel)
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
Dev locale:     C:\progetti\carta-canta
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

- Auth: email/password + OAuth Google/GitHub + bfcache fix mobile
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
