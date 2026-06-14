# Procedura in caso di violazione di dati (Data Breach)

> ⚠️ BOZZA. Riferimenti: artt. 33 e 34 GDPR. Tienila a portata di mano: in caso di
> violazione hai **72 ore** dal momento in cui ne vieni a conoscenza per notificare al Garante.
> Ultimo aggiornamento: [DATA].

## Cos'è un data breach

Una violazione di sicurezza che porta — anche accidentalmente — a distruzione, perdita,
modifica, divulgazione o accesso non autorizzato a dati personali. Esempi per Carta Canta:
- un attaccante accede al database o alla console Supabase/Vercel;
- una falla nelle policy di accesso espone documenti di altri utenti (come quella corretta
  con la migration 035);
- una chiave segreta (service_role, Stripe, Resend) viene esposta pubblicamente;
- un dispositivo con credenziali viene perso o compromesso;
- invio di dati alla persona sbagliata.

## Cosa fare, passo per passo

**1. Contenere (subito)**
- Revoca/ruota le chiavi compromesse (Supabase, Stripe, Resend, Upstash).
- Chiudi la falla (deploy del fix, disattiva l'accesso compromesso).
- Forza il logout/reset password se sono coinvolte credenziali utente.

**2. Valutare (entro poche ore)**
- Quali dati, di quanti interessati, quali rischi per le persone?
- Annota: cosa è successo, quando, come l'hai scoperto, dati coinvolti, misure prese.

**3. Notificare al Garante (entro 72 ore)** — se la violazione comporta un **rischio per i
diritti e le libertà** delle persone.
- Canale: procedura telematica sul sito del Garante (www.garanteprivacy.it).
- Se non riesci entro 72 ore, notifica comunque spiegando il ritardo.
- Se il rischio è **improbabile**, puoi non notificare ma **devi documentare** la decisione.

**4. Avvisare gli interessati (art. 34)** — se il rischio è **elevato** (es. esposizione di
dati che possono causare danni). Comunicazione chiara, in linguaggio semplice, su cosa è
successo e cosa possono fare.

**5. Se la violazione riguarda i dati dei clienti finali** (di cui sei responsabile, non
titolare): **avvisa senza ingiustificato ritardo l'utente artigiano** (il titolare), che
deciderà se notificare al Garante.

**6. Registrare**
- Ogni violazione va annotata nel registro qui sotto, anche quelle non notificate.

## Contatti rapidi

- Garante Privacy: www.garanteprivacy.it
- Referente interno: [NOME / EMAIL / TELEFONO]
- Consulente privacy: [NOME / CONTATTI]

## Registro delle violazioni

| Data scoperta | Descrizione | Dati coinvolti | Interessati | Rischio | Notificato Garante? | Avvisati interessati? | Misure adottate |
|---|---|---|---|---|---|---|---|
| | | | | | | | |
