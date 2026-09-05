// ============================================================
// Stili della PAGINA DEL DOCUMENTO (mockup «Pagina del documento
// riordinata», variante A scelta da Eli il 5 set 2026).
//
// UN sistema solo: due tipi di bottone (bianco bordato · navy pieno), un
// bottone quadrato per «⋯», un «soft» per l'azione di ritorno (Segna come
// non pagata), un «danger» per Elimina in fondo. Stesse misure ovunque:
// 46px, raggio 12. Prima le due pagine avevano NOVE vesti diverse di
// bottone bianco (inventario 26 ago).
// ============================================================
import type { CSSProperties } from 'react'

export const SH = '0 1px 2px rgba(20,20,40,.05), 0 8px 24px -10px rgba(20,20,40,.15)'

const base: CSSProperties = {
  boxSizing: 'border-box', height: 46, borderRadius: 12, minWidth: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
  fontSize: 14, fontWeight: 600, textDecoration: 'none', cursor: 'pointer',
  fontFamily: 'inherit', padding: '0 12px', whiteSpace: 'nowrap',
}

/** Bianco bordato, in riga (flex 1). */
export const btnBianco: CSSProperties = { ...base, flex: 1, background: '#fff', border: '1px solid #e7e7ea', color: '#1a1a2e', boxShadow: SH }
/** Navy pieno, in riga (flex 1): l'UNICO navy della pagina. */
export const btnNavy: CSSProperties = { ...base, flex: 1, background: '#1a1a2e', border: '1px solid #1a1a2e', color: '#fff', boxShadow: '0 6px 16px -6px rgba(26,26,46,.5)' }
/** Quadrato 46×46 per «⋯». */
export const btnQuadrato: CSSProperties = { ...btnBianco, flex: '0 0 46px', padding: 0 }
/** A tutta larghezza. */
export const btnBiancoPieno: CSSProperties = { ...btnBianco, flex: 'none', width: '100%' }
export const btnNavyPieno: CSSProperties = { ...btnNavy, flex: 'none', width: '100%' }
/** Azione di ritorno (es. «Segna come non pagata»): si vede e si tocca, ma non chiama l'occhio. */
export const btnSoft: CSSProperties = { ...base, width: '100%', height: 42, fontSize: 13, fontWeight: 500, background: '#fff', border: '1px solid #e7e7ea', color: '#55534b' }
/** Elimina, in fondo alla pagina sotto un filetto. */
export const btnDanger: CSSProperties = { ...base, width: '100%', background: '#fff', border: '1px solid #e7e7ea', color: '#b05656', fontWeight: 500 }

/** Riga del menu «⋯» (foglio dal basso): testo scuro, icona a sinistra. */
export const rigaMenu: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 11, width: '100%', minHeight: 48,
  padding: '12px 2px', borderBottom: '0.5px solid #eee', fontSize: 14, fontWeight: 500,
  color: '#161616', background: 'none', border: 'none', borderRadius: 0, boxShadow: 'none',
  textAlign: 'left', justifyContent: 'flex-start', cursor: 'pointer', fontFamily: 'inherit',
  textDecoration: 'none', boxSizing: 'border-box', height: 'auto', flex: 'none',
}
export const rigaMenuDanger: CSSProperties = { ...rigaMenu, color: '#b05656', borderBottom: 'none' }
