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

const REGIME_MAP: Record<string, 'RF19' | 'RF01' | 'RF02'> = {
  forfettario: 'RF19',
  ordinario: 'RF01',
  minimi: 'RF02',
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
  if (!ws.piva || !/^\d{11}$/.test(ws.piva.replace(/\D/g, ''))) missingWs.push('P.IVA')
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
    .eq('doc_type', 'fattura')
    .is('deleted_at', null)
    .maybeSingle()
  if (!doc) return { ok: false, status: 404, error: 'Fattura non trovata.' }
  if (doc.status === 'draft') {
    return { ok: false, status: 422, error: 'La fattura è ancora una bozza: l’XML si scarica dopo l’invio.' }
  }
  if (!doc.doc_number) {
    return { ok: false, status: 422, error: 'La fattura non ha ancora un numero.' }
  }

  const client = doc.clients as Record<string, unknown> | null
  if (!client) return { ok: false, status: 422, error: 'La fattura non ha un cliente associato.' }

  // Voci senza descrizione escluse (come la route di trasmissione)
  const items = ((doc.document_items ?? []) as Array<Record<string, unknown>>).filter(
    (i) => String(i.description ?? '').trim() !== ''
  )
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
  if (!isForf) {
    const rates = new Set(items.map((i) => Number(i.vat_rate ?? doc.vat_rate_default ?? 22)))
    if (rates.size > 1) {
      return { ok: false, status: 422, error: 'Le fatture con aliquote IVA diverse tra le voci non sono ancora rappresentabili nell’XML FatturaPA.' }
    }
  }

  const clientPiva = String(client.piva ?? '').replace(/\D/g, '') || null
  const clientCf = String(client.codice_fiscale ?? '').trim().toUpperCase() || null
  if (!clientPiva && !clientCf) {
    return { ok: false, status: 422, error: 'Al cliente manca P.IVA o Codice Fiscale: va aggiunto in rubrica.' }
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

  const causale = isForf
    ? 'Operazione effettuata ai sensi dell’art. 1, commi da 54 a 89, della Legge n. 190/2014 e successive modificazioni — regime forfettario. Operazione senza applicazione dell’IVA.'
    : null

  const clientDest = String(client.codice_destinatario ?? '').trim().toUpperCase() || null
  const codiceDestinatario = clientDest && /^[A-Z0-9]{7}$/.test(clientDest) ? clientDest : '0000000'
  const numero = String(doc.doc_number).replace(/^[A-Za-z]+/, '')

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
    causale,
  }

  return { ok: true, xml: buildFatturaPaXml(invoice), numero }
}
