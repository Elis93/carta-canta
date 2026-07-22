// ============================================================
// Costruzione dell'XML FatturaPA di una fattura salvata, per DOWNLOAD
// (verifica / commercialista). NON trasmette: assembla e restituisce.
// Condiviso tra la route dell'artigiano e quella dello /studio.
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

/**
 * Costruisce l'XML della fattura `docId` del workspace `workspaceId`.
 * `db` può essere il client server (RLS) o l'admin client (studio).
 * Ritorna { xml, numero } oppure null se la fattura non esiste.
 */
export async function buildInvoiceXmlForDoc(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- accetta client server o admin
  db: any,
  workspaceId: string,
  docId: string,
  ws: WsFiscale,
  cedenteEmail: string | null,
): Promise<{ xml: string; numero: string } | null> {
  const { data: doc } = await db
    .from('documents')
    .select('*, document_items(*), clients!client_id(*)')
    .eq('id', docId)
    .eq('workspace_id', workspaceId)
    .eq('doc_type', 'fattura')
    .is('deleted_at', null)
    .maybeSingle()
  if (!doc) return null

  const client = doc.clients ?? {}
  const items = (doc.document_items ?? []) as Array<Record<string, unknown>>

  const regime = REGIME_MAP[ws.fiscal_regime] ?? 'RF19'
  const isForf = regime === 'RF19'
  const causale = isForf
    ? 'Operazione effettuata ai sensi dell’art. 1, commi da 54 a 89, della Legge n. 190/2014 e successive modificazioni — regime forfettario. Operazione senza applicazione dell’IVA.'
    : null

  const clientDest = String(client.codice_destinatario ?? '').trim().toUpperCase() || null
  const codiceDestinatario = clientDest && /^[A-Z0-9]{7}$/.test(clientDest) ? clientDest : '0000000'
  const numero = String(doc.doc_number ?? '').replace(/^[A-Za-z]+/, '') || '000'

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
      piva: String(client.piva ?? '').replace(/\D/g, '') || null,
      codiceFiscale: String(client.codice_fiscale ?? '').trim().toUpperCase() || null,
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

  return { xml: buildFatturaPaXml(invoice), numero }
}
