# MAPPA_APP — Carta Canta

> Mappa dell'app esistente: route, componenti, server action, API, lib, schema DB, pattern. Più una lista di **ottimizzazioni/incongruenze** prioritizzata.
> Serve a far sì che ogni nuova feature (vedi `SPEC_NUOVE_FEATURE.md`) **rispetti i pattern già presenti** invece di reinventarli.
> Generata leggendo il codice il 30 maggio 2026. **Da aggiornare quando si aggiungono route/tabelle/azioni.**
> ⚠️ Per ricerche affidabili nel codice usare sempre path assoluto `C:\Users\Public\carta-canta\...` (vedi nota worktree in CLAUDE.md). **NB: il progetto è stato spostato da `C:\progetti\carta-canta` a `C:\Users\Public\carta-canta` (giugno 2026).**

---

## 1. STACK & SCRIPT
- Next.js **16.2.3** (App Router, `--turbopack` in dev), React **19.2.4**, TypeScript strict.
- Supabase (PostgreSQL 16) via `@supabase/ssr`; Stripe 22; Resend 6; AssemblyAI 4; Upstash Redis; Tailwind v4 + shadcn/ui (radix-ui 1.4).
- Script: `npm run dev|build|start|lint|test (vitest)|test:e2e (playwright)`. Node ≥20.
- AI: `openai` + `@mistralai/mistralai` (chiavi vuote in prod). PDF deps presenti ma **non usate** (vedi §8): `@sparticuz/chromium`, `puppeteer-core`, `playwright-core`.

## 2. MAPPA ROUTE

### Area app autenticata — `app/(app)/` (layout: `layout.tsx` → `AppShell`)
| Route | Scopo |
|---|---|
| `dashboard` | KPI, RevenueChart, attività recente, PendingDocCard, banner quota/scadenza |
| `preventivi` | Lista (search, filtri, tab stato, sort) |
| `preventivi/nuovo` · `preventivi/[id]` | Creazione / dettaglio (timeline, PDF, invio) |
| `preventivi/scadenze` | Preventivi in scadenza |
| `fatture` · `fatture/nuovo` · `fatture/[id]` | Fatture (+ link a preventivo) |
| `clienti` · `clienti/nuovo` · `clienti/[id]` | Rubrica clienti |
| `catalogo` | Voci di catalogo + suggerimenti ATECO |
| `template` · `template/nuovo` · `template/[id]` · `template/default` | Template PDF (4 preset + custom + default) |
| `cestino` | Soft delete (recupero 15gg) |
| `impostazioni` | Tab: generale, fiscale, notifiche, piano |
| `abbonamento` | Pricing, quota free, switch billing |
| `referral` | Codice e statistiche referral |

### Area pubblica cliente — `app/p/[token]/`
`page.tsx` (documento via `DocumentFrame`), `grazie`, `rifiutato`, `scaduto`. Componenti: `AcceptModal`, `DeclineModal`, `ActionBar`, `TrackView`.

### Auth — `app/(auth)/` + `app/auth/`
`login`, `signup`, `reset-password(+/confirm)`, `verifica-email`. Route handler: `auth/callback` (PKCE), `auth/confirm` (recovery/email). Onboarding: `app/onboarding/`.

### API — `app/api/`
| Route | Metodo/Scopo |
|---|---|
| `documents/[id]/pdf` | GET — HTML print (`?preview=1` = no stampa) |
| `documents/[id]/send-email` | POST — invio email con link pubblico (no PDF allegato) |
| `p/[token]/pdf\|accept\|decline\|view` | Pagina pubblica: PDF, accetta, rifiuta, traccia visita |
| `preventivi/[id]/status` · `preventivi/[id]/converti-fattura` · `preventivi/export-csv` | Stato, conversione, export |
| `fatture/[id]/status` · `fatture/export-csv` | Stato fattura, export |
| `ai/extract` | POST — estrazione AI (rate limit in-memory, vedi §8) |
| `voice/transcribe` | POST — AssemblyAI |
| `cron/expire-documents` · `cron/referral` | Cron (CRON_SECRET) |
| `webhooks/stripe` | Webhook Stripe |

