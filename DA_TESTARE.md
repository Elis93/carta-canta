# 🧪 DA TESTARE — cose recenti da provare dal vivo

> Lista delle cose implementate ma **non ancora collaudate su ambiente reale**
> (browser vero / telefono / produzione). Spunta man mano che le provi.
> Aggiornata al 20 lug 2026.

---

## 🔐 Sicurezza (dopo l'audit del 20 lug)

- [ ] **CSP in produzione — controllo che non abbia rotto niente.** Ho aggiunto una
      Content-Security-Policy: è permissiva sui servizi terzi, quindi NON dovrebbe
      rompere nulla, ma va confermato su cartacanta.app in un browser vero. Verifica:
  - il **captcha** nella pagina di registrazione compare e funziona
  - il **login** funziona
  - l'**anteprima/stampa PDF** di un preventivo si apre
  - la pagina pubblica di un preventivo (`/p/...`) si vede bene
  - (facoltativo) apri la Console del browser (F12) e guarda che non ci siano
    errori rossi che citano "Content Security Policy"
  → se qualcosa non va, si allarga la CSP per quel servizio (dimmelo).

- [ ] **Login: nuovo messaggio generico.** Prova ad accedere con un'email a caso +
      password a caso → deve dire **"Email o password non corretti"** (non più
      "nessun account con questa email"). Sotto restano i link "password dimenticata"
      e "registrati".

- [ ] **CSP — lockdown script completo** (task futuro, NON ora): blindare `script-src`
      con nonce + `strict-dynamic`, collaudando dal vivo Turnstile/PostHog/Stripe.

## 🔒 Blocca l'app quando esco (dal telefono)

- [ ] Attiva da **Impostazioni › Generale › "Blocca l'app quando esco"**, scegli
      **"Ad ogni apertura"**, chiudi e riapri l'app → deve comparire "App bloccata" e
      chiedere la **password** per rientrare. Prova a scrivere la password → deve entrare.
- [ ] (Opzionale, telefono che supporta l'impronta) Aggiungi lo **sblocco con impronta**
      dalla stessa card → riapri l'app → deve comparire anche il bottone "Sblocca con
      l'impronta"; provalo. La password resta comunque un'alternativa.
- [ ] Prova **"Esci dall'account"** nella schermata di blocco → deve portarti al login.
- [ ] Se un domani impacchetti la app col Play Store (TWA): l'impronta funziona solo
      dopo aver messo il fingerprint SHA-256 in `assetlinks` (già in lista Play Store).

## 🛰️ Operatività

- [ ] **Sitemap Google**: fra 2-3 giorni ricontrolla in Search Console che lo stato
      diventi "Riuscito" (ora è "Impossibile recuperare", normale appena inviata).
