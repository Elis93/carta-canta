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

- [ ] **⚠️ Verificare che UPSTASH_REDIS sia configurato su Vercel in PRODUZIONE**
      (MEDIA — segnalato da 2 revisori). Senza Redis i rate-limit (anti brute-force
      login + anti-abuso endpoint pubblici) degradano al contatore in-memory
      per-istanza = protezione debole. Ora c'è un log d'errore se manca in prod →
      controlla i log Vercel dopo il deploy. Le chiavi sono in `.env` §5.
- [ ] **Content-Security-Policy (CSP)** — header di sicurezza avanzato mancante
      (MEDIA, difesa in profondità anti-XSS). Va fatto come task dedicato (serve
      un nonce per gli script inline di Next + collaudo, altrimenti rompe l'app).
      NON urgente perché React già escapa e non c'è HTML utente non filtrato.
- [ ] **Decisione prodotto — enumerazione utenti sul login**: oggi il login dice
      "nessun account con questa email" vs "password errata" (comodo per l'utente,
      ma rivela a un attaccante quali email sono registrate). Alternativa più sicura:
      messaggio unico "email o password non corretti". Da decidere con Eli
      (comodità vs sicurezza). Attenuato dal blocco dopo 10 tentativi.

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
