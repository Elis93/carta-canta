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
import { extractNotificationEsito } from '../esito'

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

// Aggancia i callback a un profilo GIA' esistente (l'array callbacks di
// POST business_registry_configurations vale solo alla creazione).
// Via preferita: PATCH /business_registry_configurations (endpoint visto
// negli scope del token, 23 lug); ripiego: POST /api_configurations per
// evento. Best-effort: ogni esito viene loggato per la calibrazione in
// sandbox; un fallimento qui non blocca la trasmissione (resta il pull
// "Controlla l'esito").
async function attachCallbacks(fiscalId: string, webhookUrl: string): Promise<void> {
  const callbacks = [
    { event: 'customer-notification', url: webhookUrl },
    { event: 'customer-invoice', url: webhookUrl },
  ]
  // 1) PATCH del profilo: fiscal_id nel path, poi variante nel body.
  const patchAttempts: Array<{ path: string; body: Record<string, unknown> }> = [
    { path: `/business_registry_configurations/${encodeURIComponent(fiscalId)}`, body: { callbacks } },
    { path: '/business_registry_configurations', body: { fiscal_id: fiscalId, callbacks } },
  ]
  for (const attempt of patchAttempts) {
    try {
      const res = await fetch(`${BASE_URL}${attempt.path}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify(attempt.body),
      })
      const body = await res.text().catch(() => '')
      if (res.ok) {
        console.log('[sdi/openapi] callback aggiornati via PATCH', attempt.path)
        return
      }
      console.warn('[sdi/openapi] PATCH callback non riuscito:', attempt.path, res.status, body.slice(0, 300))
    } catch (err) {
      console.warn('[sdi/openapi] PATCH callback errore rete:', err)
    }
  }
  // 2) Ripiego: /api_configurations per singolo evento.
  for (const cb of callbacks) {
    try {
      const res = await fetch(`${BASE_URL}/api_configurations`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ event: cb.event, callback: { url: cb.url } }),
      })
      const body = await res.text().catch(() => '')
      if (res.ok) {
        console.log(`[sdi/openapi] callback '${cb.event}' registrato via /api_configurations`)
      } else if (res.status === 400 && /already|exist/i.test(body)) {
        // già registrato: ok
      } else {
        console.warn(`[sdi/openapi] registrazione callback '${cb.event}' non riuscita:`, res.status, body.slice(0, 300))
      }
    } catch (err) {
      console.warn(`[sdi/openapi] registrazione callback '${cb.event}' errore rete:`, err)
    }
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
          // ⚠️ Eventi GIUSTI per le fatture EMESSE (fix 23 lug — prima era
          // registrato SOLO 'supplier-invoice' = fatture RICEVUTE, per giunta
          // disattivate: l'esito non poteva mai arrivare):
          //   customer-notification = esito SdI (consegna/scarto) della fattura emessa
          //   customer-invoice      = eventi sulla fattura emessa
          callbacks: [
            { event: 'customer-notification', url: webhookUrl },
            { event: 'customer-invoice', url: webhookUrl },
          ],
        }),
      })
      if (!res.ok && res.status !== 409) {
        const body = await res.text().catch(() => '')
        // "Già esistente" = idempotente, ok. OpenAPI NON usa il 409: risponde
        // 400 con error 230 "You already have a business registry with this
        // fiscal id" (confermato in sandbox, 22 lug) → va trattato come successo.
        if (res.status === 400 && /already have a business registry/i.test(body)) {
          // Il profilo esiste già → i callback di QUESTA chiamata non sono
          // stati applicati. Best-effort: tenta di agganciarli via
          // /api_configurations (endpoint dedicato ai callback nella doc
          // OpenAPI). Qualunque esito viene LOGGATO: se lo schema differisce,
          // il messaggio d'errore nei log dice come correggerlo (metodo
          // iterativo sandbox). Non bloccante.
          await attachCallbacks(`IT${cedente.piva}`, webhookUrl)
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
      // CONFERMATO in sandbox (22 lug): il body è l'XML NUDO, dichiarato con
      // Content-Type application/xml (il wrapper JSON+base64 veniva parsato
      // come XML → 422 "Parsing error: malformed XML").
      const postXml = (path: string) =>
        fetch(`${BASE_URL}${path}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.OPENAPI_SDI_API_KEY}`,
            'Content-Type': 'application/xml',
            Accept: 'application/json',
          },
          body: xml,
        })
      type SdiResp = { id?: string; uuid?: string; message?: string; data?: { id?: string; uuid?: string } | Array<{ id?: string; uuid?: string }> }
      let res = await postXml('/invoices_legal_storage')
      let data = (await res.json().catch(() => ({}))) as SdiResp
      // L'endpoint dipende dai flag del profilo fiscale (firma/conservazione):
      // se non combacia, l'API indica quello giusto ("Please use: /<endpoint>")
      // → ritenta UNA volta sul path suggerito (robusto a config diverse).
      if (!res.ok && typeof data.message === 'string') {
        const suggested = data.message.match(/Please use:\s*(\/[a-z_]+)/i)?.[1]
        if (suggested) {
          res = await postXml(suggested)
          data = (await res.json().catch(() => ({}))) as SdiResp
        }
      }
      if (!res.ok) {
        console.error('[sdi/openapi] invio fallito:', res.status, JSON.stringify(data).slice(0, 300))
        return { ok: false, error: data.message ?? 'Invio allo SDI non riuscito. Riprova.' }
      }
      // L'UUID può stare al primo livello o dentro data (oggetto o array).
      const d = Array.isArray(data.data) ? data.data[0] : data.data
      const providerId = data.id ?? data.uuid ?? d?.id ?? d?.uuid
      if (!providerId) return { ok: false, error: 'Risposta del provider senza identificativo.' }
      return { ok: true, providerId: String(providerId), mock: false }
    } catch (err) {
      console.error('[sdi/openapi] invio errore rete:', err)
      return { ok: false, error: 'Il servizio di fatturazione non risponde. Riprova.' }
    }
  },

  async fetchEsito(providerId: string) {
    // Le notifiche SdI (RC/NS/MC/…) si leggono da GET /invoices_notifications
    // con l'UUID ricevuto all'invio (doc OpenAPI; confermato in sandbox il
    // 23 lug: le GET sulle rotte *_legal_storage NON esistono → il gateway
    // risponde 401 "Wrong Token" per metodo+path fuori da ogni scope).
    // Si provano le due varianti di firma note. Parsing TOLLERANTE
    // (lib/sdi/esito.ts): ciò che non si riconosce viene loggato per la
    // calibrazione in sandbox, e si risponde "ancora in attesa".
    const paths = [
      `/invoices_notifications/${providerId}`,
      `/invoices_notifications?uuid=${encodeURIComponent(providerId)}`,
    ]
    try {
      let saw401 = false
      for (const path of paths) {
        const res = await fetch(`${BASE_URL}${path}`, { headers: authHeaders() })
        if (res.status === 404 || res.status === 405) continue
        const body = await res.text().catch(() => '')
        if (!res.ok) {
          if (res.status === 401) saw401 = true
          console.warn('[sdi/openapi] fetchEsito fallito:', path, res.status, body.slice(0, 300))
          continue
        }
        let json: unknown = null
        try { json = JSON.parse(body) } catch { /* risposta non-JSON */ }
        const found = json ? extractNotificationEsito(json) : null
        if (found) return { ok: true as const, esito: found.esito, message: found.message }
        // Nessuna notifica riconosciuta = plausibilmente ancora in attesa.
        // Log del payload (troncato) per verificare in sandbox che la forma
        // sia davvero "senza notifiche" e non solo non riconosciuta.
        console.log('[sdi/openapi] esito non ancora presente (o forma non riconosciuta):', path, body.slice(0, 500))
        return { ok: true as const, esito: null, message: null }
      }
      // Il gateway OpenAPI risponde 401 anche per metodo+path fuori dagli
      // scope del token (verificato 23 lug): diagnosi onesta, non "non trovata".
      if (saw401) {
        return { ok: false as const, error: 'Il token del provider non ha i permessi di lettura (GET invoices_notifications): controlla gli scope del token nella console OpenAPI.' }
      }
      return { ok: false as const, error: 'La fattura non risulta presso il provider (endpoint non trovato).' }
    } catch (err) {
      console.error('[sdi/openapi] fetchEsito errore rete:', err)
      return { ok: false as const, error: 'Il servizio di fatturazione non risponde. Riprova.' }
    }
  },
}
