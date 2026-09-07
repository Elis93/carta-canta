import type { ReactNode } from 'react'

/**
 * Il riquadro dei comandi sopra le liste Preventivi e Fatture (mobile).
 *
 * Eli, 6-7 set 2026: «cerca, tutti ecc., ordina devono essere in un riquadro
 * unico così che si capisca che il riquadro sotto sia dei preventivi creati»,
 * e «insieme ma comunque separati». Quindi: UNA card bianca, tre gruppi
 * divisi da un filetto — cerca · pillole di stato · Archivio/Cestino e
 * Ordina. Archivio e Ordina restano ai due capi della stessa riga (9 ago:
 * «erano e devono essere separate»), dentro l'ultimo gruppo.
 *
 * Solo mobile (`lg:hidden`): su desktop cerca e comandi stanno già su una
 * riga sola. I tasti «Da preventivo · Nuova fattura» delle Fatture restano
 * FUORI, sopra il riquadro: sono l'azione della pagina, non un filtro.
 */
export function ListaRiquadro({ cerca, tabs, comandi }: { cerca: ReactNode; tabs: ReactNode; comandi: ReactNode }) {
  return (
    <div className="cc-lista-riquadro lg:hidden">
      {cerca}
      <div className="cc-lista-hr" aria-hidden />
      {tabs}
      <div className="cc-lista-hr" aria-hidden />
      {comandi}
    </div>
  )
}
