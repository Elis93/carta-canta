'use client'

// ── Suggerimenti mentre scrivi la descrizione di una voce (11 ago 2026) ─────
//
// Richiesta Eli: «quando inserisco una nuova voce e questa esiste già nel
// catalogo o nei listini, vorrei che mi comparisse come suggerimento e io poi
// possa scegliere se inserirla o meno… alla prima lettera i primi dieci, poi
// sempre più mirati». Due pezzi:
//
//   · useFontiVoci() — carica UNA volta catalogo + listini (Pro) e li tiene
//     in memoria: il filtraggio per-lettera è locale e istantaneo, come il
//     ClientAutocomplete dei clienti (stesso schema FIX-18).
//   · SuggerimentiVociDropdown — la tendina sotto il campo, in PORTAL su
//     document.body con la classe cc-portal-float (regola B.2: un antenato
//     con transform/overflow taglierebbe una tendina non portata, e in
//     «Testo grande» serve il contro-zoom).
//
// 🔒 Regola B.2: unit_cost viaggia SOLO nel form dell'artigiano (margine
// privato) — mai su PDF, pagine pubbliche o email. La tendina non lo mostra.

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { BookOpen, Truck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { prezzoProposto } from '@/lib/fornitori/listino'
import type { FonteVoce } from '@/lib/documents/suggerimenti-voce'

// Tipi locali per le tabelle 063 (non ancora in types/database.ts),
// come in CatalogPicker.
type SupplierList = { id: string; name: string; markup_pct: number | null }
type SupplierItem = { list_id: string; code: string | null; description: string; unit: string; unit_cost: number }

/**
 * Carica le fonti dei suggerimenti al primo bisogno (chiamare carica() al
 * focus del campo descrizione). Idempotente: la seconda chiamata non rifà
 * nulla. Tollerante: un errore di rete lascia le fonti vuote e la tendina
 * semplicemente non compare — scrivere a mano resta sempre possibile.
 */
export function useFontiVoci(): { fonti: FonteVoce[]; carica: () => void } {
  const [fonti, setFonti] = useState<FonteVoce[]>([])
  const avviato = useRef(false)

  const carica = useCallback(() => {
    if (avviato.current) return
    avviato.current = true
    const supabase = createClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- plan non serve nei types qui
    const wsQuery = (supabase.from('workspaces').select('plan') as any).limit(1).maybeSingle()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelle 063 non ancora in types/database.ts
    const listsQuery = (supabase as any)
      .from('supplier_lists')
      .select('id, name, markup_pct')
      .then((r: { data: SupplierList[] | null }) => r.data ?? [], () => [] as SupplierList[])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- vedi sopra
    const supItemsQuery = (supabase as any)
      .from('supplier_list_items')
      .select('list_id, code, description, unit, unit_cost')
      .then((r: { data: SupplierItem[] | null }) => r.data ?? [], () => [] as SupplierItem[])

    Promise.all([
      supabase.from('catalog_items').select('*').eq('is_active', true).order('name'),
      wsQuery,
      listsQuery,
      supItemsQuery,
    ]).then(([catalogRes, wsRes, lists, supItems]) => {
      const out: FonteVoce[] = []

      // Prima il CATALOGO: a parità di voce il doppione del listino sparisce
      // e resta quella di catalogo (dedupe in suggerisciVoci, ordine stabile).
      for (const item of catalogRes.data ?? []) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- unit_cost (062) non ancora in types
        const rawCost = (item as any).unit_cost
        out.push({
          descrizione: item.description ?? item.name,
          alias: item.name,
          unit: item.unit,
          unit_price: Number(item.unit_price),
          vat_rate: item.vat_rate != null ? Number(item.vat_rate) : null,
          unit_cost: rawCost != null ? Number(rawCost) : null,
          supplier_list_id: null,
          fonte: 'catalogo',
        })
      }

      // Poi i LISTINI — solo Pro, come la linguetta del CatalogPicker: a un
      // Free i listini non si offrono, nemmeno di sponda dai suggerimenti.
      const isPro = ((wsRes as { data?: { plan?: string } | null }).data?.plan ?? 'free') !== 'free'
      if (isPro) {
        const listById = new Map((lists as SupplierList[]).map((l) => [l.id, l]))
        for (const item of supItems as SupplierItem[]) {
          const list = listById.get(item.list_id)
          if (!list) continue
          const proposto = prezzoProposto(
            Number(item.unit_cost),
            list.markup_pct != null ? Number(list.markup_pct) : null,
          )
          out.push({
            descrizione: item.description,
            alias: item.code,
            unit: item.unit || 'pz',
            // Senza ricarico impostato il prezzo resta 0 = «da prezzare»,
            // mai inventato (stessa regola del CatalogPicker).
            unit_price: proposto ?? 0,
            vat_rate: null,
            unit_cost: Number(item.unit_cost),
            supplier_list_id: list.id,
            fonte: 'listino',
            fonteNome: list.name,
          })
        }
      }

      setFonti(out)
    }, () => { /* rete giù: nessun suggerimento, il campo resta libero */ })
  }, [])

  return { fonti, carica }
}

