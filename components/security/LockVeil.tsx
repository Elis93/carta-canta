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
//
// ⚠️⚠️ IL VELO NON SI TOGLIE MAI DA SOLO (bug trovato da Eli il 7 ago 2026 su
// una connessione lenta). Prima c'era un "paracadute" che dopo 8 secondi
// faceva `classList.remove('cc-locked')` per non lasciare l'app dietro un velo
// navy se React non fosse partito. Ma rimuovere il velo SCOPRE LA HOME: con
// una rete lenta il pacchetto JS arrivava dopo, e per qualche secondo la Home
// era visibile e scorrevole SENZA che nessuno avesse chiesto l'impronta —
// poi compariva il lucchetto. Riprodotto in Chromium simulando l'idratazione
// a 12 secondi: a t=9s la Home era leggibile.
// Ora il paracadute FALLISCE CHIUSO: l'app resta coperta e compare un avviso
// dentro il velo con il modo per riprovare. Meglio un utente che ricarica di
// un utente che si trova i propri dati (e quelli dei suoi clienti) scoperti.
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
var el=document.documentElement;
el.classList.add('cc-locked');
/* Rete lenta: dopo 10s l'app resta COPERTA e si spiega perche'. Il velo lo
   toglie solo AppLock quando prende il suo posto (vero lucchetto). */
setTimeout(function(){
if(!el.classList.contains('cc-locked'))return;
if(document.getElementById('cc-lock-fallback'))return;
var d=document.createElement('div');
d.id='cc-lock-fallback';
d.innerHTML='<p>Connessione lenta<\\/p><p>Sto ancora caricando il blocco dell&rsquo;app. I tuoi dati restano coperti.<\\/p><button type="button">Riprova<\\/button>';
d.querySelector('button').addEventListener('click',function(){location.reload()});
document.body.appendChild(d);
},10000);
}}catch(e){}})()`
  return <script dangerouslySetInnerHTML={{ __html: code }} />
}
