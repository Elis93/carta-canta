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
      {/* ⚠️ 2 ago (Eli: "mi lampeggia la pagina di login all'apertura"):
          le 4 fetch di riscaldamento partivano IN PARALLELO — con l'access
          token scaduto provavano a rinnovarlo tutte insieme, ma il refresh
          token RUOTA: la prima vince, le altre falliscono → redirect a
          /login e rimbalzo. Ora la PRIMA richiesta (/dashboard) va da sola
          e rinnova i cookie; le altre partono DOPO, già con i cookie nuovi.
          E la DESTINAZIONE la decide QUI la risposta della prima fetch
          (response.url): sloggati → dritti a /login, loggati → /dashboard.
          ⚠️ 3 ago (Eli: "vedo ancora la schermata di accesso per un
          secondo"): anche la PRIMA fetch può atterrare su /login per un
          fallimento TRANSITORIO del refresh → prima di mandare al login si
          RIPROVA una volta dopo 600ms coi cookie eventualmente rinnovati;
          solo se anche il secondo giro dice login si va a /login. */}
      <script
        dangerouslySetInnerHTML={{
          __html:
            "(function(){var t0=Date.now();var dest='/dashboard';function go(){var left=3000-(Date.now()-t0);setTimeout(function(){window.location.replace(dest)},left>0?left:0)}function isLogin(r){return !!(r&&r.url&&r.url.indexOf('/login')!==-1)}function warm(){return Promise.all(['/preventivi','/fatture','/altro'].map(function(u){return fetch(u,{credentials:'same-origin'}).catch(function(){})}))}var rest=fetch('/dashboard',{credentials:'same-origin'}).then(function(r){if(!isLogin(r))return warm();return new Promise(function(res){setTimeout(res,600)}).then(function(){return fetch('/dashboard',{credentials:'same-origin'})}).then(function(r2){if(isLogin(r2)){dest='/login';return}return warm()})}).catch(function(){});Promise.race([rest,new Promise(function(r){setTimeout(r,8000)})]).then(go)})()",
        }}
      />
    </>
  )
}
