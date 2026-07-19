// ============================================================
// Proposte a livelli — controllo "Base = Premium identiche" lato SERVER.
// Il blocco client (PreventivoForm.getTierDuplicateError) copre i salvataggi
// manuali, ma l'AUTO-SAVE persiste senza validazione: una bozza con proposte
// identiche può quindi arrivare al Condividi del dettaglio. Questa guardia
// (stessa normalizzazione del client, insensibile all'ordine) chiude il varco
// al PRIMO INVIO (registerManualSendAction + send-email).
// Modulo PURO (niente 'use server': serve una funzione sincrona condivisa).
// ============================================================

const TIERS = ['base', 'consigliata', 'premium']

export function tierDuplicateSendError(items: Array<Record<string, unknown>>): string | null {
  const tierOf = (it: Record<string, unknown>) => {
    const t = String(it.option_tier ?? 'base')
    return TIERS.includes(t) ? t : 'base'
  }
  const norm = (tier: string) =>
    items
      .filter((it) => tierOf(it) === tier)
      .filter((it) =>
        String(it.description ?? '').trim() !== '' ||
        Number(it.unit_price ?? 0) > 0 ||
        Number(it.quantity ?? 0) > 0
      )
      .map((it) => [
        String(it.description ?? '').trim().toLowerCase(),
        Number(it.quantity ?? 0),
        Number(it.unit_price ?? 0),
        Number(it.discount_pct ?? 0),
        String(it.vat_rate ?? ''),
        String(it.unit ?? ''),
      ].join('§'))
      .sort()

  const base = norm('base')
  const premium = norm('premium')
  if (base.length === 0 || premium.length === 0) return null
  const identiche = base.length === premium.length && base.every((r, i) => r === premium[i])
  return identiche
    ? 'La proposta Base e la Premium sono identiche: cambia prezzi, descrizioni o voci in una delle due, oppure disattiva «Proponi più opzioni», prima di inviare.'
    : null
}
