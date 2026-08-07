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

/**
 * wa.me riesce a capire questo numero?
 *
 * ⚠️ Serve perché wa.me legge SEMPRE il numero come internazionale, senza
 * prefisso non indovina il paese: un fisso italiano "045 812345" o un mobile
 * svizzero "079 123 4567" salvato senza +41 diventerebbero un indirizzo
 * inesistente, e il bottone porterebbe a una pagina d'errore di WhatsApp.
 * Meglio non mostrarlo affatto che mostrarlo rotto.
 *
 * Passano solo i due casi in cui il paese è certo:
 *  · prefisso internazionale scritto per esteso (+41…, 0041…) — vale per
 *    QUALSIASI paese, quindi i clienti stranieri sono coperti;
 *  · mobile italiano (3xx), a cui `normalizePhoneForWhatsApp` mette il 39.
 *
 * (Regola nata il 3 ago sulle richieste dalla vetrina, dove i numeri fissi
 * mostravano un bottone rotto; qui è condivisa così vale ovunque.)
 */
export function whatsappUtilizzabile(phone: string | null | undefined): boolean {
  if (!phone) return false
  const num = normalizePhoneForWhatsApp(phone)
  if (!/^\d{8,15}$/.test(num)) return false
  return /^\s*(\+|00)/.test(phone) || /^393\d{9}$/.test(num)
}
