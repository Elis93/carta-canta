// ============================================================
// LockVeil — velo anti-lampo del blocco app.
//
// PERCHÉ ESISTE (Eli 4 ago: "si vede la Home per un secondo prima del
// lucchetto"): AppLock decide in useLayoutEffect, che gira DOPO l'idratazione
// di React — ma il browser ha già dipinto l'HTML della Home arrivato dal
// server. Nessun hook può prevenire quel primo frame.
//
// Questo <script> INLINE gira invece mentre il browser sta ancora leggendo la
// pagina (blocca il parser, prima di qualsiasi disegno): applica la stessa
// decisione di AppLock e, se l'app va bloccata, mette la classe `cc-locked`
// su <html> → il CSS copre tutto con un fondo navy identico a quello del
// lucchetto. Quando AppLock monta prende il posto del velo senza stacchi.
//
// ⚠️ La logica QUI e quella nel useLayoutEffect di AppLock devono restare
// GEMELLE (chiavi, timeout, grazia cc_lock_nav): se divergono, si vede il
// velo navy e poi la Home — cioè lo stesso lampo, al contrario.
// ============================================================

export function LockVeil() {
  const code = `(function(){try{
var ls=localStorage;
var enabled=ls.getItem('cc_lock')==='1'||ls.getItem('cc_biometric')==='1';
if(!enabled)return;
var raw=ls.getItem('cc_biometric_timeout');
var allowed=[0,15,60,1440];
var t=raw==null?15:(allowed.indexOf(Number(raw))>=0?Number(raw):15);
var recentNav=false;
try{var nav=Number(sessionStorage.getItem('cc_lock_nav'));
recentNav=isFinite(nav)&&nav>0&&Date.now()-nav<300000;}catch(e){}
var last=Number(ls.getItem('cc_biometric_active')||0)||0;
if(!recentNav&&(t===0||Date.now()-last>=t*60000)){
document.documentElement.classList.add('cc-locked');
/* Paracadute: se React non parte (errore di rete/bundle), l'app non resta
   dietro un velo navy per sempre. */
setTimeout(function(){document.documentElement.classList.remove('cc-locked')},8000);
}}catch(e){}})()`
  return <script dangerouslySetInnerHTML={{ __html: code }} />
}