`proxy.ts` (middleware): `PUBLIC_PATHS` = `/ /login /signup /reset-password /reset-password/confirm /verifica-email`; `PUBLIC_PREFIXES` = `/p/ /api/ /auth/ /_next/ /favicon`.

## 3. SERVER ACTIONS (`lib/actions/`)
- **documents.ts** (1599 righe — il cuore): `allocateDocNumber`, `allocateInvoiceNumber`, `peekNextDocNumber`, `peekNextInvoiceNumber`, `createDocumentAction`, `updateDocumentAction`, `saveDraftAction`, `restoreToSentVersionAction`, `deleteDocumentAction`, `restoreDocumentAction`, `purgeDeletedDocumentAction`, `sendDocumentAction`, `registerManualSendAction`, `duplicateDocumentAction`, `searchDocumentsAction`, `createInvoiceAction`, `sendReminderAction`, `linkDocumentAction`.
- **clients.ts**: `createClientAction`, `updateClientAction`, `deleteClientAction`, `preloadClientsAction`, `searchClientsAction`.
- **templates.ts**: `createTemplateAction`, `updateTemplateAction`, `deleteTemplateAction`, `selectPresetAction`, `clearDefaultTemplateAction`, `saveDefaultSettingsAction`, `setDefaultTemplateAction`.
- **workspace.ts**: `getWorkspace`, `updateWorkspaceData`, `uploadLogo`, `removeLogo`, `updateWorkspaceFiscal`, `updateNotificationPrefs`, `ensureWorkspace`, `inviteMember`. ← **qui andrà `markOnboardingTourDone()` (tutorial)**
- **subscription.ts**: `createCheckoutSessionAction`, `createPortalSessionAction`, `switchToAnnualAction`.
- **referral.ts**: `getMyReferralCode`, `getMyReferralStats`.
- **team.ts**: `getWorkspaceMembers`, `inviteMemberAction`, `removeMemberAction`, `updateMemberRoleAction` (UI Team nascosta).

