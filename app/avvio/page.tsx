import type { Metadata } from 'next'
import { BootScreen } from '@/components/shared/BootScreen'

// ── /avvio — pagina di partenza della PWA (feedback Eli 18 lug) ────────────
// Lo splash di sistema Android resta a schermo finché l'app non disegna il
// primo frame: se il server è a freddo, quel frame arrivava dopo SECONDI di
// splash statico e la schermata con lo spinner non si vedeva mai. Questa
// pagina è STATICA e viene PRECACHEATA dal service worker → all'apertura si
// disegna all'istante (splash di sistema via subito), mostra marchio + nome +
// motto + spinner e nel frattempo naviga verso l'app vera (/dashboard, o
// /login se sloggati). Nessuna durata fissa: appena il server risponde, via.
// start_url del manifest → '/avvio'. In PUBLIC_PATHS del proxy.

export const dynamic = 'force-static'

export const metadata: Metadata = {
  title: 'Carta Canta',
  robots: { index: false, follow: false },
}

export default function AvvioPage() {
  return (
    <>
      <BootScreen />
      {/* Parte subito: la navigazione carica l'app mentre questa schermata
          resta visibile (lo spinner continua a girare fino al cambio pagina).
          replace: /avvio non finisce nella cronologia (il tasto indietro
          dall'app non deve tornare allo splash). */}
      <script
        dangerouslySetInnerHTML={{
          __html: "window.location.replace('/dashboard')",
        }}
      />
    </>
  )
}
