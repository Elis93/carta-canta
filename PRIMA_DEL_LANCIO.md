# ⚠️ PRIMA DEL LANCIO — leggere prima di dare l'app ai primi utenti reali

> Checklist delle cose da NON dimenticare **prima** che il primo artigiano vero
> inizi a caricare preventivi e fatture reali. Ogni voce qui è un "cancello":
> non lanciare senza averle chiuse. Aggiornata al 20 lug 2026.

---

## 🔴 BLOCCANTI — obbligatori prima del primo cliente reale

### 1. Backup del database (Supabase Pro)
**Stato:** ❌ DA FARE al lancio. Verificato il 20 lug: il progetto è sul **piano FREE
di Supabase, che NON include backup automatici**.
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
- **Piano di ritenzione dati / cancellazione** confermato con l'avvocato.

---

## ✅ GIÀ FATTO (per riferimento)

- 🛰️ Monitoraggio uptime (UptimeRobot su cartacanta.app + email di avviso) — 20 lug
- 🔍 Google Search Console: proprietà verificata + sitemap inviata — 20 lug
  (⚠️ non rimuovere il record TXT su OVH)
- 🔐 Password account demo ruotata + incident GitGuardian chiusi — 20 lug
- 🩺 Sentry (error tracking) attivo — quando finisce la prova a pagamento scende
  da solo al piano gratuito Developer (nessuna azione, basta non fare "upgrade")
