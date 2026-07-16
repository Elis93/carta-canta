'use client'

// ============================================================
// ImportWizard — AI Import del listino nel catalogo (mockup ai_import).
// 1. Carica foto/PDF → 2. l'AI estrae le voci → 3. anteprima con righe
//    MODIFICABILI (decisione Eli: si corregge, non si butta) → 4. salva.
// L'import si conta solo al salvataggio (lato server).
// ============================================================

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { importCatalogItemsAction } from '@/app/(app)/catalogo/actions'
import { parseImportoIt } from '@/lib/utils'

interface DraftItem {
  key: number
  name: string
  unit: string
  price: string       // formato it-IT modificabile
  vat: string         // '' = nessuna
  category: string
  confidence: number
}

const SH = '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)'

const fieldStyle: React.CSSProperties = {
  border: '1px solid #e3e3e6',
  borderRadius: 8,
  padding: '6px 8px',
  fontSize: 13,
  fontFamily: 'inherit',
  color: '#161616',
  background: '#fff',
  boxSizing: 'border-box',
  width: '100%',
}


export function ImportWizard({ isPro, remaining, proMonthly }: { isPro: boolean; remaining: number; proMonthly: number }) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [phase, setPhase] = useState<'upload' | 'extracting' | 'preview' | 'saving'>('upload')
  const [items, setItems] = useState<DraftItem[]>([])
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File) {
    setError(null)
    setPhase('extracting')
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/ai/extract', { method: 'POST', body: formData })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Elaborazione non riuscita. Riprova.')
        setPhase('upload')
        return
      }
      const extracted = (data.items ?? []) as Array<{
        description: string
        unit?: string
        unit_price?: number
        vat_rate?: number | null
        confidence?: number
      }>
      if (extracted.length === 0) {
        setError('Nessuna voce trovata nel documento. Prova con una foto più nitida.')
        setPhase('upload')
        return
      }
      setItems(
        extracted.map((it, i) => ({
          key: i,
          name: it.description ?? '',
          unit: it.unit || 'pz',
          price: (it.unit_price ?? 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          vat: it.vat_rate != null ? String(it.vat_rate) : '',
          category: '',
          confidence: it.confidence ?? 0.5,
        }))
      )
      setPhase('preview')
    } catch {
      setError('Errore di rete. Controlla la connessione e riprova.')
      setPhase('upload')
    }
  }

  function updateItem(key: number, patch: Partial<DraftItem>) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)))
  }

  async function handleSave() {
    setError(null)
    const valid = items.filter((it) => it.name.trim() !== '')
    if (valid.length === 0) {
      setError('Nessuna voce da salvare.')
      return
    }
    for (const it of valid) {
      const p = parseImportoIt(it.price)
      if (!Number.isFinite(p) || p < 0) {
        setError(`Prezzo non valido per "${it.name.trim().slice(0, 40)}".`)
        return
      }
    }
    setPhase('saving')
    const payload = valid.map((it) => ({
      name: it.name.trim(),
      unit: it.unit.trim() || 'pz',
      unit_price: parseImportoIt(it.price),
      vat_rate: it.vat !== '' ? Number(it.vat) : null,
      category: it.category.trim() || null,
    }))
    let result: Awaited<ReturnType<typeof importCatalogItemsAction>>
    try {
      result = await importCatalogItemsAction(payload)
    } catch {
      setError('Errore di rete durante il salvataggio. Le voci sono ancora qui: riprova.')
      setPhase('preview')
      return
    }
    if (result.error) {
      setError(result.error)
      setPhase('preview')
      return
    }
    toast.success(result.count === 1 ? '1 voce aggiunta al catalogo' : `${result.count} voci aggiunte al catalogo`, {
      description: 'Da ora le trovi in "Da catalogo" quando fai un preventivo.',
      closeButton: true,
    })
    router.push('/catalogo')
    router.refresh()
  }

  // ── Fase 1/2: upload ──────────────────────────────────────────────────
  if (phase === 'upload' || phase === 'extracting') {
    return (
      <div style={{ padding: '14px 15px 16px' }}>
        {/* Un SOLO controllo di upload: la dropzone (feedback Eli — niente
            doppi tasti). Durante l'estrazione mostra lo stato al suo interno. */}
        <div
          role="button"
          tabIndex={0}
          aria-label="Scatta una foto o carica un PDF"
          aria-busy={phase === 'extracting'}
          onClick={() => { if (phase !== 'extracting') fileRef.current?.click() }}
          onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && phase !== 'extracting') { e.preventDefault(); fileRef.current?.click() } }}
          style={{
            border: '1.5px dashed #d7d4cb', background: '#fbfbfa', borderRadius: 14,
            textAlign: 'center', padding: '30px 14px', cursor: phase === 'extracting' ? 'wait' : 'pointer',
          }}
        >
          {phase === 'extracting' ? (
            <>
              <Loader2 size={26} className="animate-spin" style={{ color: '#b0863e', display: 'inline-block' }} />
              <div style={{ fontSize: 14, fontWeight: 600, marginTop: 8, color: '#161616' }}>L&rsquo;AI sta leggendo il documento…</div>
              <div style={{ fontSize: 12, color: '#767676', marginTop: 4 }}>Pochi secondi, non chiudere la pagina.</div>
            </>
          ) : (
            <>
              <Camera size={26} style={{ color: 'var(--cc-muted)', display: 'inline-block' }} />
              <div style={{ fontSize: 14, fontWeight: 600, marginTop: 8, color: '#161616' }}>Scatta una foto o carica un PDF</div>
              <div style={{ fontSize: 12, color: '#767676', marginTop: 4 }}>Tocca qui: listino prezzi o un tuo vecchio preventivo</div>
            </>
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleFile(f)
            e.target.value = ''
          }}
        />

        {error && <p style={{ fontSize: 13, color: '#dc2626', fontWeight: 500, marginTop: 10 }}>{error}</p>}

        <p style={{ fontSize: 12, color: '#767676', lineHeight: 1.55, marginTop: 12 }}>
          L&rsquo;AI <b>adatta</b> le voci al formato di Carta Canta — non è una copia del tuo documento.
          Il file viene analizzato da un servizio AI (europeo; in rari casi di indisponibilità, un fornitore negli USA con garanzie adeguate) e non viene conservato né usato per addestrare i modelli.
        </p>
        <p style={{ fontSize: 12, color: '#767676', marginTop: 6 }}>
          {isPro
            ? `${remaining} di ${proMonthly} import disponibili questo mese.`
            : `${remaining} import gratuito disponibile.`}
        </p>
      </div>
    )
  }

  // ── Fase 3/4: anteprima con righe modificabili ─────────────────────────
  return (
    <div style={{ padding: '14px 15px 16px' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#161616', marginBottom: 4 }}>
        Voci trovate ({items.length})
      </div>
      <p style={{ fontSize: 12, color: '#767676', lineHeight: 1.5, marginBottom: 10 }}>
        Pallino verde = lettura sicura · ambra = da ricontrollare. Correggi i campi direttamente, ✕ per scartare una voce.
      </p>

      <div style={{ background: '#fff', borderRadius: 14, boxShadow: SH, padding: '4px 13px' }}>
        {items.map((it, idx) => (
          <div key={it.key} style={{ padding: '11px 0', borderBottom: idx < items.length - 1 ? '0.5px solid #eee' : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                aria-label={it.confidence >= 0.8 ? 'Lettura sicura' : 'Da ricontrollare'}
                style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: it.confidence >= 0.8 ? '#2f8a63' : '#b0863e' }}
              />
              <input
                value={it.name}
                onChange={(e) => updateItem(it.key, { name: e.target.value })}
                placeholder="Descrizione voce"
                style={{ ...fieldStyle, flex: 1, minWidth: 0, fontWeight: 600 }}
              />
              <button
                type="button"
                aria-label={`Scarta ${it.name}`}
                onClick={() => setItems((prev) => prev.filter((x) => x.key !== it.key))}
                style={{ background: 'none', border: 'none', padding: 5, cursor: 'pointer', color: '#a5a39b', flexShrink: 0, display: 'flex' }}
              >
                <X size={16} />
              </button>
            </div>
            <div style={{ display: 'flex', gap: 7, marginTop: 8, paddingLeft: 16 }}>
              <div style={{ position: 'relative', width: 96, flexShrink: 0 }}>
                <input
                  inputMode="decimal"
                  value={it.price}
                  onChange={(e) => updateItem(it.key, { price: e.target.value.replace(/[^\d.,]/g, '') })}
                  style={{ ...fieldStyle, paddingRight: 20 }}
                />
                <span style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--cc-muted)' }}>€</span>
              </div>
              <input
                value={it.unit}
                onChange={(e) => updateItem(it.key, { unit: e.target.value })}
                placeholder="unità"
                style={{ ...fieldStyle, width: 64, flexShrink: 0 }}
              />
              <select
                value={it.vat}
                onChange={(e) => updateItem(it.key, { vat: e.target.value })}
                style={{ ...fieldStyle, width: 92, flexShrink: 0 }}
              >
                <option value="">IVA —</option>
                <option value="22">IVA 22%</option>
                <option value="10">IVA 10%</option>
                <option value="5">IVA 5%</option>
                <option value="4">IVA 4%</option>
                <option value="0">IVA 0%</option>
              </select>
              <input
                value={it.category}
                onChange={(e) => updateItem(it.key, { category: e.target.value })}
                placeholder="Categoria"
                style={{ ...fieldStyle, flex: 1, minWidth: 0 }}
              />
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--cc-muted)', padding: '12px 0' }}>Hai scartato tutte le voci.</p>
        )}
      </div>

      {error && <p style={{ fontSize: 13, color: '#dc2626', fontWeight: 500, marginTop: 10 }}>{error}</p>}

      {items.length > 0 && <button
        type="button"
        disabled={phase === 'saving'}
        onClick={handleSave}
        style={{
          width: '100%', marginTop: 13, height: 48, border: 'none', borderRadius: 12,
          background: '#1a1a2e', color: '#fff', fontSize: 14, fontWeight: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          boxShadow: '0 6px 16px -6px rgba(26,26,46,.5)', fontFamily: 'inherit',
          cursor: phase === 'saving' ? 'default' : 'pointer',
          opacity: phase === 'saving' ? 0.6 : 1,
        }}
      >
        {phase === 'saving'
          ? <><Loader2 size={18} className="animate-spin" /> Salvataggio…</>
          : items.length === 1 ? 'Aggiungi 1 voce al catalogo' : `Aggiungi ${items.length} voci al catalogo`}
      </button>}

      <button
        type="button"
        onClick={() => { setItems([]); setPhase('upload') }}
        disabled={phase === 'saving'}
        style={{ width: '100%', marginTop: 10, height: 46, borderRadius: 12, border: '1px solid #e7e7ea', background: '#fff', color: '#1a1a2e', fontSize: 13, fontWeight: 500, cursor: phase === 'saving' ? 'default' : 'pointer', fontFamily: 'inherit', opacity: phase === 'saving' ? 0.5 : 1 }}
      >
        Ricomincia con un altro documento
      </button>
    </div>
  )
}
