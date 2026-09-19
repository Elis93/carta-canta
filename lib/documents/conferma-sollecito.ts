// ============================================================
// testoConfermaSollecito — LA frase di conferma prima che parta
// l'email di sollecito, uguale in tutte le superfici che la mandano
// (Home «In scadenza», card solleciti desktop, pagine Scadenze,
// menu «⋯» del documento).
//
// PERCHÉ ESISTE (Eli, 18 set — «app facile per un 70enne»): la busta
// invia l'email SUBITO, senza anteprima. Per chi tocca per esplorare
// («vediamo cosa fa») era l'unico punto dell'app dove un tocco di
// curiosità produceva un'email vera a un cliente. La conferma sta
// PRIMA dell'invio, ovunque; il menu «⋯» del documento la faceva
// già dal 5 set — questo helper unifica le parole.
//
// Col nome del cliente quando lo si conosce: dice A CHI parte, che è
// esattamente il dubbio da sciogliere prima di un invio irreversibile.
// ============================================================

export function testoConfermaSollecito(
  docType: 'preventivo' | 'fattura',
  clientName?: string | null
): string {
  const dest = clientName?.trim() ? `a ${clientName.trim()}` : 'al cliente'
  const cosa =
    docType === 'fattura'
      ? 'l’email di sollecito del pagamento'
      : 'l’email di sollecito'
  return `Mandare ora ${dest} ${cosa}? Parte subito, già scritta.`
}
