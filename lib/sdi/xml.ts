// ============================================================
// Costruzione XML FatturaPA 1.2 — regime forfettario (fase 1).
// Requisiti (DECISIONE_SDI.md §4B): RegimeFiscale RF19 · righe senza IVA
// con Natura N2.2 · dicitura di legge · DatiBollo se non soggetto > €77,47.
// L'XML viene passato al provider (che firma/trasmette/conserva).
// ============================================================

import type { SdiInvoice } from './types'

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

/** Progressivo invio: 5 caratteri alfanumerici derivati dal numero doc */
export function progressivoInvio(numero: string): string {
  return numero.replace(/\D/g, '').slice(-5).padStart(5, '0')
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
        <Quantita>${r.quantita.toFixed(2)}</Quantita>
        <PrezzoUnitario>${num(r.prezzoUnitario)}</PrezzoUnitario>
        <PrezzoTotale>${num(r.totale)}</PrezzoTotale>
        <AliquotaIVA>${num(isForfettario ? 0 : r.aliquotaIva)}</AliquotaIVA>${isForfettario ? `
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
    : `
      <DatiRiepilogo>
        <AliquotaIVA>${num(inv.righe[0]?.aliquotaIva ?? 22)}</AliquotaIVA>
        <ImponibileImporto>${num(inv.imponibile)}</ImponibileImporto>
        <Imposta>${num(inv.imposta)}</Imposta>
      </DatiRiepilogo>`

  const bolloXml = inv.bollo > 0
    ? `
      <DatiBollo>
        <BolloVirtuale>SI</BolloVirtuale>
        <ImportoBollo>${num(inv.bollo)}</ImportoBollo>
      </DatiBollo>`
    : ''

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
        <TipoDocumento>TD01</TipoDocumento>
        <Divisa>EUR</Divisa>
        <Data>${inv.data}</Data>
        <Numero>${esc(inv.numero)}</Numero>${bolloXml}${causaleXml}
        <ImportoTotaleDocumento>${num(inv.totale)}</ImportoTotaleDocumento>
      </DatiGeneraliDocumento>
    </DatiGenerali>
    <DatiBeniServizi>${righeXml}${riepilogoXml}
    </DatiBeniServizi>
  </FatturaElettronicaBody>
</p:FatturaElettronica>`
}
