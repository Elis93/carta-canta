// ============================================================
// Costruzione dell'XML FatturaPA di una fattura salvata, per DOWNLOAD
// (verifica / commercialista). NON trasmette: assembla e restituisce.
// Condiviso tra la route dell'artigiano e quella dello /studio.
// ⚠️ Applica le STESSE guardie della route di trasmissione
// (app/api/fatture/[id]/sdi/route.ts): un XML con sconti/multi-aliquota
// non rappresentabili o dati fiscali mancanti avrebbe importi diversi
// dal PDF o sarebbe invalido XSD — meglio un no chiaro che un file
// sbagliato consegnato al commercialista (review 22 lug).
// ============================================================

import { buildFatturaPaXml, type SdiInvoice } from '@/lib/sdi'
import { forfettarioCausale } from '@/lib/sdi/causale'
import { isValidPivaFormat } from '@/lib/fiscal/piva'
import { riepilogoPerAliquota, ritenutaPerXml } from '@/lib/sdi/xml'
import { espandiBeniSignificativi, type VoceSplittabile } from '@/lib/fiscal/beni-significativi'

const REGIME_MAP: Record<string, 'RF19' | 'RF01' | 'RF02'> = {
  forfettario: 'RF19',
  ordinario: 'RF01',
  minimi: 'RF02',
}

/**
 * Numero da riportare nell'XML. Toglie SOLO i prefissi letterali storici
 * («Prev», «Fatt») dei documenti vecchi.
 * ⚠️ NON tocca «NC»: è parte del numero vero della nota di credito, che ha una
 * numerazione separata — «NC001/2026» e «001/2026» sono due documenti diversi.
 */
export function numeroFiscale(docNumber: string): string {
  return String(docNumber).replace(/^(Prev|Fatt)/i, '')
}

interface WsFiscale {
  name: string | null; ragione_sociale: string | null; piva: string | null
  indirizzo: string | null; cap: string | null; citta: string | null
  provincia: string | null; fiscal_regime: string
}

export type BuildXmlResult =
  | { ok: true; xml: string; numero: string }
  | { ok: false; status: 404 | 422; error: string }

/**
 * Costruisce l'XML della fattura `docId` del workspace `workspaceId`.
 * `db` può essere il client server (RLS) o l'admin client (studio).
 */
