# Punti aperti — Sicurezza e GDPR di Carta Canta

> Lista viva delle cose da fare. Legenda stato: ✅ fatto · 🔄 in corso · ⬜ da fare
> Priorità: 🔴 alta · 🟠 media · 🟢 bassa
> Aggiornare man mano. Ultimo aggiornamento: **14 giugno 2026**.

## A) Sicurezza tecnica

| Stato | Pri. | Cosa | Chi | Note |
|---|---|---|---|---|
| ✅ | 🔴 | Migration 035 — chiusa fuga dati tra workspace | Eli | Applicata su Supabase il 14 giu 2026 |
| ✅ | 🟠 | Migration 036 — ristrette le policy di scrittura sui loghi | Eli | Applicata su Supabase il 14 giu 2026 |
| ✅ | 🔴 | Attivare la **2FA** su GitHub, Vercel, Stripe (Supabase coperto via login GitHub) | Eli | Fatto 14 giu 2026 — ⚠️ salvare i codici di recupero GitHub |
| ⬜ | 🟠 | Testare il **ripristino** di un backup Supabase | Eli | Avere i backup non basta: provarne uno |
| ⬜ | 🟢 | Controllo periodico: la `service_role` key non deve mai finire lato client | Eli/Claude | Già rispettato oggi (solo in `lib/supabase/admin.ts`) |
| ⬜ | 🟠 | DMARC OVH: passare da `p=none` a `p=quarantine` | Eli | Già pianificato nel CLAUDE.md (intorno al 15 giu) |

## B) Conformità GDPR (documenti)

| Stato | Pri. | Cosa | Chi | Note |
|---|---|---|---|---|
| ✅ | — | Bozze documenti GDPR create | Claude | informativa, registro, breach, nomina, checklist DPA |
| ⬜ | 🔴 | Compilare i `[PLACEHOLDER]` con i dati della tua azienda | Eli | ragione sociale, P.IVA, sede, email privacy |
| ⬜ | 🔴 | Far **validare i documenti da un consulente privacy** | Eli | unica cosa non delegabile: firmi tu come titolare |
| ⬜ | 🔴 | Pubblicare l'informativa su una pagina **/privacy** nell'app | Eli/Claude | Claude può creare la pagina quando il testo è pronto |
| ⬜ | 🔴 | Inserire la **nomina a responsabile** nei Termini di Servizio | Eli | testo in `nomina-responsabile-utenti.md` |
| ⬜ | 🟠 | Accettare e archiviare i **DPA dei fornitori** | Eli | seguire `checklist-dpa-fornitori.md` |
| ⬜ | 🟠 | Creare cartella `gdpr/dpa-firmati/` e salvarci i PDF dei DPA | Eli | prova documentale |
| ✅ | 🟠 | Footer con link Privacy/Termini; accettazione in registrazione | Claude | Footer fatto; il form ha già "Registrandoti accetti…" con i link |
| ⬜ | 🟢 | Definire i tempi di conservazione esatti (campi `[X]` nei documenti) | Eli + consulente | |

## D) Cookie e tracciamento (PostHog)

| Stato | Pri. | Cosa | Chi | Note |
|---|---|---|---|---|
| ✅ | — | Audit cookie: nessun tracciamento attivo, solo cookie tecnici Supabase | Claude | Oggi NON serve banner cookie — vedi `audit-cookie-tracciamento.md` |
| ⬜ | 🟠 | **PostHog più avanti** — attivarlo SOLO con banner di consenso preventivo | Eli/Claude | Seguire la checklist in `reminder-attivazione-posthog.md` PRIMA di accenderlo (consenso opt-in, hosting UE, DPA, no dati clienti negli eventi) |
| ⬜ | 🟢 | In alternativa: rimuovere `posthog-js` se non si userà | Eli/Claude | pulizia dipendenze |

## Prossimo passo consigliato (ordine)

1. ⚠️ **Finire il recupero dei 5 file corrotti** (vedi sotto) — il progetto non compila finché non è fatto.
2. ~~2FA~~ ✅ fatto.
3. **Compilare i `[PLACEHOLDER]`** nei documenti e nelle pagine con i dati della tua azienda.
4. **Prenotare un consulente privacy** e portargli i documenti già pronti (`domande-per-consulente.md`).
5. Dopo l'ok del consulente: pubblicare `/privacy`, mettere i DPA in regola.
6. **Più avanti:** attivare PostHog seguendo `reminder-attivazione-posthog.md`.

## C) Lavori avviati (pagine legali)

| Stato | Pri. | Cosa | Note |
|---|---|---|---|
| 🔄 | 🔴 | Pagine `/privacy` e `/termini` create (codice) | `app/(legal)/` — verifica build BLOCCATA dai file corrotti (vedi sotto) |
| ✅ | — | Link Privacy/Termini nel footer della landing | `app/page.tsx` |
| ✅ | — | `/privacy` e `/termini` resi pubblici nel middleware | `proxy.ts` |
| ⬜ | 🔴 | Compilare i `[PLACEHOLDER]` nelle pagine prima del deploy | evidenziati in giallo nel codice |
| ⬜ | 🔴 | NON pubblicare in produzione finché testo non finale + ok consulente | |

## ⚠️ File corrotti nel progetto — recupero IN CORSO (14 giu 2026)

Alcuni file del repo contengono byte nulli (contenuto azzerato). Blocca compilazione e deploy.
**Le versioni su git (HEAD) sono pulite → recupero senza perdite.**

Stato ~ore 12:30: Code ne ha recuperato 1 (`preventivi/page.tsx`). **Ancora corrotti (5):**
`app/(app)/_components/AppShell.tsx`, `app/(app)/clienti/page.tsx`,
`app/(app)/preventivi/_components/VociTable.tsx`,
`app/(app)/preventivi/_components/FiscalSummary.tsx`, `DECISIONI_E_FEEDBACK.md`.

Recupero (sul COMPUTER di Eli, NON dal sandbox): chiudere l'editor →
`del .git\index.lock` → `git restore -- <i 5 file>`.

⚠️ Causa probabile: due strumenti (chat + Code) sullo stesso repo insieme, e/o comandi git dal
sandbox che lasciano `.git/index.lock` appesi. **Regola: git solo sul computer di Eli, uno
strumento alla volta.**

---

### Storico modifiche
- **14 giu 2026** — Creato il documento. Applicate migration 035 e 036.
- **14 giu 2026** — Create pagine /privacy e /termini (codice). Rilevati 6 file corrotti nel repo (recuperabili da git).
- **14 giu 2026** — 2FA completata. Audit cookie (nessun tracker attivo, niente banner per ora). Aggiunto reminder PostHog (`reminder-attivazione-posthog.md`). Recupero file: 1/6 fatto, 5 ancora da recuperare.
