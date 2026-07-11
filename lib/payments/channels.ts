// ============================================================
// Canali di pagamento del workspace — tipi e helper CONDIVISI
// tra server (app/p/[token]/page.tsx) e client (PaymentInfoCard).
// ⚠️ NIENTE 'use client' qui: da un modulo client ogni export diventa
// una client reference e chiamarlo dal server fa crashare la pagina
// pubblica (bug reale: "Attempted to call hasPaymentChannels() from
// the server", /p/[token] rotto dal 6 lug).
// ============================================================

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
