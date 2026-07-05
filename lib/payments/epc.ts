// ── QR bonifico EPC/SEPA (standard EPC069-12, "Girocode") ──────────────────
// Il cliente inquadra il QR con l'app della sua banca e trova il bonifico
// già compilato: IBAN, beneficiario, importo e causale. Gratuito e standard,
// supportato dalle principali app bancarie italiane/EU.

import { normalizeIban } from './iban'

export interface EpcPayloadInput {
  iban: string
  beneficiary: string
  /** Importo in euro (opzionale — se assente il cliente lo digita) */
  amount?: number | null
  /** Causale non strutturata, max 140 caratteri */
  remittance?: string | null
}

export function buildEpcPayload({ iban, beneficiary, amount, remittance }: EpcPayloadInput): string {
  // Versione 002: il BIC è facoltativo (riga vuota)
  const lines = [
    'BCD',
    '002',
    '1',            // charset UTF-8
    'SCT',          // SEPA Credit Transfer
    '',             // BIC (facoltativo in v002)
    beneficiary.slice(0, 70),
    normalizeIban(iban),
    amount && amount > 0 ? `EUR${amount.toFixed(2)}` : '',
    '',             // purpose code
    '',             // structured remittance
    (remittance ?? '').slice(0, 140),
    '',             // beneficiary-to-originator info
  ]
  return lines.join('\n')
}

/** Genera il QR EPC come data-URL PNG (server-side) */
export async function buildEpcQrDataUrl(input: EpcPayloadInput): Promise<string | null> {
  try {
    const { toDataURL } = await import('qrcode')
    return await toDataURL(buildEpcPayload(input), {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 240,
      color: { dark: '#161616', light: '#ffffff' },
    })
  } catch {
    return null
  }
}