export async function buildInvoiceXmlForDoc(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- accetta client server o admin
  db: any,
  workspaceId: string,
  docId: string,
  ws: WsFiscale,
  cedenteEmail: string | null,
): Promise<BuildXmlResult> {
  // ── Dati fiscali del cedente completi (altrimenti XML invalido XSD) ──
  const missingWs: string[] = []
  if (!ws.piva || !isValidPivaFormat(ws.piva)) missingWs.push('P.IVA')
  if (!ws.indirizzo) missingWs.push('indirizzo')
  if (!ws.cap) missingWs.push('CAP')
  if (!ws.citta) missingWs.push('città')
  if (!ws.provincia) missingWs.push('provincia')
  if (missingWs.length > 0) {
    return { ok: false, status: 422, error: `Dati fiscali dell'emittente incompleti (manca ${missingWs.join(', ')}): vanno completati in Impostazioni prima di scaricare l'XML.` }
  }

  const { data: doc } = await db
    .from('documents')
    .select('*, document_items(*), clients!client_id(*)')
    .eq('id', docId)
    .eq('workspace_id', workspaceId)
    // Anche le NOTE DI CREDITO: sono documenti fiscali a tutti gli effetti e
    // il commercialista ne ha bisogno esattamente come delle fatture.
    .in('doc_type', ['fattura', 'nota_credito', 'nota_debito'])
    .is('deleted_at', null)
    .maybeSingle()
  if (!doc) return { ok: false, status: 404, error: 'Fattura non trovata.' }
  const isNc = doc.doc_type === 'nota_credito'
  // Nota di DEBITO (TD05): stessa struttura della nota di credito — stesso
  // riferimento alla fattura, importi positivi — cambia solo il tipo. È il
  // tipo documento a dire allo SdI se la variazione è in aumento o in
  // diminuzione, mai il segno degli importi.
  const isNd = doc.doc_type === 'nota_debito'
  const isNota = isNc || isNd
  const nomeDoc = isNc ? 'La nota di credito' : isNd ? 'La nota di debito' : 'La fattura'
  if (doc.status === 'draft') {
    return { ok: false, status: 422, error: `${nomeDoc} è ancora una bozza: l’XML si scarica dopo l’invio.` }
  }
  if (!doc.doc_number) {
    return { ok: false, status: 422, error: `${nomeDoc} non ha ancora un numero.` }
  }

  // Se esiste lo SNAPSHOT dell'XML effettivamente trasmesso allo SdI (058), è
  // quello la fonte di verità: la ricostruzione dai dati attuali potrebbe
  // divergere da ciò che è stato inviato. Restituiamolo tale e quale.
  // Lo snapshot vale SOLO per una trasmissione VIVA e CONFERMATA (whitelist,
  // review 25 lug A4): con 'scartata' serve l'XML coi dati correnti per il
  // reinvio; con 'inviata' senza sent_at il reinvio è in volo (snapshot del
  // tentativo precedente); con sdi_status azzerato (riattivazione di una
  // scartata) lo snapshot residuo è del tentativo RIFIUTATO — consegnarlo al
  // commercialista come "trasmesso" sarebbe una prova sbagliata.
  const docSdiStatus = String((doc as { sdi_status?: string | null }).sdi_status ?? '')
  const docSdiSentAt = (doc as { sdi_sent_at?: string | null }).sdi_sent_at ?? null
  const snapshot = String((doc as { sdi_xml_snapshot?: string | null }).sdi_xml_snapshot ?? '').trim()
  const snapshotIsCurrent =
    ['inviata', 'consegnata', 'mancata_consegna'].includes(docSdiStatus) && !!docSdiSentAt
  if (snapshot && snapshotIsCurrent) {
    return { ok: true, xml: snapshot, numero: numeroFiscale(doc.doc_number) }
  }

  const client = doc.clients as Record<string, unknown> | null
  if (!client) return { ok: false, status: 422, error: 'La fattura non ha un cliente associato.' }

  // Voci senza descrizione escluse (come la route di trasmissione)
  // ⚠️ BENI SIGNIFICATIVI (081): la voce marcata si spezza in due — quota al
  // 10% ed eccedenza al 22% — PRIMA di costruire l'XML. È la stessa funzione
  // (idempotente) che usa il motore fiscale, quindi righe, riepilogo e totali
  // del PDF non possono divergere da ciò che riceve l'Agenzia.
  const items = espandiBeniSignificativi(
    ((doc.document_items ?? []) as Array<Record<string, unknown>>).filter(
      (i) => String(i.description ?? '').trim() !== ''
    ) as unknown as VoceSplittabile[],
    ws.fiscal_regime,
  ) as unknown as Array<Record<string, unknown>>
  if (items.length === 0) return { ok: false, status: 422, error: 'La fattura non ha voci.' }

  // ── Limiti fase 1 (identici alla trasmissione): sconti e multi-aliquota
  // non sono ancora rappresentati nell'XML → importi diversi dal PDF.
  const hasDiscount =
    Number(doc.discount_pct ?? 0) > 0 ||
    Number(doc.discount_fixed ?? 0) > 0 ||
    items.some((i) => Number(i.discount_pct ?? 0) > 0)
  if (hasDiscount) {
    return { ok: false, status: 422, error: 'Le fatture con sconti non sono ancora rappresentabili nell’XML FatturaPA: gli importi non corrisponderebbero al PDF.' }
  }
  const regime = REGIME_MAP[ws.fiscal_regime] ?? 'RF19'
  const isForf = regime === 'RF19'
  // Le ALIQUOTE DIVERSE sono ora rappresentate: `DatiRiepilogo` esce con un
  // blocco per aliquota (081). Serviva dai beni significativi, che per
  // costruzione producono sempre 10% + 22%.
  // La RITENUTA è ora rappresentata (081): `DatiRitenuta` + `Ritenuta = SI`
  // su ogni riga. Il rifiuto del 24 lug non serve più.

  // ⚖️ Guardia 00421 sui documenti STORICI: fino al 10 ago l'IVA si calcolava
  // per voce, e un `tax_amount` salvato così può divergere di >1 centesimo dal
  // ricalcolo dello SdI (Imposta = Imponibile × Aliquota, tolleranza ±0,01) →
  // scarto. Il motore nuovo lo rende impossibile sui documenti risalvati, ma
  // qui l'XML nasce dai CAMPI SALVATI: meglio un no chiaro adesso che uno
  // scarto dallo SdI dopo. (Sconti e multi-aliquota sono già esclusi sopra,
  // quindi il ricalcolo è una moltiplicazione sola.)
  if (!isForf) {
    // Ricalcolo PER ALIQUOTA, lo stesso che fa lo SdI su ogni DatiRiepilogo.
    const impostaAttesa = riepilogoPerAliquota(
      items.map((i) => ({
        aliquotaIva: Number(i.vat_rate ?? doc.vat_rate_default ?? 22),
        totale: Number(i.total ?? 0),
      })),
    ).reduce((s, r) => s + r.imposta, 0)
    if (Math.abs(Number(doc.tax_amount ?? 0) - impostaAttesa) > 0.011) {
      return {
        ok: false,
        status: 422,
        error: `L’IVA salvata su questo documento (${Number(doc.tax_amount ?? 0).toFixed(2)} €) non coincide col ricalcolo che farà lo SdI (${impostaAttesa.toFixed(2)} €): verrebbe scartato. Apri il documento, risalvalo (i totali si ricalcolano) e riprova.`,
      }
    }
  }

  const clientPiva = String(client.piva ?? '').replace(/\D/g, '') || null
  const clientCf = String(client.codice_fiscale ?? '').trim().toUpperCase() || null
  if (!clientPiva && !clientCf) {
    return { ok: false, status: 422, error: 'Al cliente manca P.IVA o Codice Fiscale: va aggiunto in rubrica.' }
  }
  // Stesse verifiche della trasmissione (25 lug): un XML scaricato con una
  // P.IVA o un CF sbagliati verrebbe scartato dallo SdI in mano al
  // commercialista — meglio dirlo qui.
  if (clientPiva && !isValidPivaFormat(clientPiva)) {
    return { ok: false, status: 422, error: `La P.IVA del cliente (${clientPiva}) non sembra corretta: va ricontrollata in rubrica.` }
  }
  const CF_PERSONA = /^[A-Z]{6}[0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/
  const CF_ENTE = /^[0-9]{11}$/
  if (clientCf && !CF_PERSONA.test(clientCf) && !CF_ENTE.test(clientCf)) {
    return { ok: false, status: 422, error: `Il Codice Fiscale del cliente (${clientCf}) non è in un formato valido: va ricontrollato in rubrica.` }
  }

  // Indirizzo del cessionario obbligatorio (Sede: Indirizzo, CAP, Comune):
  // senza, l'XML esce con <Indirizzo></Indirizzo> vuoto = XSD-invalid.
  const missingClient: string[] = []
  if (!String(client.indirizzo ?? '').trim()) missingClient.push('indirizzo')
  if (!/^\d{5}$/.test(String(client.cap ?? '').trim())) missingClient.push('CAP')
  if (!String(client.citta ?? '').trim()) missingClient.push('città')
  if (missingClient.length > 0) {
    return { ok: false, status: 422, error: `Per l'XML serve l'indirizzo completo del cliente: manca ${missingClient.join(', ')}. Va completata la sua scheda in rubrica.` }
  }

  // ⚠️ Inversione contabile: la dicitura di legge va SCRITTA nel documento —
  // è ciò che spiega al committente perché deve integrare lui l'imposta.
  const isReverse = !isForf && (doc as { reverse_charge?: boolean | null }).reverse_charge === true
  const causale = isForf
    ? forfettarioCausale()
    : isReverse ? 'Inversione contabile - art. 17, comma 6, lett. a-ter, DPR 633/1972 - IVA assolta dal committente' : null

  // L'inversione contabile vale SOLO fra soggetti IVA: senza la P.IVA del
  // cliente la fattura sarebbe sbagliata (e l'IVA non l'avrebbe pagata
  // nessuno). Meglio fermarsi qui che emetterla.
  if (isReverse && !String(client.piva ?? '').replace(/\D/g, '')) {
    return { ok: false, status: 422, error: 'L’inversione contabile vale solo fra titolari di partita IVA, ma il cliente in rubrica non ne ha una. Aggiungila, oppure togli la spunta e addebita l’IVA normalmente.' }
  }

  const clientDest = String(client.codice_destinatario ?? '').trim().toUpperCase() || null
  // Compilato ma invalido: prima diventava '0000000' IN SILENZIO (fattura non
  // recapitata al canale del cliente). Meglio segnalarlo, come in trasmissione.
  if (clientDest && !/^[A-Z0-9]{7}$/.test(clientDest)) {
    return { ok: false, status: 422, error: `Il codice destinatario "${clientDest}" non è valido: deve essere di 7 caratteri (lettere e numeri). Va corretto in rubrica, oppure lasciato vuoto se il cliente è un privato.` }
  }
  const codiceDestinatario = clientDest ?? '0000000'
  const numero = numeroFiscale(doc.doc_number)

  // ── Nota di credito: il riferimento alla fattura stornata ────────────────
  // ⚠️ Senza `DatiFattureCollegate` la nota è orfana: formalmente valida, ma
  // non dice quale fattura stia correggendo. Se il collegamento non si trova,
  // meglio non produrre il file che consegnarne uno inutilizzabile.
  let fatturaCollegata: { numero: string; data: string } | null = null
  if (isNota) {
    const originId = (doc as { origin_document_id?: string | null }).origin_document_id ?? null
    if (!originId) {
      return { ok: false, status: 422, error: isNd
        ? 'Questa nota di debito non è collegata a nessuna fattura: senza il riferimento alla fattura integrata l’XML non è utilizzabile.'
        : 'Questa nota di credito non è collegata a nessuna fattura: senza il riferimento alla fattura stornata l’XML non è utilizzabile.' }
    }
    const { data: orig } = await db
      .from('documents')
      .select('doc_number, created_at')
      .eq('id', originId)
      .eq('workspace_id', workspaceId)
      .maybeSingle()
    if (!orig?.doc_number) {
      return { ok: false, status: 422, error: isNd
        ? 'La fattura integrata da questa nota di debito non è più disponibile: senza il suo numero l’XML non è utilizzabile.'
        : 'La fattura stornata da questa nota di credito non è più disponibile: senza il suo numero l’XML non è utilizzabile.' }
    }
    fatturaCollegata = {
      numero: numeroFiscale(orig.doc_number),
      data: String(orig.created_at ?? '').slice(0, 10),
    }
  }

  const invoice: SdiInvoice = {
    numero,
    data: (doc.created_at ?? new Date().toISOString()).slice(0, 10),
    cedente: {
      denominazione: ws.ragione_sociale ?? ws.name ?? '',
      piva: (ws.piva ?? '').replace(/\D/g, ''),
      codiceFiscale: null,
      indirizzo: ws.indirizzo ?? '',
      cap: ws.cap ?? '',
      citta: ws.citta ?? '',
      provincia: ws.provincia ?? '',
      regimeFiscale: regime,
      email: cedenteEmail,
    },
    cessionario: {
      denominazione: [client.name, client.surname].filter(Boolean).join(' ') || 'Cliente',
      piva: clientPiva,
      codiceFiscale: clientCf,
      indirizzo: (client.indirizzo as string | null) ?? null,
      cap: (client.cap as string | null) ?? null,
      citta: (client.citta as string | null) ?? null,
      provincia: (client.provincia as string | null) ?? null,
      codiceDestinatario,
      pec: String(client.pec ?? '').trim() || null,
    },
    righe: items.map((i) => ({
      descrizione: String(i.description ?? ''),
      quantita: Number(i.quantity ?? 1),
      prezzoUnitario: Number(i.unit_price ?? 0),
      totale: Number(i.total ?? 0),
      aliquotaIva: Number(i.vat_rate ?? doc.vat_rate_default ?? 22),
    })),
    imponibile: Number(doc.subtotal ?? 0),
    imposta: Number(doc.tax_amount ?? 0),
    totale: Number(doc.total ?? 0),
    bollo: Number(doc.bollo_amount ?? 0),
    ritenuta: ritenutaPerXml(
      Number((doc as { ritenuta_pct?: number | null }).ritenuta_pct ?? 0),
      Number(doc.subtotal ?? 0),
      (doc as { ritenuta_causale?: string | null }).ritenuta_causale,
      ws.ragione_sociale ?? ws.name,
    ),
    // Inversione contabile (081): righe e riepilogo escono a natura N6.7.
    reverseCharge: (doc as { reverse_charge?: boolean | null }).reverse_charge === true,
    causale,
    tipoDocumento: isNc ? 'TD04' : isNd ? 'TD05' : 'TD01',
    fatturaCollegata,
  }

  return { ok: true, xml: buildFatturaPaXml(invoice), numero }
}
