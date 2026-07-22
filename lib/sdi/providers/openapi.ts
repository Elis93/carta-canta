// ============================================================
// Provider SDI — OpenAPI (console.openapi.com), fase 1: SOLO INVIO.
// DECISIONE_SDI.md §9.2: business_registry_configuration con
// apply_legal_storage attivo (una volta per cliente), poi
// POST /invoices_legal_storage (invio + conservazione in una richiesta).
//
// ⚠️ DA VERIFICARE IN SANDBOX: i path esatti e la forma dei payload vanno
// confermati sulla doc OpenAPI quando Eli fornisce le chiavi sandbox
// (precondizione: revisione contratto/DPA — MAI produzione senza ok).
// Chiavi SOLO lato server (env), mai nel client (regola B.1.2).
// ============================================================

import type { SdiProvider, SdiInvoice, SdiSendResult, SdiCedente } from '../types'

// Host CONFERMATO in sandbox (22 lug, doc ufficiale OpenAPI): l'API "SDI Electronic
// Invoicing" vive su sdi.openapi.it (prod) / test.sdi.openapi.it (sandbox).
// Il vecchio default test.invoice.openapi.com era sbagliato → 401 XML dal gateway.
const BASE_URL = process.env.OPENAPI_SDI_BASE_URL ?? 'https://test.sdi.openapi.it'

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${process.env.OPENAPI_SDI_API_KEY}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
}

export const openapiProvider: SdiProvider = {
  name: 'openapi',
  isMock: false,

  async ensureConfiguration(cedente: SdiCedente, webhookUrl: string) {
    try {
      const res = await fetch(`${BASE_URL}/business_registry_configurations`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          fiscal_id: `IT${cedente.piva}`,
          name: cedente.denominazione,
          email: cedente.email,
          apply_legal_storage: true,   // conservazione a norma 10 anni
          apply_signature: false,      // firma non necessaria (forfettario B2B)
          receive_invoices: false,     // FASE 1: SOLO INVIO — mai ricezione
          callbacks: [{ event: 'supplier-invoice', url: webhookUrl }],
        }),
      })
      if (!res.ok && res.status !== 409) {
        const body = await res.text().catch(() => '')
        // "Già esistente" = idempotente, ok. OpenAPI NON usa il 409: risponde
        // 400 con error 230 "You already have a business registry with this
        // fiscal id" (confermato in sandbox, 22 lug) → va trattato come successo.
        if (res.status === 400 && /already have a business registry/i.test(body)) {
          return { ok: true }
        }
        console.error('[sdi/openapi] configurazione fallita:', res.status, body.slice(0, 300))
        return { ok: false, error: 'Configurazione del profilo fiscale non riuscita.' }
      }
      return { ok: true }
    } catch (err) {
      console.error('[sdi/openapi] configurazione errore rete:', err)
      return { ok: false, error: 'Il servizio di fatturazione non risponde. Riprova.' }
    }
  },

  async sendInvoice(_invoice: SdiInvoice, xml: string): Promise<SdiSendResult> {
    try {
      const res = await fetch(`${BASE_URL}/invoices_legal_storage`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ payload: Buffer.from(xml).toString('base64') }),
      })
      const data = (await res.json().catch(() => ({}))) as { id?: string; uuid?: string; message?: string }
      if (!res.ok) {
        console.error('[sdi/openapi] invio fallito:', res.status, JSON.stringify(data).slice(0, 300))
        return { ok: false, error: data.message ?? 'Invio allo SDI non riuscito. Riprova.' }
      }
      const providerId = data.id ?? data.uuid
      if (!providerId) return { ok: false, error: 'Risposta del provider senza identificativo.' }
      return { ok: true, providerId: String(providerId), mock: false }
    } catch (err) {
      console.error('[sdi/openapi] invio errore rete:', err)
      return { ok: false, error: 'Il servizio di fatturazione non risponde. Riprova.' }
    }
  },
}