interface DropdownProps {
  /** Il riquadro della descrizione (bordo): dà posizione e larghezza alla tendina */
  anchorEl: HTMLElement | null
  risultati: FonteVoce[]
  /** Indice evidenziato dalle frecce (−1 = nessuno) */
  attivo: number
  onPick: (f: FonteVoce) => void
  /** Ref della lista: serve al chiamante per riconoscere il blur "interno" */
  listRef: React.RefObject<HTMLUListElement | null>
}

export function SuggerimentiVociDropdown({ anchorEl, risultati, attivo, onPick, listRef }: DropdownProps) {
  const [rect, setRect] = useState<DOMRect | null>(null)

  // Come useAnchorRect, ma sull'ELEMENTO (l'ancora cambia quando il fuoco
  // passa a un'altra voce, e un ref condiviso non rifarebbe partire l'effetto).
  useEffect(() => {
    if (!anchorEl) { setRect(null); return }
    const update = () => setRect(anchorEl.getBoundingClientRect())
    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [anchorEl])

  if (!anchorEl || !rect || risultati.length === 0) return null

  return createPortal(
    <ul
      ref={listRef}
      data-dropdown-portal
      style={{ position: 'fixed', left: rect.left, top: rect.bottom + 4, width: rect.width, zIndex: 9999, pointerEvents: 'auto' }}
      className="cc-portal-float max-h-60 overflow-y-auto rounded-md border bg-popover shadow-md"
      aria-label="Voci suggerite dal catalogo"
    >
      {risultati.map((f, i) => (
        <li key={`${f.fonte}-${f.supplier_list_id ?? 'cat'}-${f.descrizione}-${f.unit_price}`}>
          <button
            type="button"
            className="w-full text-left px-3 py-2 flex items-center gap-3 border-b last:border-0"
            style={{ background: i === attivo ? '#f2f1ec' : undefined }}
            // onMouseDown + preventDefault: il tocco NON toglie il fuoco al
            // campo, quindi il blur non chiude la tendina prima del click
            // (stesso schema di ClientAutocomplete).
            onMouseDown={(e) => { e.preventDefault(); onPick(f) }}
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{f.descrizione}</p>
              <p className="text-[11px] text-muted-foreground truncate mt-0.5" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {f.fonte === 'catalogo'
                  ? <><BookOpen size={11} style={{ flexShrink: 0 }} /> Catalogo</>
                  : <><Truck size={11} style={{ flexShrink: 0 }} /> Listino{f.fonteNome ? ` · ${f.fonteNome}` : ''}</>}
              </p>
            </div>
            <span className="shrink-0 text-right">
              {f.unit_price > 0 ? (
                <span className="text-sm font-semibold tabular-nums">
                  {f.unit_price.toLocaleString('it-IT', { minimumFractionDigits: 2 })} €<span className="text-[11px] font-normal text-muted-foreground">/{f.unit}</span>
                </span>
              ) : (
                <span className="text-[11px]" style={{ color: '#8a6a2f' }}>prezzo da fare</span>
              )}
            </span>
          </button>
        </li>
      ))}
    </ul>,
    document.body,
  )
}
