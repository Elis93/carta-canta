'use client'

// ============================================================
// PaymentInfoCard — riquadro "Come pagare" sulla pagina pubblica
// (Pagamenti Fase 1 — mockup ciclo incasso 2b)
// Bonifico (IBAN copiabile + causale + QR EPC) · PayPal · Satispay · note.
// Compare solo se l'artigiano ha compilato almeno un canale.
// ============================================================

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { formatIban } from '@/lib/payments/iban'

export interface PaymentChannels {
  iban: string | null
  ibanHolder: string | null
  paypalUrl: string | null
  satispayUrl: string | null
  notes: string | null
}

export function hasPaymentChannels(p: PaymentChannels | null): boolean {
  return !!(p && (p.iban || p.paypalUrl || p.satispayUrl || p.notes))
}

export function PaymentInfoCard({
  channels,
  causale,
  qrDataUrl,
}: {
  channels: PaymentChannels
  /** Es. "Fattura 014/2026" — mostrata sotto l'IBAN e precompilata nel QR */
  causale: string
  /** QR bonifico EPC (data URL) — presente solo se c'è l'IBAN */
  qrDataUrl?: string | null
}) {
  const [copied, setCopied] = useState(false)

  async function copyIban() {
    if (!channels.iban) return
    try {
      await navigator.clipboard.writeText(channels.iban)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch { /* clipboard non disponibile */ }
  }

  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: 14, boxShadow: '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)' }}>
      <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: '#6f6d64', marginBottom: 10 }}>
        Come pagare
      </div>

      {channels.iban && (
        <>
          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: '#8a887f', marginBottom: 6 }}>
            Bonifico bancario
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f7f7f8', border: '0.5px solid #e6e6e6', borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#161616', wordBreak: 'break-all' }}>{formatIban(channels.iban)}</div>
              <div style={{ fontSize: 11, color: '#8a887f', marginTop: 2 }}>
                {[channels.ibanHolder, `causale: ${causale}`].filter(Boolean).join(' · ')}
              </div>
            </div>
            <button
              type="button"
              onClick={copyIban}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: '1px solid #e3e3e6', borderRadius: 8, padding: '5px 10px', fontSize: 12, fontWeight: 600, color: copied ? '#2f8a63' : '#1a1a2e', background: '#fff', whiteSpace: 'nowrap', cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit' }}
            >
              {copied ? <><Check size={13} /> Copiato</> : <><Copy size={13} /> Copia</>}
            </button>
          </div>

          {qrDataUrl && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- data URL locale, niente ottimizzazione */}
              <img src={qrDataUrl} alt="QR code bonifico" width={92} height={92} style={{ borderRadius: 8, border: '1px solid #ececef', flexShrink: 0 }} />
              <p style={{ fontSize: 12, color: '#767676', lineHeight: 1.55 }}>
                <b style={{ color: '#55534b' }}>Paga col QR:</b>{' '}inquadralo con l&rsquo;app della tua banca
                e trovi il bonifico già compilato con importo e causale. Confermi e basta.
              </p>
            </div>
          )}
        </>
      )}

      {(channels.paypalUrl || channels.satispayUrl) && (
        <div style={{ display: 'flex', gap: 9, marginTop: channels.iban ? 12 : 0 }}>
          {channels.paypalUrl && (
            <a
              href={channels.paypalUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ flex: 1, height: 44, border: '1px solid #e7e7ea', borderRadius: 12, background: '#fff', color: '#1a1a2e', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, textDecoration: 'none', boxShadow: '0 1px 2px rgba(20,20,40,.05)' }}
            >
              PayPal
            </a>
          )}
          {channels.satispayUrl && (
            <a
              href={channels.satispayUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ flex: 1, height: 44, border: '1px solid #e7e7ea', borderRadius: 12, background: '#fff', color: '#1a1a2e', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, textDecoration: 'none', boxShadow: '0 1px 2px rgba(20,20,40,.05)' }}
            >
              Satispay
            </a>
          )}
        </div>
      )}

      {channels.notes && (
        <p style={{ fontSize: 12, color: '#767676', lineHeight: 1.5, marginTop: 10 }}>{channels.notes}</p>
      )}
    </div>
  )
}
