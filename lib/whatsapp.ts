// ============================================================
// Normalizzazione numeri per i link wa.me — condivisa da TUTTE le
// superfici (pagina pubblica, dashboard, calendario, solleciti,
// rapportino). wa.me interpreta il numero come INTERNAZIONALE:
// "3331234567" senza prefisso diventa +33 (Francia) → chat sbagliata.
// I mobili italiani salvati senza +39 vanno quindi prefissati.
// ============================================================

export function normalizePhoneForWhatsApp(phone: string): string {
  // Rimuovi tutto tranne cifre e il + iniziale
  const stripped = phone.replace(/[^\d+]/g, '')
  // Già in formato internazionale con + → togli solo il +
  if (stripped.startsWith('+')) return stripped.slice(1)
  // Già con prefisso 00 → togli i due zero
  if (stripped.startsWith('00')) return stripped.slice(2)
  // Mobile italiano 3xx (10 cifre) → prependi 39
  if (/^3\d{9}$/.test(stripped)) return `39${stripped}`
  return stripped
}

/** Link wa.me con testo precompilato opzionale. */
export function waMeHref(phone: string, text?: string): string {
  const num = normalizePhoneForWhatsApp(phone)
  return text ? `https://wa.me/${num}?text=${encodeURIComponent(text)}` : `https://wa.me/${num}`
}
