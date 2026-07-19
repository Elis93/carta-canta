import type { Metadata } from 'next'
import { BootScreen } from '@/components/shared/BootScreen'

// ── /avvio — pagina di partenza della PWA (feedback Eli 18 lug) ────────────
// Lo splash di sistema Android resta a schermo finché l'app non disegna il
// primo frame: se il server è a freddo, quel frame arrivava dopo SECONDI di
// splash statico e la schermata con lo spinner non si vedeva mai. Questa
// pagina è STATICA e viene PRECACHEATA dal service worker → all'apertura si
// disegna all'istante (splash di sistema via subito) e mostra marchio + nome +
// motto + spinner. 18 lug sera (istruzione esplicita Eli, supera "nessuna
// durata fissa"): resta ALMENO 3 secondi e nel frattempo SCALDA le pagine
// base, poi naviga verso l'app (/dashboard, o /login se sloggati).
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
      {/* Richiesta Eli 18 lug sera: la schermata resta ALMENO 3 secondi e in
          quei secondi SCALDA le pagine base (dashboard, preventivi, fatture,
          altro): il server le renderizza già ora (lambda + dati caldi) e la
          prima navigazione dopo il boot è molto più rapida. Poi si va alla
          Home; se il riscaldamento tarda, si parte comunque entro 8s.
          replace: /avvio non finisce nella cronologia. */}
      <script
        dangerouslySetInnerHTML={{
          __html:
            "(function(){var t0=Date.now();var warm=['/dashboard','/preventivi','/fatture','/altro'].map(function(u){return fetch(u,{credentials:'same-origin'}).catch(function(){})});Promise.race([Promise.all(warm),new Promise(function(r){setTimeout(r,8000)})]).then(function(){var left=3000-(Date.now()-t0);setTimeout(function(){window.location.replace('/dashboard')},left>0?left:0)})})()",
        }}
      />
    </>
  )
}
