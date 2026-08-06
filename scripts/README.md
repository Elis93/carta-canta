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
- **Password:** quella impostata in `DEMO_PASSWORD` nel tuo `.env.local`
  (⚠️ MAI nel repository: è pubblico — segnalazione GitGuardian 15 lug 2026.
  Rilanciando lo script con una password nuova, quella vecchia viene ruotata.)
- **Piano:** `pro` (così la demo mostra tutte le funzioni)

Per cambiare email o piano, modifica le costanti in cima a
`scripts/seed-demo.ts` (`DEMO_EMAIL`, `DEMO_PLAN`).

### Note importanti
- ⚠️ Lo script scrive sul **database di produzione** (crea un utente reale con
  email già confermata, così i revisori entrano subito senza confermare nulla).
- È **idempotente**: rilanciandolo azzera i dati del demo e li ricrea puliti —
  utile perché revisori e demo modificano i dati. Non tocca gli altri account.

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

Verifica anche gli **header di sicurezza** su ogni risposta (28 controlli in
tutto): la regressione della geolocalizzazione — un `Permissions-Policy`
sbagliato che spegneva "Vicino a me" in silenzio — sarebbe stata vista subito.

Esce con codice 1 al primo problema. Da lanciare prima di un rilascio
importante: il crash della pagina pubblica del 6 lug 2026 sarebbe stato
intercettato da questo controllo.

---

## security-check.mjs — controllo di sicurezza sul sito VERO

```bash
npm run security:check
```

A differenza dello smoke test, questo **non** avvia niente in locale: interroga
`cartacanta.app` in produzione usando **solo la chiave pubblica** (la stessa che
ha chiunque apra il sito), e controlla tre cose:

- gli **header di sicurezza** effettivamente serviti;
- **ogni tabella del database**, una per una, chiesta con la sola chiave
  pubblica: se ne torna anche una sola riga, quella tabella ha l'RLS
  dimenticata. ⚠️ Su Supabase una tabella protetta risponde **200 con lista
  vuota**, non 401: è il comportamento corretto, non un errore;
- l'**archivio delle foto**, che non deve essere né sfogliabile (`/object/list`)
  né firmabile (`/object/sign`) da un anonimo.

Legge le chiavi da `.env.local`. Da lanciare **dopo ogni deploy importante** e
una volta al mese come manutenzione ordinaria (vedi `SICUREZZA.md`).
Il 5 agosto 2026 è servito a scoprire che una policy vecchia lasciava leggere a
chiunque le foto di cantiere di tutti gli artigiani.
