// ============================================================
// CARTA CANTA — Logo fetcher + print helpers
// ============================================================

/**
 * Prepara l'HTML di buildPdfHtml() per la stampa browser.
 * - Inietta print-color-adjust: exact per forzare sfondi e colori anche
 *   quando "Grafica in background" non è spuntata nel dialogo di stampa.
 * - Se print=true: inietta window.print() on load (apre dialogo stampa).
 * - Se print=false: mostra il documento senza aprire il dialogo.
 */
export function preparePrintHtml(html: string, triggerPrint: boolean): string {
  const printCss = `<style>
@media print {
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
}
@media screen {
  /* Cornice da "lettore documenti" (feedback Eli 28 lug: "poco ordinato ed
     elegante"): grigio caldo coerente col brand, foglio con angoli
     arrotondati e ombra morbida. Solo schermo: la stampa resta pulita. */
  html, body { background: #e8e6e0; min-height: 100vh; }
  .page {
    background: #fff;
    margin: 16px auto 28px;
    border-radius: 10px;
    box-shadow: 0 1px 3px rgba(20,20,40,0.08), 0 10px 30px rgba(20,20,40,0.14);
  }
}
@media print {
  .page { border-radius: 0 !important; box-shadow: none !important; margin: 0 !important; }
}
</style>`
  // ── Viewport mobile ─────────────────────────────────────────
  // Il layout di buildPdfHtml è largo 210mm = 794px (A4 @ 96dpi).
  // 1. Se l'HTML non ha già un meta viewport, lo iniettiamo (width=794 →
  //    il browser mobile riduce la scala per far entrare tutto il foglio).
  // 2. Script (solo schermo, non tocca @media print): alcuni browser in-app
  //    (WhatsApp/Instagram WebView) ignorano lo shrink-to-fit implicito di
  //    "width=794" — forziamo initial-scale = larghezzaSchermo/794 così il
  //    documento appare intero, leggibile e zoomabile.
  const PAGE_W = 794
  const viewportMeta = html.includes('name="viewport"')
    ? ''
    : `<meta name="viewport" content="width=${PAGE_W}">`
  const viewportScript = `<script>
(function(){
  try{
    var w=${PAGE_W};
    var sw=Math.min(window.screen.width||w,window.outerWidth||w);
    if(sw>0&&sw<w){
      var s=(sw/w).toFixed(4);
      var m=document.querySelector('meta[name="viewport"]');
      if(!m){m=document.createElement('meta');m.setAttribute('name','viewport');document.head.appendChild(m);}
      m.setAttribute('content','width='+w+', initial-scale='+s+', minimum-scale='+s+', maximum-scale=5');
    }
  }catch(e){}
})();
</script>`
  // 3. Fallback GARANTITO: se il viewport meta viene ignorato (alcune WebView,
  //    browser in-app, iOS con pagina già renderizzata) la larghezza visibile
  //    resta quella del device (< 794px) → scaliamo il foglio via CSS transform.
  //    Se invece il viewport funziona, clientWidth = 794 e lo script non fa nulla.
  //    In stampa il transform viene rimosso (beforeprint + CSS di sicurezza).
  const fitScript = `<script>
(function(){
  var w=${PAGE_W};
  var pad=12; /* margine grigio ai lati del foglio (cornice viewer, 28 lug) */
  function fit(){
    try{
      var vw=document.documentElement.clientWidth;
      var pages=document.querySelectorAll('.page');
      for(var i=0;i<pages.length;i++){
        var p=pages[i];
        if(vw>0&&vw-pad*2<w-2){
          var s=(vw-pad*2)/w;
          p.style.transform='scale('+s+')';
          p.style.transformOrigin='top left';
          p.style.marginLeft=pad+'px';
          p.style.marginRight='0';
          p.style.marginBottom=((s-1)*p.offsetHeight+16)+'px';
        }else{
          p.style.transform='';p.style.marginLeft='';p.style.marginRight='';p.style.marginBottom='';
        }
      }
      if(vw>0&&vw-pad*2<w-2){document.documentElement.style.overflowX='hidden';}
    }catch(e){}
  }
  function reset(){
    var pages=document.querySelectorAll('.page');
    for(var i=0;i<pages.length;i++){var p=pages[i];p.style.transform='';p.style.marginLeft='';p.style.marginRight='';p.style.marginBottom='';}
  }
  window.addEventListener('resize',fit);
  window.addEventListener('load',fit);
  window.addEventListener('beforeprint',reset);
  window.addEventListener('afterprint',fit);
  fit();
})();
</script>`
  const printResetCss = `<style>@media print { .page { transform: none !important; } }</style>`
  const printScript = triggerPrint
    ? `<script>window.onload=function(){window.print()}</script>`
    : ''
  return html
    .replace('</head>', `${viewportMeta}${viewportScript}${printCss}${printResetCss}</head>`)
    .replace('</body>', `${fitScript}${printScript}</body>`)
}

/**
 * Scarica il logo all'URL indicato e lo restituisce come data-URI base64.
 * Timeout 5 s — se fallisce (URL non raggiungibile, errore di rete, ecc.)
 * restituisce null e buildPdfHtml() userà il placeholder SVG.
 */
export async function fetchLogoBase64(
  logoUrl: string | null | undefined,
): Promise<string | null> {
  if (!logoUrl) return null
  try {
    const response = await fetch(logoUrl, {
      signal: AbortSignal.timeout(5_000),
    })
    if (!response.ok) return null
    const buffer = await response.arrayBuffer()
    const contentType = response.headers.get('content-type') ?? 'image/png'
    return `data:${contentType};base64,${Buffer.from(buffer).toString('base64')}`
  } catch {
    return null
  }
}
