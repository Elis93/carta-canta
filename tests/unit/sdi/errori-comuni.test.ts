import { describe, it, expect } from 'vitest'
import { spiegaErroreSdi } from '@/lib/sdi/errori-comuni'

// I messaggi di prova sono nella forma REALE degli scarti SdI (elenco
// controlli AdE): codice + testo con i tag del tracciato. I casi «solo
// prosa» simulano un provider che riscrive il messaggio senza codice.

describe('spiegaErroreSdi', () => {
  it('vuoto o null → null (nessuna spiegazione inventata)', () => {
    expect(spiegaErroreSdi(null)).toBeNull()
    expect(spiegaErroreSdi(undefined)).toBeNull()
    expect(spiegaErroreSdi('')).toBeNull()
  })

  it('errore sconosciuto → null, non una spiegazione a caso', () => {
    expect(spiegaErroreSdi('Errore imprevisto del server remoto')).toBeNull()
  })

  it('00311 codice destinatario', () => {
    const e = spiegaErroreSdi('00311 - 1.1.4 <CodiceDestinatario> non valido')
    expect(e?.chiave).toBe('codice_destinatario')
  })

  it('00305 P.IVA del cliente — il codice decide anche col testo ambiguo', () => {
    const e = spiegaErroreSdi('00305 - 1.4.1.1 <IdFiscaleIVA> non valido')
    expect(e?.chiave).toBe('piva_cliente')
  })

  it('00301 P.IVA dell’ARTIGIANO — stesso testo del 00305, codice diverso', () => {
    const e = spiegaErroreSdi('00301 - 1.2.1.1 <IdFiscaleIVA> non valido')
    expect(e?.chiave).toBe('dati_artigiano')
  })

  it('00306 codice fiscale del cliente', () => {
    const e = spiegaErroreSdi('00306 - 1.4.1.2 <CodiceFiscale> non valido')
    expect(e?.chiave).toBe('cf_cliente')
  })

  it('00404 fattura duplicata', () => {
    const e = spiegaErroreSdi('00404 - Fattura duplicata')
    expect(e?.chiave).toBe('duplicata')
  })

  it('duplicata in sola prosa (senza codice)', () => {
    const e = spiegaErroreSdi('La fattura risulta duplicata per questo trasmittente')
    expect(e?.chiave).toBe('duplicata')
  })

  it('00417 cliente senza P.IVA né CF', () => {
    const e = spiegaErroreSdi(
      '00417 - 1.4.1.1 <IdFiscaleIVA> e 1.4.1.2 <CodiceFiscale> non valorizzati',
    )
    expect(e?.chiave).toBe('manca_identificativo_cliente')
  })

  it('00421 IVA che non quadra', () => {
    const e = spiegaErroreSdi(
      '00421 - Il valore del campo Imposta non risulta calcolato secondo le regole definite',
    )
    expect(e?.chiave).toBe('iva_non_quadra')
  })

  it('00423 prezzo totale che non quadra', () => {
    const e = spiegaErroreSdi(
      '00423 - 2.2.1.11 <PrezzoTotale> non calcolato secondo le regole definite',
    )
    expect(e?.chiave).toBe('prezzo_non_quadra')
  })

  it('00425 numero senza cifre', () => {
    const e = spiegaErroreSdi(
      '00425 - 2.1.1.4 <Numero> non contenente almeno un carattere numerico',
    )
    expect(e?.chiave).toBe('numero_senza_cifre')
  })

  it('00200 file non conforme al formato', () => {
    const e = spiegaErroreSdi('00200 - File non conforme al formato')
    expect(e?.chiave).toBe('formato_file')
  })

  it('prosa col codice destinatario scritto staccato', () => {
    const e = spiegaErroreSdi('Il Codice Destinatario indicato non risulta valido')
    expect(e?.chiave).toBe('codice_destinatario')
  })

  it('un «00200» in MEZZO al testo non è un codice di scarto (può essere un CAP)', () => {
    // Senza l'ancoraggio in testa, questo verrebbe tradotto come «file non
    // conforme al formato» — il rimedio sbagliato per un CAP mancante.
    const e = spiegaErroreSdi('Indirizzo del cliente: CAP 00200 non valorizzato')
    expect(e).toBeNull()
  })

  it('codice in mezzo al testo → decide comunque la parola chiave, se c’è', () => {
    const e = spiegaErroreSdi('La fattura risulta duplicata (controllo 00404)')
    expect(e?.chiave).toBe('duplicata')
  })

  it('la spiegazione porta sempre titolo, spiegazione e rimedio non vuoti', () => {
    const e = spiegaErroreSdi('00311 - <CodiceDestinatario> non valido')
    expect(e).not.toBeNull()
    expect(e!.titolo.length).toBeGreaterThan(0)
    expect(e!.spiegazione.length).toBeGreaterThan(0)
    expect(e!.rimedio.length).toBeGreaterThan(0)
    // Niente gergo tecnico nudo nel titolo: parole, non tag del tracciato
    expect(e!.titolo).not.toMatch(/[<>]/)
  })
})
