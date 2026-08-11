// ============================================================
// Selettore del provider SdI (layer di astrazione — anti lock-in).
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

/** L'unico host che è davvero l'Agenzia. Tutto il resto NON lo è. */
const HOST_PRODUZIONE = 'sdi.openapi.it'

export type SdiAmbiente = 'prova' | 'collaudo' | 'reale'

/**
 * DOVE finisce davvero una fattura trasmessa da qui.
 *
 * ⚠️ Nasce da una segnalazione di Eli (9 ago): con la chiave SANDBOX di OpenAPI
 * configurata, la pillola «PROVA» spariva — perché guardava solo se la chiave
 * c'era, non DOVE puntava. Il risultato era la peggiore delle informazioni:
 * una schermata identica a quella di produzione su un ambiente che all'Agenzia
 * non arriva. Chi trasmetteva era convinto di aver emesso la fattura.
 *
 *  · `prova`    — nessuna chiave: provider finto, non esce nulla dall'app
 *  · `collaudo` — chiave presente ma l'indirizzo NON è quello di produzione
 *  · `reale`    — chiave presente e indirizzo di produzione: arriva all'Agenzia
 *
 * ⚠️ Un indirizzo sconosciuto vale `collaudo`, non `reale`: se non possiamo
 * dimostrare che è produzione, non lo dichiariamo.
 */
export function sdiAmbiente(): SdiAmbiente {
  if (!process.env.OPENAPI_SDI_API_KEY) return 'prova'
  const raw = process.env.OPENAPI_SDI_BASE_URL ?? 'https://test.sdi.openapi.it'
  let host = ''
  try {
    host = new URL(raw).hostname.toLowerCase()
  } catch {
    return 'collaudo' // indirizzo illeggibile: non è dimostrabile che sia produzione
  }
  return host === HOST_PRODUZIONE ? 'reale' : 'collaudo'
}

export { buildFatturaPaXml, riepilogoPerAliquota, ritenutaPerXml } from './xml'
export type { SdiInvoice, SdiProvider, SdiEsito } from './types'
