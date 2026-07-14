// ============================================================
// Estrazione dell'IP del client — per rate-limit e prove di firma (FES).
//
// ⚠️ ORDINE IMPORTANTE: `x-real-ip` è impostato dalla piattaforma (Vercel)
// e NON è falsificabile dal client. Il PRIMO elemento di `x-forwarded-for`
// invece è controllabile da chi fa la richiesta (basta inviare l'header):
// usarlo come primario permetteva di "ruotare" l'IP a ogni richiesta e
// aggirare i limiti per IP, o di inquinare l'IP salvato come prova.
// XFF resta solo come fallback per ambienti non-Vercel (es. dev locale).
// ============================================================

export function clientIpFrom(h: { get(name: string): string | null }): string | null {
  return (
    h.get('x-real-ip')?.trim() ||
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    null
  )
}
