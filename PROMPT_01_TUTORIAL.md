# PROMPT PER CLAUDE CODE — Feature: Tutorial primo accesso

> Incolla tutto questo blocco in Claude Code. È autocontenuto.
> Obiettivo: aggiungere un tour guidato al primo accesso, semplice e skippabile, per un target poco avvezzo al software. Mobile-first.

---

## CONTESTO (leggi prima di scrivere codice)

Sei nel progetto **Carta Canta** (Next.js 16 App Router, React 19, Supabase, Tailwind v4, shadcn/ui). **Leggi `CLAUDE.md` per intero** prima di iniziare: rispetta tutte le regole lì dentro (sezioni B e C in particolare). Regole non negoziabili che ti ricordo:
- `npx tsc --noEmit` + `npm run build` devono essere **verdi** prima del commit.
- Ogni migration SQL va **incollata all'utente a fine messaggio** in un blocco "⚠️ Migration da applicare" (regola B.7).
- Dopo la migration, **rigenera `types/database.ts`** col comando in CLAUDE.md (sezione 18).
- Aggiorna `CLAUDE.md` a fine sessione (formato sezione C).
- Mobile-first: deve funzionare perfettamente su 360px.
- Commit conventional: `feat(onboarding): tutorial primo accesso con Driver.js`.

**Non reimplementare nulla di esistente. Aggiungi solo ciò che serve. Una feature sola: il tutorial.**

---

## COSA DEVE FARE LA FEATURE

1. Al **primo accesso** all'area app (dopo l'onboarding), parte automaticamente un **tour guidato di 5 step** sulla pagina `/dashboard`.
2. Il tour è **skippabile** in qualsiasi momento (X o "Salta"), ed è **una sola volta**: una volta completato o saltato, non riparte più da solo.
3. L'utente può **rivederlo** quando vuole da **Impostazioni → Generale** con un pulsante "Rivedi il tutorial".
4. Deve essere **semplice e rassicurante** nei testi (target: artigiani poco avvezzi al software). Niente gergo tecnico.

### Libreria da usare
**`driver.js` (v1.4.0, licenza MIT).** È JavaScript vanilla, framework-agnostic. NON usare wrapper React di terze parti. Va inizializzata **dentro un `useEffect` in un client component** (mai lato server). Installa con `npm i driver.js`.

### I 5 step del tour (testi esatti da usare)
1. **Benvenuto** (popover centrato, senza elemento evidenziato):
   - Titolo: `Benvenuto in Carta Canta 👋`
   - Testo: `Ti mostro in 30 secondi come fare il tuo primo preventivo. Puoi saltare quando vuoi.`
