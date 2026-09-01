'use client'

// ============================================================
// Cerca dentro le domande frequenti (Eli, 8 ago: *"voglio un cerca dentro ad
// aiuto così da trovare le domande più velocemente"*).
//
// Le domande sono più di trenta: scorrerle tutte per trovarne una è
// esattamente il motivo per cui uno rinuncia e scrive all'assistenza.
//
// ⚠️ DUE scelte, le stesse del cerca delle funzioni in «Altro»:
//
//  1. **Ogni parola digitata deve trovare riscontro** — più parole
//     RESTRINGONO, non allargano. Senza, «eliminare fattura» risponderebbe
//     con tutto ciò che contiene «fattura», cioè quasi tutto.
//  2. **Si cerca nel testo della DOMANDA e nelle parole chiave scritte a mano**,
//     non nella risposta: una parola persa in fondo a una risposta lunga
//     porterebbe a galla domande che non c'entrano.
//
// Quando non trova nulla lo dice e rimanda al contatto diretto, invece di
// restare muto.
// ============================================================

import { useEffect, useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'

export interface VoceFaq {
  q: string
  a: React.ReactNode
  /** Parole dell'artigiano che non compaiono nel titolo della domanda */
  parole?: string[]
  /** Ancora stabile per i deep-link (/aiuto#slug): la domanda si apre da sola */
  id?: string
}

function normalizza(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function CercaFaq({ voci }: { voci: VoceFaq[] }) {
  const [q, setQ] = useState('')

  // Deep-link (Eli 26 ago: «quando clicco su vai a Domande frequenti, mi si
  // apre già la domanda con la risposta completa»): arrivando con
  // /aiuto#slug la voce corrispondente si APRE e si scrolla a schermo.
  // ⚠️ Si agisce sul DOM (`.open = true`), NON con la prop `open` di React:
  // una prop controllata impedirebbe all'utente di richiuderla al prossimo
  // re-render. Doppio rAF: si parte a contenuto dipinto (schema ScrollToHash).
  useEffect(() => {
    const slug = window.location.hash.slice(1)
    if (!slug || !voci.some((v) => v.id === slug)) return
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const el = document.getElementById(slug) as HTMLDetailsElement | null
      if (!el) return
      el.open = true
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }))
  }, [voci])

  const indice = useMemo(
    () => voci.map((v) => normalizza([v.q, ...(v.parole ?? [])].join(' '))),
    [voci],
  )

  const risultati = useMemo(() => {
    const parole = normalizza(q).split(' ').filter(Boolean)
    if (parole.length === 0) return voci.map((_, i) => i)
    return voci.map((_, i) => i).filter((i) => parole.every((p) => indice[i].includes(p)))
  }, [q, voci, indice])

  const filtrando = normalizza(q).length > 0

  return (
    <>
      <div style={{ position: 'relative', margin: '4px 0 6px' }}>
        <Search
          size={16}
          aria-hidden
          style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--cc-muted)' }}
        />
        <input
          // ⚠️ type="text" + inputMode, NON type="search": quest'ultimo
          // aggiunge la X nativa del browser accanto alla nostra (due croci
          // affiancate). Font 16px: sotto, iOS ingrandisce la pagina al fuoco.
          type="text"
          inputMode="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cerca una domanda…"
          aria-label="Cerca fra le domande frequenti"
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '10px 34px 10px 34px',
            border: '1px solid #e7e7ea', borderRadius: 11, background: '#fdfdfc',
            fontSize: 16, color: '#161616', fontFamily: 'inherit', outline: 'none',
          }}
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ('')}
            aria-label="Cancella la ricerca"
            style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'none', color: 'var(--cc-muted)', cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
        )}
      </div>

      {filtrando && (
        <p style={{ fontSize: 12, color: 'var(--cc-muted)', margin: '0 0 4px' }}>
          {risultati.length === 0
            ? 'Nessuna domanda con queste parole.'
            : `${risultati.length} domand${risultati.length === 1 ? 'a' : 'e'} su ${voci.length}`}
        </p>
      )}

      {risultati.map((i, pos) => (
        <details
          key={voci[i].q}
          id={voci[i].id}
          open={filtrando && risultati.length <= 3}
          style={{ borderBottom: pos < risultati.length - 1 ? '0.5px solid #eee' : 'none', scrollMarginTop: 78 }}
        >
          <summary style={{ padding: '11px 0', fontSize: 14, fontWeight: 600, color: '#161616', cursor: 'pointer', listStyle: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            {voci[i].q}
            <span aria-hidden style={{ color: '#c2c1bd', flexShrink: 0 }}>▾</span>
          </summary>
          <p style={{ fontSize: 13, color: '#55534b', lineHeight: 1.6, margin: '0 0 12px' }}>{voci[i].a}</p>
        </details>
      ))}

      {filtrando && risultati.length === 0 && (
        <p style={{ fontSize: 13, color: '#55534b', lineHeight: 1.6, margin: '6px 0 10px' }}>
          Prova con una parola sola (per esempio <b>cestino</b>, <b>iban</b>, <b>scadenza</b>).
          Se non trovi la risposta, scrivici: c&rsquo;è l&rsquo;email qui sopra e ti rispondiamo noi.
        </p>
      )}
    </>
  )
}