## 4. LIB (non-actions)
- **fiscal/calcoli.ts** ⛔ INTOCCABILE senza test: `roundFiscale`, `calcolaDocumento`, `VAT_RATES`, `FORFETTARIO_LEGAL_NOTICE`.
- **pdf/template.ts** ⛔ fonte unica layout PDF (`buildPdfHtml`, 867 righe, 4 preset). **pdf/logo.ts**: `preparePrintHtml`, `fetchLogoBase64`.
- **email/send.ts**: `sendEmail` (HTML + plain-text, no emoji).
- **stripe/**: `plans.ts` (PLAN_FEATURES, PLAN_PRICING, gating), `stripe.ts` (client, customer, priceIds).
- **ai/**: `extract.ts` (OpenAI), `fallback.ts` (Mistral), `pdf-to-image.ts`, `types.ts` (schema Zod estrazione).
- **supabase/**: `server.ts`, `client.ts`, `admin.ts` (service role).
- **free-trial.ts** (`FREE_DOC_LIMIT=8`, `checkFreeBlock`), **auth-rate-limit.ts** (Upstash), **rate-limit.ts** (in-memory fallback), **redis.ts**.
- **data/**: `comuni.ts` (7931 righe!), `ateco.ts`. **catalog/ateco-presets.ts**. **constants/units.ts**. **utils/** (`formatCurrency`, `formatDate`, `formatDocNumber`, `slugify`, `cn`).

## 5. COMPONENTI
- **ui/** (shadcn/Radix): button, input, dialog, sheet, dropdown-menu, table, tabs, select, popover, command, tooltip, badge, switch, checkbox, ecc. → **riusare sempre questi** per coerenza e accessibilità.
- **shared/**: `ClientAutocomplete`, `AtecoMultiSelect`, `CatalogPicker`(in preventivi), `VoiceInput`, `PasswordStrength`, `QuickCreateClientDialog`, `SearchBar`, `OAuthButtons`, `ZoomControls`(vedi §8).
- **dashboard/**: `KpiCard`, `RevenueChart` (recharts — riusare per il grafico Bilancio #1).
- **public/**: `DocumentFrame` (iframe doc per `/p/[token]`).
- **email/**: `PreventivoEmail`.
- Per-route in `_components/` (es. `PreventivoForm` 950 righe, `FatturaForm` 483, `VociTable`, `DocumentTimeline`, `StatusBadge`, `PdfActions`, ecc.).

## 6. DATABASE
**Tabelle:** `workspaces`, `clients`, `documents`, `document_items`, `document_views`, `document_log`, `templates`, `catalog_items`, `invoice_sequences`, `voice_usage`, `referral_codes`, `referral_uses`, `referral_rewards`, `workspace_members`, `rate_limit_events`.
**RPC/funzioni:** `next_invoice_number`, `convert_preventivo_to_fattura`, `expire_overdue_documents`, `my_workspace_ids`, `is_workspace_member`, `get_or_create_referral_code`, `generate_referral_code`, `update_updated_at_column` + trigger (`trg_auto_create_referral_code`, `trg_set_free_trial_expires_at`).
**Migration:** 001–034 applicate (vedi CLAUDE.md). Prossimo numero libero: **035**.
**RLS:** pattern standard `workspace_id IN (SELECT my_workspace_ids())`. **Usare lo stesso su ogni nuova tabella.**

## 7. PATTERN DA RISPETTARE (per le nuove feature)
1. **Recupero workspace**: owner (`owner_id = user.id`) con fallback a membro (`workspace_members`). Ripetuto in `layout.tsx`, `impostazioni/page.tsx` e altre pagine → **vedi OTT-1 (estrarre helper)**.
2. **Server action** → ritorna `ActionResult` (`{success}` / `{error}`), `revalidatePath`, validazione **Zod** (spesso `softValidate` leniente per i form). `intent` come `z.string().optional()` (non enum — un enum rompeva il salvataggio bozza).
3. **Feature gating piano**: `canUsePlanFeature(plan, feature)` / `isPaidPlan(plan)` da `lib/stripe/plans.ts`. **Usare questo per gating Pro (Bilancio, Note AI, pagamenti carta).**
4. **Soft delete**: `deleted_at`; ogni query lista filtra `deleted_at IS NULL`.
5. **PDF/documenti**: solo `buildPdfHtml`; fallback template a 4 livelli (snapshot → default → qualsiasi → hardcoded).
6. **Email**: solo `sendEmail` (no emoji nel subject/body; replyTo = owner).
7. **Numerazione**: `{NNN}/{YYYY}`, `formatDocNumber(num, 'fattura')` antepone "Fatt.".
8. **Mobile-first** sempre; `<PopoverContent>` Radix per evitare clipping da Card overflow.
9. **Accessibilità**: usare i componenti `ui/` (già accessibili), `aria-label` sugli icon-only.

---

## 8. OTTIMIZZAZIONI & INCONGRUENZE (prioritizzate)

> Lista da affrontare a parte rispetto alle feature, oppure cogliendo l'occasione quando si tocca l'area. Severità: 🔴 alta · 🟡 media · 🟢 bassa.

**OTT-1 🟡 — DRY sul recupero workspace.** Lo stesso blocco "owner → fallback membro" è duplicato in più pagine (`layout.tsx`, `impostazioni/page.tsx`, ...). Estrarre `getWorkspaceForUser(supabase, user)` in `lib/actions/workspace.ts` e usarlo ovunque. **Le nuove pagine (Bilancio, Note) lo richiederanno: farlo prima conviene.**

**OTT-2 🔴 — Dipendenze PDF morte da rimuovere.** `@sparticuz/chromium`, `puppeteer-core`, `playwright-core` sono in `package.json` ma la generazione PDF usa il browser-print via HTML (CLAUDE.md sessione 16). Sono ~centinaia di MB inutili: rallentano install/build e aumentano la superficie. **Verificare che non siano importati da nessuna parte e rimuoverli** (+ `serverExternalPackages` relativo in `next.config.ts`).

**OTT-3 🟡 — `lib/actions/documents.ts` è un monolite (1599 righe).** Le feature in arrivo (#2 pagamenti, #9 recensioni, #8 acconti) lo gonfieranno ancora. Valutare split per dominio: `documents/create.ts`, `documents/draft.ts`, `documents/invoice.ts`, `documents/reminder.ts`, `documents/numbering.ts`. Migliora manutenibilità e riduce errori di Code su file enormi.

**OTT-4 🟡 — `lib/data/comuni.ts` (7931 righe) nel bundle.** Assicurarsi che sia importato **solo lato server** (mai in un client component) per non gonfiare il bundle JS del browser. Se serve lato client, esporre una API/route di lookup. Rilevante anche per il geocoding del marketplace (#5).

**OTT-5 🟡 — Rate limit AI in-memory.** `app/api/ai/extract` usa rate limit in-memory (TODO nel codice): su Vercel (lambda multiple) **non funziona** in modo affidabile. Spostare su Upstash (già usato da `auth-rate-limit.ts`). Da fare prima di attivare l'AI (Note #4 / AI Import).

**OTT-6 🟢 — Possibile duplicazione `PreventivoForm` (950) vs `FatturaForm` (483).** Verificare quanto codice voci/calcoli è duplicato; estrarre una base comune (es. il blocco `VociTable` + totali fiscali). Da valutare quando si tocca una delle due (es. per #10 opzioni a livelli, che impatta `PreventivoForm`).

**OTT-7 🟢 — Codice/asset potenzialmente non usati.** `ZoomControls.tsx` risultava non più usato direttamente (CLAUDE.md sessione 17); `team.tsx`/`lib/actions/team.ts` sono per il piano Team nascosto. Tenere mappato; rimuovere solo se confermato morto (Team verrà riattivato).

**OTT-8 🟢 — `any` residui.** Pochi ma presenti, concentrati in `preventivi/[id]/page.tsx` (6) e `documents.ts` (5), spesso per il tipo `template`/`Json` di Supabase. Tipizzare `PdfData.template` ed eliminare i cast dove possibile.

**OTT-9 🟢 — Accessibilità pagina pubblica.** `/p/[token]` è usata dal pubblico: verificare contrasto, dimensioni testo, `aria` (vedi B.12 di SPEC_NUOVE_FEATURE.md). A costo quasi nullo.

**OTT-10 🟡 — Osservabilità assente.** PostHog/Sentry/Flagsmith presenti come dipendenze ma non configurati. Senza error tracking è difficile accorgersi di regressioni in prod (es. i 35 test rotti passati inosservati, CLAUDE.md sessione 25). Valutare almeno Sentry.

### Come usare questa lista
Non serve un "big bang". Regola pratica: **quando una nuova feature tocca un'area con un OTT correlato, si coglie l'occasione** (es. implementando il Bilancio si fa OTT-1; attivando l'AI si fa OTT-5; toccando `PreventivoForm` per le opzioni si valuta OTT-6). OTT-2 (rimozione deps PDF morte) è invece un intervento isolato e a basso rischio: si può fare subito.

---

## 9. MANUTENZIONE DI QUESTO FILE
Aggiornare quando si aggiunge/rimuove: una route, una tabella/migration, una server action, un pattern condiviso, o si chiude un OTT. Tenerlo allineato a `CLAUDE.md` (che resta la memoria di sessione) e a `SPEC_NUOVE_FEATURE.md` (che resta il piano feature).
