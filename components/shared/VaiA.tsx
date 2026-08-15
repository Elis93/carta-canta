// ============================================================
// VaiA — il rimando a un'altra parte dell'app è un COLLEGAMENTO, non una frase.
//
// PERCHÉ (richiesta Eli, 7 ago 2026): "le frasi lunghe dove si indica come
// arrivare a un'altra sezione, voglio che in tutta la app siano sostituite o
// accorciate con i link diretti".
//
// Prima, in mezzo ai testi, si leggevano percorsi scritti a mano —
// «Altro › Account e dati › Scarica i tuoi dati» — che l'utente doveva
// ricostruire tocco per tocco. Due difetti: si legge male su un telefono, e
// invecchia in silenzio (se una voce di menu cambia nome, la frase resta
// sbagliata e nessun controllo se ne accorge).
//
// ⚠️ REGOLA: quando un testo indica dove andare, si usa questo componente.
// Niente più percorsi con le frecce scritti dentro le frasi.
// ============================================================

import Link from 'next/link'

/** Le destinazioni citate nei testi, in un posto solo: se una rotta cambia
 *  si corregge qui e non in venti frasi sparse. */
export const DESTINAZIONI = {
  catalogo:        { href: '/catalogo',                    label: 'Catalogo e listini' },
  listini:         { href: '/catalogo/fornitori',          label: 'Listini fornitori' },
  strumenti:       { href: '/altro',                       label: 'Strumenti' },
  calcoli:         { href: '/calcoli',                     label: 'Calcoli' },
  account:         { href: '/account',                     label: 'Account e abbonamento' },
  sicurezza:       { href: '/account/sicurezza',       label: 'Sicurezza e blocco app' },
  vetrina:         { href: '/farti-trovare',               label: 'Vetrina' },
  recensioni:      { href: '/recensioni',                  label: 'Recensioni' },
  abbonamento:     { href: '/abbonamento',                 label: 'Abbonamento' },
  bilancio:        { href: '/bilancio',                    label: 'Bilancio' },
  cestino:         { href: '/cestino',                     label: 'Cestino' },
  daTrasmettere:   { href: '/fatture/da-trasmettere',      label: 'Fatture da trasmettere' },
  impGenerale:     { href: '/impostazioni/generale',   label: 'Impostazioni' },
  impFiscale:      { href: '/impostazioni/fiscale',    label: 'Impostazioni fiscali' },
  impPagamenti:    { href: '/impostazioni/pagamenti',  label: 'Come farti pagare' },
  impNotifiche:    { href: '/impostazioni/notifiche',  label: 'Notifiche' },
} as const

export type Destinazione = keyof typeof DESTINAZIONI

/**
 * Collegamento a una sezione dell'app, con la grafica dei rimandi (navy,
 * semigrassetto) già usata nelle FAQ.
 *
 * `<VaiA a="account" />` → «Account e dati»
 * `<VaiA a="account">Scarica i tuoi dati</VaiA>` → etichetta su misura
 */
export function VaiA({ a, children }: { a: Destinazione; children?: React.ReactNode }) {
  const d = DESTINAZIONI[a]
  return (
    <Link href={d.href} style={{ color: '#1a1a2e', fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 2 }}>
      {children ?? d.label}
    </Link>
  )
}
