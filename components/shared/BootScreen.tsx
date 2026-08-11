// ── Schermata di avvio (senza durata fissa) ────────────────────────────────
// Marchio CC GRANDE nello stesso identico punto/taglia dell'icona dello splash
// di sistema Android, e sotto nome, motto e spinner: lo splash "si completa"
// mentre l'app carica. Usata in DUE punti:
//  - /avvio (pagina statica precacheata dal service worker → si disegna
//    all'ISTANTE anche a freddo, quando il server non ha ancora risposto);
//  - fallback Suspense del layout (app)/ (streaming, PR #125/#127).
// Server component puro (niente 'use client'): deve poter stare in una
// pagina statica.

export function BootScreen() {
  return (
    <div
      aria-label="Caricamento"
      className="cc-zoom-neutral"
      style={{ position: 'fixed', inset: 0, background: '#1a1a2e' }}
    >
      {/* Spinner autosufficiente: /avvio può essere servita dalla cache del
          SW con il CSS di una build precedente non più raggiungibile — le
          regole inline (identiche a globals.css) garantiscono che lo spinner
          giri comunque. */}
      <style>{`
        .cc-boot-spinner{width:36px;height:36px;border-radius:50%;border:3px solid rgba(201,164,76,.25);border-top-color:#c9a44c;animation:cc-boot-spin .8s linear infinite}
        @keyframes cc-boot-spin{to{transform:rotate(360deg)}}
      `}</style>
      {/* ⚠️ Il BLOCCO INTERO (marchio + nome + motto + spinner) sta al centro
          dello schermo, non il solo marchio (Eli, 11 ago: «vorrei fosse più
          centrata, ora è in basso»). Prima il marchio era ancorato a metà
          esatta e tutto il testo gli cadeva SOTTO: il gruppo finiva a circa
          il 62% dell'altezza, cioè visibilmente basso. */}
      <div
        style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 18, padding: 16, boxSizing: 'border-box',
        }}
      >
        <svg
          viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"
          style={{
            width: 'min(50vw, 26vh, 230px)', height: 'min(50vw, 26vh, 230px)',
            flexShrink: 0, marginBottom: 8,
          }}
        >
          <path d="M342 133 A150 150 0 1 0 342 379" fill="none" stroke="#c9a44c" strokeWidth="38" strokeLinecap="round" />
          <path d="M307 175 A96 96 0 1 0 307 337" fill="none" stroke="#f3ede0" strokeWidth="30" strokeLinecap="round" />
        </svg>
        <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 38, letterSpacing: '.01em' }}>
          <span style={{ color: '#f3ede0' }}>Carta </span>
          <span style={{ color: '#c9a44c' }}>Canta</span>
        </div>
        <div style={{ width: 140, height: 1, background: 'rgba(201,164,76,.5)', marginTop: -8 }} />
        <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: 'italic', fontSize: 19, color: '#c9a44c', marginTop: -6 }}>
          il tuo ufficio in tasca
        </div>
        <div className="cc-boot-spinner" style={{ marginTop: 6 }} />
      </div>
    </div>
  )
}
