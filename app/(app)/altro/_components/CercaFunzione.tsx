'use client'

// ============================================================
// «Cerca una funzione» — in cima ad Altro (Eli, 7 ago 2026).
//
// Cerca SOLO funzioni e pagine, non documenti né clienti: per quelli ci sono
// già le ricerche dentro Preventivi e Fatture, che sanno filtrare anche per
// stato. Il dizionario e il motore stanno in `lib/app-search.ts`.
//
// ⚠️ Il campo è `font-size: 16` per forza: sotto i 16px iOS ingrandisce la
// pagina da solo al primo tocco e non la rimpicciolisce più.
//
// ⚠️ Quando non trova nulla NON resta muto: dice cosa si può cercare e offre
// l'aiuto. È il momento in cui un cerca perde la fiducia di chi lo usa.
// ============================================================

import { useState } from 'react'
import Link from 'next/link'
import { Search, X, ChevronRight } from 'lucide-react'
import { cercaFunzioni } from '@/lib/app-search'

export function CercaFunzione() {
  const [q, setQ] = useState('')
  const risultati = cercaFunzioni(q)
  const cercando = q.trim().length >= 2

  return (
    <div data-tour="altro-cerca">
      <div style={{ position: 'relative' }}>
        <Search
          size={17}
          style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--cc-muted)', pointerEvents: 'none' }}
          aria-hidden
        />
        {/* ⚠️ `type="text"`, non `type="search"`: il tipo search fa comparire
            la X NATIVA del browser accanto alla nostra, e si vedono due croci
            una in fianco all'altra (verificato in Chromium). */}
        <input
          type="text"
          inputMode="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cerca una funzione"
          aria-label="Cerca una funzione nell’app"
          enterKeyHint="search"
          style={{
            width: '100%', boxSizing: 'border-box',
            border: '1px solid #e3e3e6', borderRadius: 12, background: '#fff',
            padding: '12px 38px 12px 38px', fontSize: 16, color: '#161616',
            outline: 'none', fontFamily: 'inherit',
          }}
        />
        {q !== '' && (
          <button
            type="button"
            onClick={() => setQ('')}
            aria-label="Cancella la ricerca"
            style={{
              position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
              width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: 'none', background: 'none', color: 'var(--cc-muted)', cursor: 'pointer', padding: 0,
            }}
          >
            <X size={17} />
          </button>
        )}
      </div>

      {cercando && risultati.length > 0 && (
        <div
          className="cc-card"
          style={{ marginTop: 10, borderRadius: 13, boxShadow: '0 1px 2px rgba(20,20,40,.05), 0 8px 24px -10px rgba(20,20,40,.15)', padding: '2px 14px' }}
        >
          {risultati.map((v, i) => (
            <Link
              key={v.label}
              href={v.href}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0',
                borderBottom: i < risultati.length - 1 ? '0.5px solid #f0f0f0' : 'none',
                textDecoration: 'none', color: 'inherit',
              }}
            >
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#161616' }}>
                  {v.label}
                </span>
                <span style={{ display: 'block', fontSize: 12, color: 'var(--cc-muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {v.dove}{v.desc ? ` · ${v.desc}` : ''}
                </span>
              </span>
              <ChevronRight size={16} strokeWidth={1.5} style={{ color: 'var(--cc-muted)', flexShrink: 0 }} aria-hidden />
            </Link>
          ))}
        </div>
      )}

      {cercando && risultati.length === 0 && (
        <div
          className="cc-card"
          style={{ marginTop: 10, borderRadius: 13, boxShadow: '0 1px 2px rgba(20,20,40,.05), 0 8px 24px -10px rgba(20,20,40,.15)', padding: '13px 14px' }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, color: '#161616' }}>
            Nessuna funzione con questo nome
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--cc-muted)', margin: '5px 0 0', lineHeight: 1.5 }}>
            Qui si cercano le <b>funzioni dell&rsquo;app</b>{' '}— prova con &laquo;iban&raquo;,
            &laquo;cestino&raquo;, &laquo;impronta&raquo;, &laquo;listino&raquo;. Per trovare un{' '}
            <b>cliente</b>{' '}o un <b>documento</b>{' '}usa la ricerca dentro Preventivi, Fatture o
            Clienti.
          </p>
          <Link
            href="/aiuto"
            style={{ display: 'inline-block', marginTop: 9, fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}
          >
            Vai all&rsquo;aiuto &rarr;
          </Link>
        </div>
      )}
    </div>
  )
}
