# PROMPT CODE — IMPROVE: app installabile sul telefono (PWA, versione sicura senza service worker)

> Incolla in Claude Code. Autocontenuto. **Leggi prima `CLAUDE.md`.** Rispetta le regole CLAUDE.md (tsc + build verdi, formato risposta sez. C, aggiornare CLAUDE.md, commit conventional, push a fine task).
> Lavora SOLO su `master` in `C:\Users\Public\carta-canta` — niente worktree, niente branch `claude/*`.

## OBIETTIVO (vincolante)
Rendere Carta Canta **installabile sulla schermata Home** del telefono ("Aggiungi a schermata Home"), così l'artigiano apre l'app con un'icona e la usa a schermo intero come un'app nativa. Stack: Next.js 16 App Router.

**Regole assolute:**
- **NON** aggiungere un **service worker** in questo task. Niente caching delle pagine. (L'offline è una feature separata futura — `MOB-2` nel backlog.) Questo evita il problema "l'app mostra una versione vecchia" dopo i deploy.
- **NON** toccare la logica dell'app, le pagine o le route esistenti: solo aggiunte (manifest, icone, meta tag).
- Niente nuove dipendenze npm (no `next-pwa`).

## Cosa fare, esattamente

### 1. Web App Manifest (route metadata di Next)
Crea `app/manifest.ts` (Next.js metadata route → genera `/manifest.webmanifest`) con:
- `name`: "Carta Canta — Preventivi e Fatture"
- `short_name`: "Carta Canta"
- `description`: "Preventivi e fatture professionali in 60 secondi."
- `start_url`: "/dashboard"
- `display`: "standalone"
- `background_color`: "#ffffff"
- `theme_color`: usa il colore primario del brand (controlla in `app/globals.css`/tema; se incerto usa "#1a1a2e")
- `lang`: "it"
- `icons`: 192×192, 512×512, e una 512×512 `purpose: "maskable"` (vedi punto 2)

### 2. Icone dell'app
Crea le icone PNG necessarie e mettile in `public/`:
- `icon-192.png` (192×192), `icon-512.png` (512×512), `icon-maskable-512.png` (512×512, con padding di sicurezza ~10% per il maskable), `apple-touch-icon.png` (180×180).
- **Come generarle:** se esiste già un asset logo del brand nel repo, usalo; altrimenti **generale tu** con uno script Node una tantum (es. `sharp` se già presente tra le dipendenze, oppure produci un SVG e convertilo) — icona semplice: sfondo col colore del brand + monogramma "CC" o l'icona documento. **Sono placeholder sostituibili in seguito col logo definitivo** — segnalalo nel report. Lo script di generazione può restare nel repo in `scripts/` o essere eseguito e poi rimosso, a tua scelta; l'importante sono i PNG finali in `public/`.

### 3. Meta tag in `app/layout.tsx`
Nell'oggetto `metadata` (e/o `viewport`) aggiungi:
- `themeColor` (stesso del manifest).
- `appleWebApp`: `{ capable: true, title: 'Carta Canta', statusBarStyle: 'default' }`.
- il link all'`apple-touch-icon` (iOS non legge sempre il manifest per l'icona Home → serve `apple-touch-icon`).
- `manifest`: '/manifest.webmanifest' (se non già collegato automaticamente dalla route `app/manifest.ts`).
Non rimuovere metadata esistenti — solo aggiungere.

## Criteri di accettazione
1. Su **Android/Chrome** e **iOS/Safari**: "Aggiungi a schermata Home" funziona, l'icona mostrata è quella del brand (non uno screenshot della pagina), e aprendo l'app dall'icona si apre **a schermo intero** (standalone), senza la barra degli indirizzi del browser.
2. `/manifest.webmanifest` è servito correttamente e referenzia le icone esistenti (nessun 404 sulle icone).
3. **Nessun service worker** registrato; nessun cambiamento alla logica/pagine dell'app.
4. `npx tsc --noEmit` e `npm run build` verdi.

## Definition of Done
- Manifest + icone + meta tag aggiunti; le icone segnalate come placeholder sostituibili col logo reale.
- Test in formato sez. C di CLAUDE.md (come hai verificato il manifest e le icone; nota se non hai potuto provare l'installazione reale su dispositivo).
- CLAUDE.md aggiornato; commit `feat(pwa): app installabile (manifest + icone, senza service worker)`.
- A fine task: `git push` e conferma che `git log origin/master --oneline -1` mostra il nuovo commit.
