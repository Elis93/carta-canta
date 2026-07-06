// ============================================================
// Selettore del provider SDI (layer di astrazione — anti lock-in).
// Con OPENAPI_SDI_API_KEY configurata → OpenAPI; altrimenti → mock
// (flusso completo di prova, nessuna trasmissione reale).
// ============================================================

import type { SdiProvider } from './types'
import { mockProvider } from './providers/mock'
import { openapiProvider } from './providers/openapi'

export function getSdiProvider(): SdiProvider {
  if (process.env.OPENAPI_SDI_API_KEY) return openapiProvider
  return mockProvider
}

export { buildFatturaPaXml } from './xml'
export type { SdiInvoice, SdiProvider, SdiEsito } from './types'
