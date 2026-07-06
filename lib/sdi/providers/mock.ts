// ============================================================
// Provider SDI di PROVA (mock) — nessuna trasmissione reale.
// Usato quando OPENAPI_SDI_API_KEY non è configurata: permette di
// testare tutto il flusso (stati, quote, UI, webhook) senza costi
// e senza toccare lo SdI. Gli id generati iniziano con "mock-".
// ============================================================

import type { SdiProvider, SdiInvoice, SdiSendResult, SdiCedente } from '../types'

export const mockProvider: SdiProvider = {
  name: 'mock',
  isMock: true,

  async ensureConfiguration(_cedente: SdiCedente, _webhookUrl: string) {
    return { ok: true }
  },

  async sendInvoice(invoice: SdiInvoice, _xml: string): Promise<SdiSendResult> {
    // Simula l'accettazione immediata da parte del provider.
    // L'esito SdI (consegnata/scartata) arriverebbe poi via webhook:
    // in prova lo si simula chiamando /api/webhooks/sdi a mano.
    return {
      ok: true,
      providerId: `mock-${invoice.numero.replace('/', '-')}-${invoice.data}`,
      mock: true,
    }
  },
}
