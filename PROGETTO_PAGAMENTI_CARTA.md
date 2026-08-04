# PROGETTO — Pagamento con carta dal link della fattura (⏳ DA FARE APPENA POSSIBILE)

> **Decisione Eli (4 ago 2026):** "colleghiamo il pagamento con carta se non ci espone a rischi;
> se non possiamo farlo ora, mettiamolo come cosa da fare appena possibile".
> Stato: **progetto congelato, pronto da implementare** al soddisfacimento dei prerequisiti sotto.
> Area SOLDI → regola B.0: niente implementazione senza i cancelli spuntati.

## Il modello scelto (l'unico che NON ci espone)

**Stripe Connect "Standard"**: ogni artigiano collega il **SUO** account Stripe a Carta Canta
(onboarding e KYC li fa Stripe). Quando il cliente tocca "Paga con carta" sul link pubblico
della fattura, il pagamento avviene **direttamente sull'account Stripe dell'artigiano**
(direct charge). Conseguenze:

- **Noi non tocchiamo mai i soldi** — nessun transito sui nostri conti, nessuna licenza di
  pagamento necessaria. Siamo solo il software che genera la sessione di pagamento.
- **Noi non tocchiamo mai i dati carta** — la pagina di pagamento è di Stripe (Checkout),
  PCI-DSS a carico loro.
- **Rimborsi e contestazioni (chargeback)** sono un rapporto artigiano↔Stripe↔cliente:
  noi non siamo parte.
- **Commissioni**: quelle standard di Stripe le paga l'artigiano (≈1,5-2,5% + fisso).
  Decisione presa col progetto: **nessuna application fee nostra** in prima fase
  (aggiungerla dopo = una riga di codice, ma richiede aggiornare i Termini).

### ⚠️ Cosa NON fare MAI (la trappola)
Incassare noi per conto degli artigiani e poi girare i soldi (charge sul NOSTRO account +
bonifico) = diventiamo **intermediari di pagamento** → serve licenza (IMEL/agente PSD2).
Qualsiasi scorciatoia che faccia transitare denaro da noi è vietata.

## Prerequisiti (cancelli, in ordine)

1. **[ELI] Stripe live + P.IVA** — l'account piattaforma deve essere in modalità live.
2. **[ELI] Attivare Stripe Connect** sul proprio account (Dashboard → Connect → Get started,
   tipo "Standard accounts"). Gratis; serve solo la configurazione.
3. **[B.0 / avvocato] Riga nel dossier unico avvocato** (alla prossima rigenerazione):
   pagamenti via Stripe Connect Standard — confermare che con direct charge sull'account
   dell'artigiano Carta Canta non è parte del rapporto di pagamento; aggiornamento
   Termini + Privacy (Stripe come destinatario/titolare autonomo per il KYC dell'artigiano).
4. **[Decisione]** Da confermare al momento: la quietanza/registrazione incasso automatica
   marca la fattura "Pagata" da webhook — ok fiscale? (probabile sì: è gestionale, non fiscale;
   eventuale domanda commercialista se si vuole la quietanza formale).

## Piano di implementazione (quando i cancelli sono aperti)

- **Migration**: `workspaces.stripe_connect_account_id TEXT` (+ `connect_status`).
- **Onboarding** (Impostazioni › Pagamenti): bottone "Collega Stripe" → `stripe.accounts.create`
  (type standard) o OAuth → Account Link (`account_onboarding`) → redirect di ritorno;
  card con stato (collegato / da completare / non collegato) e "Scollega".
- **Bottone sul link pubblico** `/p/[token]` (solo FATTURE, stati sent/viewed/expired, con
  residuo > 0): "Paga con carta" → route POST che crea una **Checkout Session sull'account
  collegato** (`stripe.checkout.sessions.create({...}, { stripeAccount: acct_… })`) con
  importo = **residuo** (acconti già ricevuti sottratti), valuta EUR, descrizione = numero
  fattura, success/cancel → di nuovo su /p/[token]. Rate-limit per token come le altre route
  pubbliche. Niente bottone se il workspace non ha l'account collegato.
- **Webhook Connect** (`/api/webhooks/stripe-connect`, endpoint separato dal webhook
  abbonamenti): `checkout.session.completed` con `account` header → registra l'incasso sulla
  fattura (stessa semantica di "Segna pagata": payment_status paid/partial, paid_at, voce
  `payment` nel document_log con canale "carta") — idempotente su event.id (pattern 060/061
  già esistente, tabella riusabile).
- **UI**: riga "Pagata con carta il X" in cronologia; in Impostazioni › Pagamenti la card
  IBAN esistente resta (bonifico sempre disponibile, la carta è in aggiunta).
- **🔒 Regole**: mai salvare dati carta; mai esporre l'account id al cliente; il bottone
  compare solo con Connect attivo E fattura con residuo; i totali NON cambiano (nessuna
  commissione ribaltata sul cliente — vietato per le carte consumer in UE).

## Perché è diverso dalla riconciliazione bancaria (esclusa)
La riconciliazione legge il CONTO CORRENTE dell'artigiano (open banking, fornitore terzo,
dati finanziari in ingresso) — complessità GDPR alta, esclusa da Eli. Qui invece il denaro
viaggia su binari Stripe già del­l'artigiano e a noi arriva solo l'evento "pagato".