2. **Pulsante "Nuovo preventivo"** (evidenzia il bottone nell'header):
   - Titolo: `Crea un preventivo`
   - Testo: `Tutto parte da qui. Scegli il cliente, aggiungi le voci (anche dettando a voce) e in un minuto è pronto.`
3. **Menu di navigazione** (responsive, vedi sotto):
   - Titolo: `Trova tutto da qui`
   - Testo: `Da questo menu raggiungi preventivi, clienti, fatture e catalogo.`
4. **Menu account** (evidenzia l'avatar in alto a destra):
   - Titolo: `Il tuo account`
   - Testo: `Qui trovi Impostazioni e Abbonamento. Da Impostazioni puoi rivedere questo tutorial quando vuoi.`
5. **Fine** (popover centrato):
   - Titolo: `Tutto qui!`
   - Testo: `Sei pronto. Crea ora il tuo primo preventivo — se ti serve, il tutorial è sempre in Impostazioni.`
   - Pulsante finale: `Inizia`

### Testi dei pulsanti del tour (in italiano)
- Avanti → `Avanti`
- Indietro → `Indietro`
- Skip/chiudi → `Salta`
- Ultimo step → `Inizia`

---

## FILE DA CREARE / MODIFICARE (punti esatti)

### 1. NUOVO — `app/(app)/_components/OnboardingTour.tsx`
Client component (`'use client'`). Props: `{ run: boolean }`.
- Importa `driver` e lo stile: `import { driver } from 'driver.js'` + `import 'driver.js/dist/driver.css'`.
- Usa `usePathname()` e `useSearchParams()` da `next/navigation`.
- Logica di avvio dentro `useEffect`:
  - Avvia il tour **solo se** siamo su `/dashboard` **e** (`run === true` **oppure** `searchParams.get('tour') === '1'`).
  - Usa un piccolo `setTimeout` (~300ms) prima di `driver().drive()` per essere certo che gli elementi target siano montati.
  - Esegui una sola volta per mount (usa un `ref` booleano per non riavviare su re-render).
- **Step 3 responsivo**: calcola `const isDesktop = window.matchMedia('(min-width: 768px)').matches`. Se desktop, l'elemento dello step 3 è `[data-tour="tour-nav-desktop"]`; se mobile, è `[data-tour="tour-menu-mobile"]`. (Sul mobile la sidebar è dentro uno Sheet chiuso: NON puntare alla sidebar desktop su mobile, punta all'hamburger.)
- `onDestroyed` / callback di fine e di skip → chiama la server action `markOnboardingTourDone()` (vedi sotto), **ma solo se** il tour è partito per `run===true` (primo accesso). Se è partito da `?tour=1` (rivisualizzazione manuale) **non** serve riscrivere il flag (è già `true`).
- Configurazione driver.js: `showProgress: true`, `allowClose: true`, label pulsanti come sopra (`nextBtnText`, `prevBtnText`, `doneBtnText`, e testo skip via `progressText`/opzioni disponibili nella v1.4.0).

### 2. MODIFICA — `app/(app)/layout.tsx`
- Nella query workspace (owner **e** membro), aggiungi `onboarding_tour_done` alla `select(...)` (entrambe le query, owner e membro).
- Passa a `<AppShell>` una nuova prop `tourDone={workspace.onboarding_tour_done ?? true}`.
  - Nota: il fallback `?? true` evita di mostrare il tour se per qualunque motivo il campo è null.

### 3. MODIFICA — `app/(app)/_components/AppShell.tsx`
- Aggiungi `tourDone: boolean` all'interfaccia `AppShellProps` e ai parametri della funzione.
- Aggiungi gli attributi `data-tour` ai 3 elementi (NON cambiare classi/stili, aggiungi solo l'attributo):
  - Il bottone **"Nuovo preventivo"** (il `<Button asChild>` con `<Link href="/preventivi/nuovo">` nell'header destra) → `data-tour="tour-nuovo-preventivo"`.
  - Il bottone **hamburger mobile** nell'header (quello con `aria-label="Apri menu"`) → `data-tour="tour-menu-mobile"`.
  - La **sidebar desktop** `<aside className="hidden md:flex ...">` → `data-tour="tour-nav-desktop"`.
  - Il trigger del **menu account** (il `<Button ... aria-label="Menu account">` dentro `UserMenu`) → `data-tour="tour-account"`.
- In fondo al JSX di ritorno (dentro il `<div className="flex min-h-screen ...">`), monta `<OnboardingTour run={!tourDone} />`. Import in cima al file.

### 4. MODIFICA — `lib/actions/workspace.ts`
- Aggiungi una server action `markOnboardingTourDone()`:
  - `'use server'` già presente nel file.
  - Prende l'utente con `createClient()` server, fa `update` su `workspaces` settando `onboarding_tour_done = true` dove `owner_id = user.id`.
  - Gestisci l'errore in modo silenzioso (non bloccare l'utente): se fallisce, non lanciare — è UX, non un'operazione critica.

### 5. MODIFICA — `app/(app)/impostazioni/tabs/generali.tsx`
- Aggiungi una riga/sezione con un pulsante **"Rivedi il tutorial"** che porta a `/dashboard?tour=1` (usa un `<Link>` o `router.push`). Testo di aiuto sotto: `Rivedi la guida rapida alle funzioni principali.`
- Mantieni lo stile coerente con il resto del tab (shadcn `Button`, `variant="outline"`).

---

## GESTIONE DATABASE

Serve **una migration** (nuovo file `supabase/migrations/035_onboarding_tour.sql`):

```sql
ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS onboarding_tour_done BOOLEAN NOT NULL DEFAULT false;

-- Gli utenti ESISTENTI hanno già usato l'app: non mostrare loro il tutorial in modo retroattivo.
UPDATE workspaces SET onboarding_tour_done = true;
```

Dopo aver applicato la migration, **rigenera i tipi**:
```bash
npx supabase gen types typescript --project-id ivbzuhgwszkdnlsybsao > types/database.ts
```

---

## FUORI SCOPO (NON fare — teniamo la cosa semplice)
- Niente tour multi-pagina o step che richiedono di navigare tra route diverse.
- Niente apertura automatica dello Sheet mobile durante il tour (rischio di bug): lo step 3 punta all'hamburger su mobile, non alle voci interne.
- Niente libreria di analytics, niente A/B test, niente checklist di onboarding.
- Niente modifica all'onboarding multi-step esistente (`/onboarding`).

---

## CRITERI DI ACCETTAZIONE (verifica end-to-end, non solo "compila")
1. **Nuovo utente** (workspace con `onboarding_tour_done = false`): al primo arrivo su `/dashboard` parte il tour automaticamente con i 5 step.
2. Completando il tour (o saltandolo), ricaricando `/dashboard` **non riparte**.
3. **Desktop (≥768px)**: lo step 3 evidenzia la sidebar sinistra. **Mobile (360px)**: lo step 3 evidenzia l'hamburger. Verifica entrambi (puoi simulare il viewport).
4. Da **Impostazioni → Generale**, "Rivedi il tutorial" porta su `/dashboard?tour=1` e il tour riparte anche se già completato.
5. Gli elementi evidenziati sono quelli giusti su entrambi i viewport; i popover non escono dallo schermo su 360px.
6. `npx tsc --noEmit` verde, `npm run build` verde.

### Come testare
- Build + type check verdi (obbligatorio).
- Test manuale del flusso nei due viewport (descrivi cosa hai verificato e come, secondo il formato C di CLAUDE.md). Se possibile, screenshot dei due casi.
- Per ri-testare il "primo accesso" senza creare un nuovo account: esegui `UPDATE workspaces SET onboarding_tour_done = false WHERE owner_id = '<tuo-id>';` sul DB di sviluppo, poi ricarica `/dashboard`.

## DEFINITION OF DONE
- [ ] Migration 035 creata e **incollata all'utente** a fine messaggio (blocco "⚠️ Migration da applicare").
- [ ] `types/database.ts` rigenerato.
- [ ] `OnboardingTour.tsx` creato; `AppShell`, `layout`, `workspace.ts`, `generali.tsx` modificati come sopra.
- [ ] tsc + build verdi.
- [ ] Test manuale nei due viewport descritto.
- [ ] `CLAUDE.md` aggiornato (nuova sessione, formato C: cosa fatto, file toccati, migration, test, esito).
- [ ] Commit `feat(onboarding): tutorial primo accesso con Driver.js` + push secondo la procedura NAS (sezione 0-B di CLAUDE.md).

---

## OUTPUT CHE MI ASPETTO DA TE (Code)
Rispondi nel formato della **sezione C di CLAUDE.md**: problema/obiettivo, cosa implementato, file toccati con motivo, migration (sì, con SQL), test eseguiti e come, esito finale. E in fondo il blocco "⚠️ Migration da applicare".
