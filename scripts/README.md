# Script di manutenzione

## `seed-demo.ts` — Account dimostrativo

Crea (o **ripristina**) un account demo con dati realistici: un idraulico
(`Idraulica Bianchi`) con clienti, catalogo, 5 documenti (1 fattura pagata,
1 preventivo accettato e firmato, 1 inviato, 1 scaduto, 1 bozza) e alcune
spese per il Bilancio.

### A cosa serve
- **Play Store**: i revisori di Google devono poter **entrare e provare** l'app.
  In fase di pubblicazione va indicato un account demo (email + password).
- **Demo di vendita / video**: mostrare l'app piena invece che vuota.

### Come lanciarlo
Dal computer, nella cartella del progetto:

```bash
npm run seed:demo
```

(equivale a `npx tsx scripts/seed-demo.ts`)

Le variabili `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` vengono
lette in automatico da `.env.local` (o `.env`).

### Credenziali (di default)
- **Email:** `demo@cartacanta.app`
- **Password:** `CartaCanta-Demo-2026`
- **Piano:** `pro` (così la demo mostra tutte le funzioni)

Per cambiarle, modifica le costanti in cima a `scripts/seed-demo.ts`
(`DEMO_EMAIL`, `DEMO_PASSWORD`, `DEMO_PLAN`).

### Note importanti
- ⚠️ Lo script scrive sul **database di produzione** (crea un utente reale con
  email già confermata, così i revisori entrano subito senza confermare nulla).
- È **idempotente**: rilanciandolo azzera i dati del demo e li ricrea puliti —
  utile perché revisori e demo modificano i dati. Non tocca gli altri account.
- Non condividere l'output del comando: contiene le credenziali.

---

## smoke-public.mjs — smoke test delle pagine pubbliche

```bash
npm run build && npm run smoke:public
```

Avvia il build di produzione in locale con credenziali Supabase FINTE
(nessun contatto col database) e verifica in ~10 secondi che:
- le pagine pubbliche (/, /prova, /login, /signup, legali) rispondano 200
  col contenuto giusto;
- i file della PWA (manifest, sw.js, offline.html, opengraph-image) siano
  raggiungibili senza login;
- le route protette (/dashboard, /preventivi, …) reindirizzino a /login.

Esce con codice 1 al primo problema. Da lanciare prima di un rilascio
importante: il crash della pagina pubblica del 6 lug 2026 sarebbe stato
intercettato da questo controllo.
