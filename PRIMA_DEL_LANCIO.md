# ⚠️ PRIMA DEL LANCIO — leggere prima di dare l'app ai primi utenti reali

> Checklist delle cose da NON dimenticare **prima** che il primo artigiano vero
> inizi a caricare preventivi e fatture reali. Ogni voce qui è un "cancello":
> non lanciare senza averle chiuse. Aggiornata al 20 lug 2026.

---

## 🔴 BLOCCANTI — obbligatori prima del primo cliente reale

### 1. Backup del database (Supabase Pro)
**Stato:** ⏳ **DECISIONE ELI (29 lug 2026): upgrade POCO PRIMA del lancio sul mercato**
(non ora, per non pagare mesi di beta a vuoto). ⚠️ Resta il PRIMO passo del giorno
del lancio: finché siamo sul piano FREE **non ci sono backup automatici** — nessun
utente reale prima di questo upgrade. Verificato il 20 lug: il progetto è sul
**piano FREE di Supabase, che NON include backup automatici**.
- **Cosa fare:** dashboard Supabase → passare al **piano Pro (~25 $/mese)**.
  Attiva da solo il **backup giornaliero** (fino a 7 giorni) e il **Point-in-Time Recovery**.
- **Perché è bloccante:** l'app tiene i documenti fiscali dei clienti. Senza backup,
  un guasto al database = dati persi e non recuperabili. Inaccettabile con dati reali.
- **Una volta attivo:** provare UNA volta un restore su un progetto di test — un
  backup mai provato non è un backup.

---

## 🔐 SICUREZZA — dall'audit del 20 lug (5 revisori su tutta l'app)

Esito: **nessuna vulnerabilità critica o grave. Nessun bypass di login, nessuna
fuga di dati, nessun IDOR (i dati di un cliente non sono raggiungibili da un
altro).** Applicati subito i fix media/bassa (SVG logo bloccato, ricerche
indurite, open-redirect confirm chiuso, rate-limit sul PDF pubblico, avviso
Redis). Restano:

- [x] ~~**Verificare UPSTASH_REDIS su Vercel**~~ ✅ 20 lug: verificato sul progetto
      carta-canta — `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN` presenti
      (Sensitive). I rate-limit anti brute-force/anti-abuso sono attivi in produzione.
      Scope confermato da Eli: **Production + Preview**. Punto chiuso.
- [~] **Content-Security-Policy (CSP)** — ✅ 20 lug: aggiunta una **CSP "sicura"**
      (`next.config.ts`) che blocca i vettori a rischio-zero di rottura:
      `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors`
      ('none' globale, 'self' sulle route PDF). Verificata servita. 🔴 RESTA da fare
      (task dedicato con collaudo dal vivo su Turnstile/PostHog/Stripe): il **lockdown
      degli script inline** con nonce + `'strict-dynamic'` — oggi `script-src` è ancora
      permissivo (`'unsafe-inline'`) per non rompere i servizi terzi.
- [x] ~~Enumerazione utenti sul login~~ ✅ 20 lug: messaggio di login unificato in
      "Email o password non corretti" (non rivela più se un'email è registrata);
      rimossa la ricerca admin. La UI mostra comunque i link "password dimenticata" e
      "registrati" in modo generico.

## 🟡 DA VERIFICARE al lancio (non bloccanti ma importanti)

- **Stripe LIVE:** chiavi live su Vercel + prodotti/prezzi in modalità live +
  config Customer Portal anche in live (vedi CLAUDE.md §"CONFIG STRIPE DA FARE").
- **Cookie policy / Privacy / Termini:** campi in giallo compilati dopo l'OK
  dell'avvocato (contatto rimandato a settembre).
- **Dicitura "copia di cortesia"** sulle fatture PDF finché lo SdI non è live.
- **Quando lo SdI si accende in produzione:** aggiungere alla tabella dei
  fornitori dell'informativa privacy la riga **Openapi S.p.A. — trasmissione
  delle fatture al Sistema di Interscambio e conservazione a norma** (oggi
  c'è solo la riga della verifica P.IVA, corretta finché lo SdI è spento:
  nessun dato parte). Stesso momento del gate avvocato sui testi OpenAPI.
- **Piano di ritenzione dati / cancellazione** confermato con l'avvocato.

---

## 🟢 QUALITÀ / ACCESSIBILITÀ / PRESTAZIONI (dal confronto con la checklist «app pronta al lancio», 15 ago 2026)

Emersi confrontando l'app con lo standard di un SaaS pronto (ricerca web 15 ago).
Non tutti bloccano il lancio, ma vanno spuntati:

- [ ] **Stress / load test** (richiesta di Eli 15 ago): provare che l'app regga i
      primi picchi di traffico reale prima di aprire a utenti veri. Strumento tipo
      k6 / Artillery su login, creazione preventivo, pagina pubblica `/p/[token]`,
      route PDF. ⚠️ Da qui non è eseguibile (la rete verso il sito è bloccata):
      lo lancia Eli o si fa su un ambiente con accesso di rete.
- [~] **Accessibilità WCAG 2.2 AA** — audit axe fatto il 15 ago sulle pagine
      pubbliche: **login e signup ora puliti**, contrasto del grigio secondario
      sistemato in tutta l'app (`--cc-muted` #8a887f→#6f6d64), campo password con
      nome accessibile, titolo /signup corretto. **Residui minori**: 2 nodi di
      contrasto su `/` e `/prova` (colori diversi da --cc-muted) + i link del
      footer di `/prova` da rendere distinguibili (sottolineatura). Da rifare
      l'audit sulle pagine INTERNE (dietro login) prima del lancio.
- [ ] **Core Web Vitals sul sito VERO** (INP ≤200ms, LCP ≤2,5s, CLS <0,1):
      misurare con Lighthouse/PageSpeed sull'URL pubblico (da qui la rete è
      bloccata). CLS locale è 0; INP va misurato con interazione reale.
- [ ] **Status page pubblica** (opzionale ma consigliata): una pagina «stato del
      servizio» che l'utente guarda quando qualcosa non va (oggi c'è solo il
      monitor uptime interno). Es. una pagina statica o un servizio gratuito.
- [ ] **CSP stretta** (lockdown script inline con nonce + `strict-dynamic`):
      oggi la CSP «sicura» è attiva ma `script-src` resta permissivo per non
      rompere i servizi terzi. Vedi `SICUREZZA.md` §5. *(CSP = Content Security
      Policy: la regola che dice al browser da QUALI domini può caricare script,
      stili, immagini — così un eventuale codice iniettato non gira. «Stringerla»
      = ridurre quei domini al minimo.)*

## ✅ GIÀ FATTO (per riferimento)

- 🛰️ Monitoraggio uptime (UptimeRobot su cartacanta.app + email di avviso) — 20 lug
- 🔍 Google Search Console: proprietà verificata + sitemap inviata — 20 lug
  (⚠️ non rimuovere il record TXT su OVH)
- 🔐 Password account demo ruotata + incident GitGuardian chiusi — 20 lug
- 🩺 Sentry (error tracking) attivo — quando finisce la prova a pagamento scende
  da solo al piano gratuito Developer (nessuna azione, basta non fare "upgrade")
