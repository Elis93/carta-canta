// ============================================================
// Costruzione XML FatturaPA 1.2 — regime forfettario (fase 1).
// Requisiti (DECISIONE_SDI.md §4B): RegimeFiscale RF19 · righe senza IVA
// con Natura N2.2 · dicitura di legge · DatiBollo se non soggetto > €77,47.
// L'XML viene passato al provider (che firma/trasmette/conserva).
// ============================================================

import type { SdiInvoice, SdiRitenuta } from './types'

function esc(s: string | null | undefined): string {
  if (!s) return ''
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function num(n: number): string {
  return n.toFixed(2)
}

/**
 * Numero con i decimali VERI, fra 2 e 8 — per `Quantita` e `PrezzoUnitario`,
 * che nel tracciato sono `[0-9]{1,12}\.[0-9]{2,8}`.
 *
 * ⚠️ NON `toFixed(2)`: una quantità scritta a mano come «0,125 ore» sarebbe
 * stata dichiarata 0.13, e lo SdI ricontrolla PrezzoTotale =
 * PrezzoUnitario × Quantita con tolleranza di 1-2 centesimi (controllo
 * 00423): 0.13 × 80 = 10,40 contro un PrezzoTotale di 10,00 → fattura
 * SCARTATA (revisione 10 ago). Il `toFixed(8)` iniziale assorbe anche il
 * rumore binario dei float; i decimali oltre il secondo si tengono solo se
 * significativi.
 */
function dec28(n: number): string {
  const fisso = n.toFixed(8)
  const [int, dec] = fisso.split('.')
  const senzaZeri = dec.replace(/0+$/, '')
  return `${int}.${senzaZeri.length <= 2 ? dec.slice(0, 2) : senzaZeri}`
}

/**
 * Progressivo invio: identificativo alfanumerico (1-10 caratteri) derivato dal
 * numero del documento. Finisce nel NOME DEL FILE trasmesso
 * (`IT{piva}_{progressivo}.xml`) e dev'essere UNIVOCO per trasmittente: lo SdI
 * rifiuta un nome già usato.
 *
 * ⚠️ Le LETTERE si tengono. La nota di credito «NC001/2026» e la fattura
 * «001/2026» sono due documenti diversi con numerazioni separate: togliendo
 * «NC» produrrebbero lo stesso progressivo, e il secondo invio verrebbe
 * respinto come file duplicato.
 */
export function progressivoInvio(numero: string): string {
  const pulito = numero.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(-10)
  return pulito || '00001'
}

/**
 * Le righe del riepilogo IVA, una per aliquota presente.
 *
 * ⚠️ L'ordine è quello di comparsa nelle righe, non alfabetico: un riepilogo
 * che segue il documento si legge meglio, e lo SdI non impone un ordine.
 * L'imposta si calcola UNA VOLTA per aliquota sulla somma delle basi — la
 * somma delle imposte arrotondate riga per riga è la causa nota dello
 * scarto 00421.
 */
export function riepilogoPerAliquota(
  righe: Array<{ aliquotaIva: number; totale: number }>,
): Array<{ aliquota: number; imponibile: number; imposta: number }> {
  const perAliquota = new Map<number, number>()
  for (const r of righe) {
    const a = Number(r.aliquotaIva ?? 0)
    perAliquota.set(a, Math.round(((perAliquota.get(a) ?? 0) + Number(r.totale ?? 0) + Number.EPSILON) * 100) / 100)
  }
  return [...perAliquota.entries()].map(([aliquota, imponibile]) => ({
    aliquota,
    imponibile,
    imposta: Math.round((imponibile * aliquota / 100 + Number.EPSILON) * 100) / 100,
  }))
}

// ── Ritenuta d'acconto per l'XML (081) ──────────────────────────────────────
// ⚠️ TipoRitenuta: RT01 = persona fisica (ditta individuale) · RT02 = soggetti
// diversi (società). Non abbiamo un campo «forma giuridica» e sbagliarlo NON
// produce uno scarto: si deduce dalla ragione sociale, che per una società la
// contiene quasi sempre; il default è RT01 perché il nostro utente tipo è una
// ditta individuale. Da confermare col commercialista (N14).
// ⚠️ CausalePagamento: 'W' = corrispettivi per contratti d'appalto, che è il
// caso del condominio. La 'A' è il lavoro autonomo e sarebbe sbagliata.
const FORMA_SOCIETARIA = /\b(s\.?r\.?l|s\.?p\.?a|s\.?n\.?c|s\.?a\.?s|s\.?s|societ[àa]|coop)\b/i

export function ritenutaPerXml(
  ritenutaPct: number,
  imponibile: number,
  causale: string | null | undefined,
  denominazione: string | null | undefined,
): SdiRitenuta | null {
  if (!(ritenutaPct > 0)) return null
  const importo = Math.round((imponibile * ritenutaPct / 100 + Number.EPSILON) * 100) / 100
  if (!(importo > 0)) return null
  return {
    tipo: FORMA_SOCIETARIA.test(String(denominazione ?? '')) ? 'RT02' : 'RT01',
    importo,
    aliquota: ritenutaPct,
    causale: /^[A-Z]{1,2}$/.test(String(causale ?? '')) ? String(causale) : 'W',
  }
}

export function buildFatturaPaXml(inv: SdiInvoice): string {
  const isForfettario = inv.cedente.regimeFiscale === 'RF19'
  const natura = isForfettario ? '<Natura>N2.2</Natura>' : ''

  const righeXml = inv.righe
    .map(
      (r, i) => `
      <DettaglioLinee>
        <NumeroLinea>${i + 1}</NumeroLinea>
        <Descrizione>${esc(r.descrizione)}</Descrizione>
        <Quantita>${dec28(r.quantita)}</Quantita>
        <PrezzoUnitario>${dec28(r.prezzoUnitario)}</PrezzoUnitario>
        <PrezzoTotale>${num(r.totale)}</PrezzoTotale>
        <AliquotaIVA>${num(isForfettario ? 0 : r.aliquotaIva)}</AliquotaIVA>${inv.ritenuta ? `
        <Ritenuta>SI</Ritenuta>` : ''}${isForfettario ? `
        ${natura}` : ''}
      </DettaglioLinee>`
    )
    .join('')

  // Riepilogo IVA: per il forfettario un unico blocco a aliquota 0 / N2.2
  const riepilogoXml = isForfettario
    ? `
      <DatiRiepilogo>
        <AliquotaIVA>0.00</AliquotaIVA>
        <Natura>N2.2</Natura>
        <ImponibileImporto>${num(inv.imponibile)}</ImponibileImporto>
        <Imposta>0.00</Imposta>
        <RiferimentoNormativo>Art. 1, commi 54-89, L. 190/2014 - Regime forfettario</RiferimentoNormativo>
      </DatiRiepilogo>`
    // ⚠️ UN BLOCCO PER ALIQUOTA (081). `DatiRiepilogo` è ripetibile e va
    // ripetuto: lo SdI ricalcola `Imposta = ImponibileImporto × AliquotaIVA`
    // su OGNI blocco (controllo 00421, tolleranza ±1 cent) e verifica che
    // ogni aliquota presente nelle righe abbia il suo riepilogo (00429).
    // Serve dalla prima fattura con beni significativi, che per costruzione
    // ha due aliquote: 10% sulla quota agevolata, 22% sull'eccedenza.
    // L'imposta si calcola sulla SOMMA delle basi di quell'aliquota — mai
    // riga per riga e poi sommata (è la causa nota dello scarto 00421).
    : riepilogoPerAliquota(inv.righe)
        .map((r) => `
      <DatiRiepilogo>
        <AliquotaIVA>${num(r.aliquota)}</AliquotaIVA>
        <ImponibileImporto>${num(r.imponibile)}</ImponibileImporto>
        <Imposta>${num(r.imposta)}</Imposta>
      </DatiRiepilogo>`)
        .join('')

  // ⚠️ POSIZIONE e COERENZA. `DatiRitenuta` sta in `DatiGeneraliDocumento`
  // SUBITO DOPO `<Numero>` e PRIMA di `<DatiBollo>` (l'XSD impone l'ordine).
  // E ogni riga a cui la ritenuta si applica deve portare `<Ritenuta>SI</...>`:
  // senza, lo SdI scarta con 00415 («DatiRitenuta presente ma nessuna linea
  // con Ritenuta = SI»). Nel tracciato `<Ritenuta>` va DOPO `<AliquotaIVA>` e
  // PRIMA di `<Natura>` — l'ordine è quello scritto sopra, non è casuale.
  const ritenutaXml = inv.ritenuta
    ? `
        <DatiRitenuta>
          <TipoRitenuta>${inv.ritenuta.tipo}</TipoRitenuta>
          <ImportoRitenuta>${num(inv.ritenuta.importo)}</ImportoRitenuta>
          <AliquotaRitenuta>${num(inv.ritenuta.aliquota)}</AliquotaRitenuta>
          <CausalePagamento>${esc(inv.ritenuta.causale)}</CausalePagamento>
        </DatiRitenuta>`
    : ''

  const bolloXml = inv.bollo > 0
    ? `
      <DatiBollo>
        <BolloVirtuale>SI</BolloVirtuale>
        <ImportoBollo>${num(inv.bollo)}</ImportoBollo>
      </DatiBollo>`
    : ''

  // ⚠️ POSIZIONE: `<Causale>` va DOPO `<ImportoTotaleDocumento>`. La sequenza
  // dell'XSD è TipoDocumento · Divisa · Data · Numero · DatiRitenuta ·
  // DatiBollo · DatiCassaPrevidenziale · ScontoMaggiorazione ·
  // ImportoTotaleDocumento · Arrotondamento · Causale, e `xs:sequence` impone
  // l'ordine: prima stava fra Numero e ImportoTotaleDocumento, cioè fuori
  // posto — un file XSD-invalido che lo SdI avrebbe scartato con 00001.
  //
  // <Causale> è ripetibile (0..N) e max 200 caratteri: ogni riga della
  // causale diventa un elemento a sé — serve per la seconda dicitura dei
  // forfettari (esenzione ritenuta, comma 67) che non entrerebbe nei 200.
  const causaleXml = inv.causale
    ? inv.causale
        .split('\n')
        .map((c) => c.trim())
        .filter(Boolean)
        .map((c) => `
      <Causale>${esc(c.slice(0, 200))}</Causale>`)
        .join('')
    : ''

  // ── Nota di credito (TD04) ────────────────────────────────────────────
  // Il TIPO di documento è ciò che dice allo SdI e all'Agenzia che si tratta
  // di uno storno: gli importi restano POSITIVI, esattamente come in fattura.
  const tipoDocumento = inv.tipoDocumento ?? 'TD01'
  // `DatiFattureCollegate` è ciò che lega la nota alla fattura stornata: senza,
  // la nota è formalmente valida ma orfana (non si sa cosa stia correggendo).
  const collegataXml = inv.fatturaCollegata
    ? `
      <DatiFattureCollegate>
        <IdDocumento>${esc(inv.fatturaCollegata.numero)}</IdDocumento>
        <Data>${esc(inv.fatturaCollegata.data)}</Data>
      </DatiFattureCollegate>`
    : ''

  const cess = inv.cessionario
  const idFiscaleCess = cess.piva
    ? `
        <IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>${esc(cess.piva)}</IdCodice></IdFiscaleIVA>`
    : ''
  const cfCess = cess.codiceFiscale ? `
        <CodiceFiscale>${esc(cess.codiceFiscale)}</CodiceFiscale>` : ''
  const pecXml = cess.codiceDestinatario === '0000000' && cess.pec
    ? `
      <PECDestinatario>${esc(cess.pec)}</PECDestinatario>`
    : ''

  return `<?xml version="1.0" encoding="UTF-8"?>
<p:FatturaElettronica versione="FPR12" xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2">
  <FatturaElettronicaHeader>
    <DatiTrasmissione>
      <IdTrasmittente><IdPaese>IT</IdPaese><IdCodice>${esc(inv.cedente.piva)}</IdCodice></IdTrasmittente>
      <ProgressivoInvio>${progressivoInvio(inv.numero)}</ProgressivoInvio>
      <FormatoTrasmissione>FPR12</FormatoTrasmissione>
      <CodiceDestinatario>${esc(cess.codiceDestinatario)}</CodiceDestinatario>${pecXml}
    </DatiTrasmissione>
    <CedentePrestatore>
      <DatiAnagrafici>
        <IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>${esc(inv.cedente.piva)}</IdCodice></IdFiscaleIVA>${inv.cedente.codiceFiscale ? `
        <CodiceFiscale>${esc(inv.cedente.codiceFiscale)}</CodiceFiscale>` : ''}
        <Anagrafica><Denominazione>${esc(inv.cedente.denominazione)}</Denominazione></Anagrafica>
        <RegimeFiscale>${inv.cedente.regimeFiscale}</RegimeFiscale>
      </DatiAnagrafici>
      <Sede>
        <Indirizzo>${esc(inv.cedente.indirizzo)}</Indirizzo>
        <CAP>${esc(inv.cedente.cap)}</CAP>
        <Comune>${esc(inv.cedente.citta)}</Comune>
        <Provincia>${esc(inv.cedente.provincia.toUpperCase().slice(0, 2))}</Provincia>
        <Nazione>IT</Nazione>
      </Sede>
    </CedentePrestatore>
    <CessionarioCommittente>
      <DatiAnagrafici>${idFiscaleCess}${cfCess}
        <Anagrafica><Denominazione>${esc(cess.denominazione)}</Denominazione></Anagrafica>
      </DatiAnagrafici>
      <Sede>
        <Indirizzo>${esc(cess.indirizzo ?? '')}</Indirizzo>
        <CAP>${esc(cess.cap ?? '00000')}</CAP>
        <Comune>${esc(cess.citta ?? '')}</Comune>${cess.provincia ? `
        <Provincia>${esc(cess.provincia.toUpperCase().slice(0, 2))}</Provincia>` : ''}
        <Nazione>IT</Nazione>
      </Sede>
    </CessionarioCommittente>
  </FatturaElettronicaHeader>
  <FatturaElettronicaBody>
    <DatiGenerali>
      <DatiGeneraliDocumento>
        <TipoDocumento>${tipoDocumento}</TipoDocumento>
        <Divisa>EUR</Divisa>
        <Data>${inv.data}</Data>
        <Numero>${esc(inv.numero)}</Numero>${ritenutaXml}${bolloXml}
        <!-- ⚠️ ImportoTotaleDocumento è FACOLTATIVO e lo SdI non lo valida.
             Qui è il totale NETTO della ritenuta, cioè la cifra che il cliente
             deve davvero bonificare e quella stampata sul PDF: le due
             rappresentazioni non devono divergere. Le fonti si dividono su
             lordo/netto — domanda N15 al commercialista. -->
        <ImportoTotaleDocumento>${num(inv.totale)}</ImportoTotaleDocumento>${causaleXml}
      </DatiGeneraliDocumento>${collegataXml}
    </DatiGenerali>
    <DatiBeniServizi>${righeXml}${riepilogoXml}
    </DatiBeniServizi>
  </FatturaElettronicaBody>
</p:FatturaElettronica>`
}
