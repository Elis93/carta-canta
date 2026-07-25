// ============================================================
// Validazione FORMALE della Partita IVA italiana.
//
// Perché serve (audit 25 lug + ricerca web): la P.IVA errata è tra le prime
// cause di SCARTO da parte del Sistema di Interscambio. Uno scarto consuma
// una trasmissione (e una quota), obbliga a correggere e ritrasmettere entro
// 5 giorni, e spaventa l'artigiano. Intercettare i typo PRIMA dell'invio
// costa una riga di codice e risparmia un giro completo.
//
// ⚠️ LIMITE dichiarato: questo controlla solo la FORMA (11 cifre + cifra di
// controllo). Una P.IVA formalmente valida ma CESSATA la può segnalare solo
// l'Agenzia delle Entrate — quello resta un possibile scarto legittimo.
// ============================================================

/**
 * Verifica la cifra di controllo della P.IVA italiana (algoritmo di Luhn
 * nella variante ministeriale, DM 23/12/1976).
 *
 * @param value P.IVA in qualsiasi formato (spazi/punti/prefisso IT ammessi)
 * @returns true se è formalmente valida
 */
export function isValidPivaFormat(value: string | null | undefined): boolean {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (digits.length !== 11) return false
  // Tutte cifre uguali (00000000000, 11111111111…): mai valide, ma la
  // formula del check digit le accetterebbe in alcuni casi.
  if (/^(\d)\1{10}$/.test(digits)) return false

  let sum = 0
  for (let i = 0; i < 10; i++) {
    const n = Number(digits[i])
    if (i % 2 === 0) {
      // posizioni dispari (1ª, 3ª, …): si sommano così come sono
      sum += n
    } else {
      // posizioni pari: raddoppiate, e se >9 si sottrae 9
      const doubled = n * 2
      sum += doubled > 9 ? doubled - 9 : doubled
    }
  }
  const check = (10 - (sum % 10)) % 10
  return check === Number(digits[10])
}
