# Ritenuta d'acconto — piano di lavoro e stato

> Richiesta di Eli (27 lug 2026): "la ritenuta d'acconto mi piacerebbe ci fosse" + ok al piano
> proposto dopo la ricerca approfondita (report consegnato in chat il 27 lug, fonti incluse).
> Regola B.0: le fasi marcate 🔒 partono SOLO dopo la conferma del commercialista.

## Riassunto della ricerca (dettagli nel report in chat + handoff CLAUDE.md 27 lug (3))

- Chi PAGA (sostituto d'imposta) trattiene la % e la versa con F24; in fattura si mostra
  "Ritenuta −X → Netto a pagare Y" ma **imponibile/IVA/totale documento NON cambiano**.
- Casi per i nostri utenti: ① **forfettari ESENTI** (dicitura comma 67 L.190/2014, caso più comune);
  ② **condominio committente 4%** su tutti, anche ditte (art. 25-ter DPR 600/73), causale **W**;
  ③ **professionisti ordinari 20%** (30% non residenti), causale **A**.
- Base di calcolo: imponibile post-sconti; la rivalsa INPS 4% è SOGGETTA; esclusi cassa privata,
  spese anticipate documentate, bollo addebitato. IVA mai nella base.
- XML FatturaPA: blocco `DatiRitenuta` (TipoRitenuta RT01/RT02, AliquotaRitenuta, ImportoRitenuta,
  CausalePagamento) + `<Ritenuta>SI</Ritenuta>` su OGNI riga soggetta, pena **scarto 00415**.
  Nessun campo "netto a pagare" nel tracciato (solo rappresentazione PDF/app).
- ⚠️ 4% condominio ≠ 8% bonifico parlante (quello lo trattiene la BANCA e non va in fattura;
  se il pagamento è con bonifico parlante per detrazioni, il 4% NON si applica).

## Fasi

### ✅ Fase 1 — Dicitura esenzione forfettari (FATTA, 27 lug 2026)
- PDF (4 preset, `lib/pdf/template.ts`): riga "Compenso non soggetto a ritenuta d'acconto ai sensi
  dell'art. 1, comma 67, Legge n. 190/2014." su TUTTE le fatture dei forfettari, anche con
  legal_notice personalizzata (è una dicitura fiscale, non testo di cortesia). Solo fatture, non preventivi.
- XML (`lib/sdi/causale.ts` + `xml.ts` multi-`<Causale>`): seconda causale col comma 67 nelle
  fatture forfettari, sia in trasmissione sia nel download XML.
- Test: 4 su buildPdfHtml + 4 sull'XML.

### ⏳ Fase 2 — Toggle per-fattura (dopo ok commercialista sui punti 🔒)
- Nel form fattura (solo regimi NON forfettari): interruttore "Ritenuta d'acconto" con due preset —
  "Condominio 4% (causale W)" e "Professionista 20% (causale A)" — aliquota e causale modificabili.
- Persistenza: `documents.ritenuta_pct` esiste già; servirà una colonna per la causale
  (migration piccola) o un default derivato dal preset.
- Nascosto per i forfettari (esenti).

### ⏳ Fase 3 — Motore di calcolo
- `lib/fiscal/calcoli.ts`: ritenuta = aliquota × imponibile post-sconti (round half up);
  netto a pagare = totale documento − ritenuta. **Coverage 100% obbligatoria (regola B.1.3).**
- MVP: base = imponibile del documento. Raffinamenti (cassa privata esclusa, rivalsa INPS
  esplicita) solo se servirà ai target reali.

### ⏳ Fase 4 — PDF + riepilogo in-app + pagina pubblica
- Righe "Ritenuta d'acconto (X%) −Y €" e "**Netto a pagare** Z €" nei 4 preset
  (screenshot Chromium obbligatori, regola F) e nel riepilogo del dettaglio fattura.
- "Segna pagata": con ritenuta attiva il dialog propone il NETTO (il cliente versa quello) —
  il residuo trattenuto non deve sembrare un mancato incasso.

### ⏳ Fase 5 — XML DatiRitenuta
- Blocco `DatiRitenuta` in `lib/sdi/xml.ts` + `<Ritenuta>SI</Ritenuta>` su ogni riga soggetta.
- TipoRitenuta: RT01 se il cedente è persona fisica/ditta individuale, RT02 se società
  (servirà un dato sul workspace o una derivazione dalla P.IVA/CF — da decidere in build).
- SOLO a quel punto: rimozione dei 422 attuali su trasmissione e download XML
  (route SdI + `lib/sdi/doc-xml.ts`) — mai prima, l'XML non deve mai divergere dal PDF.
- Pre-check anti-00415 (riga con flag senza blocco = impossibile per costruzione, ma test dedicato).

### ⏳ Fase 6 — Copy e casi limite
- Avviso bonifico parlante nel form quando la ritenuta è attiva su un cliente-condominio.
- La card "Automazioni fiscali" nascosta (audit 24 lug: interruttore `ritenuta_auto` morto):
  decidere se torna come default di workspace o resta solo il toggle per-fattura.

## 🔒 Domande per il commercialista (PRIMA delle fasi 2-6)
1. Artigiano persona fisica / ditta individuale che lavora per un condominio: causale **W**
   (appalto condominiale) o **A**? E per una S.r.l.?
2. Testo esatto preferito per la dicitura di esenzione dei forfettari (comma 67).
3. Regola pratica 4% condominio vs 8% bonifico parlante da scrivere nella copy dell'app.
4. Conferma base di calcolo MVP (imponibile post-sconti) per i profili dei nostri utenti.

> ⚠️ Aggiornare il dossier unico commercialista con queste domande QUANDO Eli decide di
> partire con le fasi 2-6 (istruzione permanente 14 lug: PDF via chat, mai nel repo).
