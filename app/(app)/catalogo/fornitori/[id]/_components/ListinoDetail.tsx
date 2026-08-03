'use client'

// ============================================================
// ListinoDetail — dettaglio del listino fornitore (Fase 2, Pro):
// ① dati del listino (nome, ricarico, scadenza) con modifica inline;
// ② import/RINNOVO con l'AI (foto/PDF del listino → costi);
// ③ voci col costo, aggiunta manuale, modifica ed eliminazione.
// 🔒 B.2: costi e ricarichi restano privati dell'artigiano.
// ============================================================

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { runAction } from '@/lib/run-action'
import {
  updateSupplierListAction, deleteSupplierListAction,
  addSupplierItemAction, updateSupplierItemAction, deleteSupplierItemAction,
  importSupplierItemsAction,
} from '@/lib/actions/fornitori'
import { prezzoProposto, giorniAllaScadenza, riepilogoRinnovo } from '@/lib/fornitori/listino'
import { parseImportoIt } from '@/lib/utils'

type ListRow = { id: string; name: string; markup_pct: number | null; valid_until: string | null }
type ItemRow = { id: string; code: string | null; description: string; unit: string; unit_cost: number }

const SH = '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)'
const FIELD: React.CSSProperties = {
  width: '100%', border: '1px solid #e3e3e6', borderRadius: 10, padding: '10px 11px',
  fontSize: 15, fontFamily: 'inherit', color: '#161616', background: '#fff', boxSizing: 'border-box',
}
const LABEL: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: 'var(--cc-muted)', letterSpacing: '.05em',
  textTransform: 'uppercase', display: 'block', marginBottom: 5,
}
const secLabel: React.CSSProperties = { fontSize: 13, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: '#6f6d64', marginBottom: 10 }

const fmtEur = (v: number) => `${v.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
const dateIt = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })

interface DraftImport {
  key: number
  code: string
  description: string
  unit: string
  cost: string
}

export function ListinoDetail({ list, items, ai }: {
  list: ListRow
  items: ItemRow[]
  ai: { allowed: boolean; remaining: number; isPro: boolean; proMonthly: number } | null
}) {
  const router = useRouter()

  // ── ① Dati del listino ──────────────────────────────────────
  const [editInfo, setEditInfo] = useState(false)
  const [name, setName] = useState(list.name)
  const [markup, setMarkup] = useState(list.markup_pct != null ? String(list.markup_pct) : '')
  const [validUntil, setValidUntil] = useState(list.valid_until ?? '')
  const [infoError, setInfoError] = useState<string | null>(null)
  const [infoPending, startInfo] = useTransition()

  function saveInfo() {
    if (!name.trim()) { setInfoError('Metti il nome del fornitore.'); return }
    // Stessa validazione di NuovoListinoForm: senza questo il server
    // risponderebbe con un errore Zod non tradotto.
    const m = markup.trim() === '' ? null : parseImportoIt(markup)
    if (m != null && (!Number.isFinite(m) || m < 0 || m > 500)) {
      setInfoError('Il ricarico deve essere tra 0 e 500%.')
      return
    }
    setInfoError(null)
    startInfo(async () => {
      const fd = new FormData()
      fd.set('name', name.trim())
      if (m != null) fd.set('markup_pct', String(m))
      if (validUntil) fd.set('valid_until', validUntil)
      const result = await runAction(() => updateSupplierListAction(list.id, fd), 'salvare il listino')
      if (result?.error) { setInfoError(result.error); return }
      setEditInfo(false)
      toast.success('Listino aggiornato', { closeButton: true })
      router.refresh()
    })
  }

  function deleteList() {
    if (!window.confirm(`Eliminare il listino di ${list.name}? Le voci del listino spariscono; i preventivi già fatti non cambiano.`)) return
    startInfo(async () => {
      const result = await runAction(() => deleteSupplierListAction(list.id), 'eliminare il listino')
      if (result?.error) { setInfoError(result.error); return }
      router.push('/catalogo?tab=listini')
      router.refresh()
    })
  }

  const giorni = list.valid_until ? giorniAllaScadenza(list.valid_until) : null

  // ── ② Import AI (primo import e rinnovo) ────────────────────
  const fileRef = useRef<HTMLInputElement>(null)
  const [phase, setPhase] = useState<'idle' | 'extracting' | 'preview' | 'saving'>('idle')
  const [draft, setDraft] = useState<DraftImport[]>([])
  const [importValidUntil, setImportValidUntil] = useState('')
  const [importError, setImportError] = useState<string | null>(null)
  // Esito dell'ultimo import, mostrato INLINE (il toast da solo si perde — bug Eli 2 ago)
  const [lastEsito, setLastEsito] = useState<string | null>(null)
  // Avviso onesto sull'analisi del PDF (3 ago sera): documento oltre il tetto
  // analizzabile o pezzi non letti → l'artigiano DEVE saperlo.
  const [importNote, setImportNote] = useState<string | null>(null)

  async function handleFile(file: File) {
    setImportError(null)
    setLastEsito(null)
    setImportNote(null)
    setPhase('extracting')
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/ai/extract', { method: 'POST', body: formData })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setImportError(data.error ?? 'Elaborazione non riuscita. Riprova.')
        setPhase('idle')
        return
      }
      const extracted = (data.items ?? []) as Array<{ description: string; unit?: string; unit_price?: number }>
      if (extracted.length === 0) {
        setImportError('Nessuna voce trovata nel documento. Prova con una foto più nitida.')
        setPhase('idle')
        return
      }
      const notes: string[] = []
      if (data._truncated) notes.push('Il PDF è molto lungo: ho analizzato circa le prime 50 pagine. Per il resto carica un secondo PDF con le pagine mancanti.')
      if (data._failedChunks) notes.push('Una parte del documento non è stata letta: controlla che non manchino voci.')
      setImportNote(notes.length > 0 ? notes.join(' ') : null)
      setDraft(extracted.map((it, i) => ({
        key: i,
        code: '',
        description: it.description ?? '',
        unit: it.unit || 'pz',
        // ⚠️ Qui il numero letto è il COSTO del fornitore (è il suo listino)
        cost: (it.unit_price ?? 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      })))
      setPhase('preview')
    } catch {
      setImportError('Errore di rete. Controlla la connessione e riprova.')
      setPhase('idle')
    }
  }

  async function handleImportSave() {
    const valid = draft.filter((d) => d.description.trim() !== '')
    if (valid.length === 0) { setImportError('Nessuna voce da salvare.'); return }
    for (const d of valid) {
      const c = parseImportoIt(d.cost)
      if (!Number.isFinite(c) || c < 0) {
        setImportError(`Costo non valido per "${d.description.trim().slice(0, 40)}".`)
        return
      }
    }
    setImportError(null)
    setPhase('saving')
    const payload = valid.map((d) => ({
      code: d.code.trim() || null,
      description: d.description.trim(),
      unit: d.unit.trim() || 'pz',
      unit_cost: parseImportoIt(d.cost),
    }))
    const result = await runAction(
      () => importSupplierItemsAction(list.id, payload, importValidUntil || null),
      'importare il listino'
    )
    if (result.error) {
      setImportError(result.error)
      setPhase('preview')
      return
    }
    const esito = riepilogoRinnovo({
      matched: result.matched ?? 0,
      added: result.added ?? 0,
      increased: result.increased ?? 0,
      avgIncreasePct: result.avgIncreasePct ?? null,
    })
    toast.success('Listino importato', { description: esito, closeButton: true })
    setLastEsito(esito)
    setDraft([])
    setPhase('idle')
    setImportValidUntil('')
    router.refresh()
  }

  // ── ③ Voci: aggiunta manuale + modifica/eliminazione ────────
  const [showAdd, setShowAdd] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [fCode, setFCode] = useState('')
  const [fDesc, setFDesc] = useState('')
  const [fUnit, setFUnit] = useState('pz')
  const [fCost, setFCost] = useState('')
  const [itemError, setItemError] = useState<string | null>(null)
  const [itemPending, startItem] = useTransition()

  function openAdd() {
    setEditId(null); setFCode(''); setFDesc(''); setFUnit('pz'); setFCost('')
    setItemError(null); setShowAdd(true)
  }
  function openEdit(it: ItemRow) {
    setEditId(it.id); setFCode(it.code ?? ''); setFDesc(it.description); setFUnit(it.unit); setFCost(String(it.unit_cost).replace('.', ','))
    setItemError(null); setShowAdd(true)
  }

  function saveItem() {
    if (!fDesc.trim()) { setItemError('La descrizione è obbligatoria.'); return }
    const c = parseImportoIt(fCost)
    if (!Number.isFinite(c) || c < 0) { setItemError('Metti un costo valido.'); return }
    setItemError(null)
    startItem(async () => {
      const fd = new FormData()
      if (fCode.trim()) fd.set('code', fCode.trim())
      fd.set('description', fDesc.trim())
      fd.set('unit', fUnit.trim() || 'pz')
      fd.set('unit_cost', String(c))
      const result = editId
        ? await runAction(() => updateSupplierItemAction(editId, fd), 'salvare la voce')
        : await runAction(() => addSupplierItemAction(list.id, fd), 'salvare la voce')
      if (result?.error) { setItemError(result.error); return }
      setShowAdd(false)
      router.refresh()
    })
  }

  function deleteItem(it: ItemRow) {
    if (!window.confirm(`Eliminare "${it.description}" dal listino?`)) return
    startItem(async () => {
      const result = await runAction(() => deleteSupplierItemAction(it.id), 'eliminare la voce')
      if (result?.error) { toast.error(result.error); return }
      router.refresh()
    })
  }

  return (
    <div style={{ padding: '14px 15px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* ── ① Dati del listino ── */}
      <div style={{ background: '#fff', borderRadius: 14, boxShadow: SH, padding: '14px 15px' }}>
        {!editInfo ? (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#161616' }}>{list.name}</div>
              <div style={{ fontSize: 13, color: 'var(--cc-muted)', marginTop: 4, lineHeight: 1.6 }}>
                {list.markup_pct != null
                  ? <>Ricarico proposto: <b style={{ color: '#55534b' }}>+{Number(list.markup_pct).toLocaleString('it-IT')}%</b></>
                  : 'Nessun ricarico impostato: le voci entrano in preventivo "da prezzare".'}
                {list.valid_until && (
                  giorni != null && giorni < 0
                    ? <> · <b style={{ color: '#b42318' }}>scaduto il {dateIt(list.valid_until)}</b></>
                    : <> · valido fino al {dateIt(list.valid_until)}</>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setEditInfo(true)}
              aria-label="Modifica il listino"
              style={{ display: 'flex', alignItems: 'center', gap: 5, border: '1px solid #e3e3e6', background: '#fff', borderRadius: 9, padding: '7px 11px', fontSize: 13, fontWeight: 600, color: '#1a1a2e', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}
            >
              <Pencil size={13} /> Modifica
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            <div>
              <label style={LABEL}>Fornitore</label>
              <input value={name} onChange={(e) => setName(e.target.value)} style={FIELD} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={LABEL}>Il tuo ricarico %</label>
                <input inputMode="decimal" value={markup} onChange={(e) => setMarkup(e.target.value.replace(/[^\d.,]/g, ''))} placeholder="es. 25" style={FIELD} />
              </div>
              <div>
                <label style={LABEL}>Valido fino al</label>
                <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} style={FIELD} />
              </div>
            </div>
            {infoError && <p style={{ fontSize: 13, color: '#dc2626', fontWeight: 500, margin: 0 }}>{infoError}</p>}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button type="button" onClick={saveInfo} disabled={infoPending} style={{ flex: 1, minHeight: 44, border: 'none', borderRadius: 10, background: '#1a1a2e', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: infoPending ? 0.7 : 1 }}>
                {infoPending ? 'Salvataggio…' : 'Salva'}
              </button>
              <button type="button" onClick={() => { setEditInfo(false); setInfoError(null) }} style={{ minHeight: 44, padding: '0 14px', borderRadius: 10, border: '1px solid #e7e7ea', background: '#fff', color: '#1a1a2e', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                Annulla
              </button>
              <button type="button" onClick={deleteList} aria-label="Elimina il listino" style={{ minHeight: 44, padding: '0 12px', borderRadius: 10, border: '1px solid #f1c4c4', background: '#fff', color: '#b42318', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── ② Import/rinnovo con l'AI ── */}
      {ai && (
        <div style={{ background: '#fff', borderLeft: '3px solid #c9a44c', borderRadius: 14, boxShadow: SH, padding: '13px 14px' }}>
          <div style={secLabel}>{items.length > 0 ? 'Rinnova il listino' : 'Importa il listino'}</div>

          {phase === 'idle' || phase === 'extracting' ? (
            <>
              {/* ⚠️ Esito e errori SEMPRE visibili anche qui: prima comparivano
                  solo in fase anteprima → un'estrazione fallita (quota, PDF non
                  leggibile, rete) tornava alla fase iniziale SENZA dire nulla
                  (bug Eli 2 ago: "non succede nulla, non mi dice l'esito"). */}
              {lastEsito && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: '#eef8f2', border: '1px solid #b7dcc8', borderRadius: 10, padding: '9px 11px', marginBottom: 10 }}>
                  <span style={{ fontSize: 13, color: '#1d5c41', lineHeight: 1.5 }}>Listino importato: {lastEsito}. Le voci sono qui sotto.</span>
                </div>
              )}
              {importError && (
                <p style={{ fontSize: 13, color: '#dc2626', fontWeight: 500, margin: '0 0 10px', lineHeight: 1.5 }}>{importError}</p>
              )}
              <p style={{ fontSize: 13, color: '#55534b', lineHeight: 1.6, margin: '0 0 10px' }}>
                {items.length > 0
                  ? 'Foto o PDF del listino nuovo: l’AI abbina le voci a quelle che hai già (per codice o descrizione), aggiorna i costi e ti dice cosa è rincarato.'
                  : 'Foto o PDF del listino del fornitore: l’AI legge le voci coi COSTI. Il prezzo di vendita lo propone poi il tuo ricarico.'}
              </p>
              {ai.allowed ? (
                <button
                  type="button"
                  onClick={() => { if (phase !== 'extracting') fileRef.current?.click() }}
                  disabled={phase === 'extracting'}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, width: '100%', minHeight: 44, borderRadius: 11, background: '#fff', border: '1px solid #e0c98f', color: '#b0863e', fontSize: 13, fontWeight: 600, cursor: phase === 'extracting' ? 'wait' : 'pointer', fontFamily: 'inherit' }}
                >
                  {phase === 'extracting'
                    ? <><Loader2 size={15} className="animate-spin" /> L&rsquo;AI sta leggendo…</>
                    : <><Camera size={15} /> {items.length > 0 ? 'Rinnova con una foto o un PDF' : 'Importa con una foto o un PDF'}</>}
                </button>
              ) : (
                <p style={{ fontSize: 12, color: '#767676', margin: 0 }}>
                  {ai.isPro ? `Hai usato i ${ai.proMonthly} import AI di questo mese: si ricaricano il mese prossimo. Puoi comunque aggiungere le voci a mano qui sotto.` : 'Import AI esaurito.'}
                </p>
              )}
              {/* Attesa ONESTA durante l'analisi (richiesta Eli 3 ago sera):
                  i PDF lunghi richiedono fino a un minuto e chiudere la
                  pagina butta via il lavoro (il risultato arriva QUI). */}
              {phase === 'extracting' && (
                <p style={{ fontSize: 12, color: '#b0863e', background: '#f5e9d0', border: '1px solid #e8d6ad', borderRadius: 9, padding: '8px 10px', lineHeight: 1.5, margin: '8px 0 0' }}>
                  Per i PDF lunghi possono servire fino a un minuto: non chiudere la pagina, le voci compaiono qui appena pronte.
                </p>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                style={{ display: 'none' }}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }}
              />
              {ai.allowed && (
                <p style={{ fontSize: 12, color: '#767676', margin: '8px 0 0' }}>
                  {ai.isPro ? `${ai.remaining} di ${ai.proMonthly} import disponibili questo mese.` : `${ai.remaining} import gratuito disponibile.`}
                </p>
              )}
            </>
          ) : (
            <>
              {importNote && (
                <p style={{ fontSize: 12, color: '#b0863e', background: '#f5e9d0', border: '1px solid #e8d6ad', borderRadius: 9, padding: '8px 10px', lineHeight: 1.5, margin: '0 0 10px' }}>
                  {importNote}
                </p>
              )}
              <p style={{ fontSize: 12, color: '#767676', lineHeight: 1.5, margin: '0 0 10px' }}>
                Controlla le voci: qui i numeri sono i <b>COSTI</b>{' '}del fornitore. Il codice articolo aiuta i prossimi rinnovi.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {draft.map((d, idx) => (
                  <div key={d.key} style={{ padding: '9px 0', borderBottom: idx < draft.length - 1 ? '0.5px solid #eee' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <input
                        value={d.description}
                        onChange={(e) => setDraft((prev) => prev.map((x) => x.key === d.key ? { ...x, description: e.target.value } : x))}
                        placeholder="Descrizione"
                        style={{ ...FIELD, flex: 1, minWidth: 0, padding: '7px 9px', fontSize: 13, fontWeight: 600 }}
                      />
                      <button
                        type="button"
                        aria-label={`Scarta ${d.description}`}
                        onClick={() => setDraft((prev) => prev.filter((x) => x.key !== d.key))}
                        style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: '#a5a39b', flexShrink: 0, display: 'flex' }}
                      >
                        <X size={15} />
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: 7, marginTop: 7 }}>
                      <input
                        value={d.code}
                        onChange={(e) => setDraft((prev) => prev.map((x) => x.key === d.key ? { ...x, code: e.target.value } : x))}
                        placeholder="Codice"
                        style={{ ...FIELD, width: 90, flexShrink: 0, padding: '7px 9px', fontSize: 13 }}
                      />
                      <input
                        value={d.unit}
                        onChange={(e) => setDraft((prev) => prev.map((x) => x.key === d.key ? { ...x, unit: e.target.value } : x))}
                        placeholder="unità"
                        style={{ ...FIELD, width: 64, flexShrink: 0, padding: '7px 9px', fontSize: 13 }}
                      />
                      <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
                        <input
                          inputMode="decimal"
                          value={d.cost}
                          onChange={(e) => setDraft((prev) => prev.map((x) => x.key === d.key ? { ...x, cost: e.target.value.replace(/[^\d.,]/g, '') } : x))}
                          style={{ ...FIELD, padding: '7px 22px 7px 9px', fontSize: 13 }}
                        />
                        <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--cc-muted)' }}>€</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 10 }}>
                <label style={LABEL}>Nuova scadenza del listino (facoltativa)</label>
                <input type="date" value={importValidUntil} onChange={(e) => setImportValidUntil(e.target.value)} style={FIELD} />
              </div>
              {importError && <p style={{ fontSize: 13, color: '#dc2626', fontWeight: 500, margin: '8px 0 0' }}>{importError}</p>}
              {draft.length > 0 && (
                <button
                  type="button"
                  onClick={handleImportSave}
                  disabled={phase === 'saving'}
                  style={{ width: '100%', marginTop: 11, minHeight: 46, border: 'none', borderRadius: 11, background: '#1a1a2e', color: '#fff', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: phase === 'saving' ? 'default' : 'pointer', fontFamily: 'inherit', opacity: phase === 'saving' ? 0.6 : 1 }}
                >
                  {phase === 'saving'
                    ? <><Loader2 size={16} className="animate-spin" /> Salvataggio…</>
                    : items.length > 0 ? 'Aggiorna il listino' : `Aggiungi ${draft.length} voci al listino`}
                </button>
              )}
              <button
                type="button"
                onClick={() => { setDraft([]); setPhase('idle'); setImportError(null) }}
                disabled={phase === 'saving'}
                style={{ width: '100%', marginTop: 8, minHeight: 42, borderRadius: 11, border: '1px solid #e7e7ea', background: '#fff', color: '#1a1a2e', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', opacity: phase === 'saving' ? 0.5 : 1 }}
              >
                Annulla l&rsquo;import
              </button>
            </>
          )}
        </div>
      )}

      {/* ── ③ Voci del listino ── */}
      <div style={{ background: '#fff', borderRadius: 14, boxShadow: SH, padding: '13px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ ...secLabel, marginBottom: 0 }}>Voci ({items.length})</div>
          <button
            type="button"
            onClick={openAdd}
            style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', color: '#1a1a2e', fontWeight: 600, fontSize: 13, padding: 0, fontFamily: 'inherit' }}
          >
            <Plus size={15} /> Aggiungi
          </button>
        </div>

        {showAdd && (
          <div style={{ border: '1px solid #e8d6ad', background: '#fdf9ef', borderRadius: 11, padding: '11px 12px', margin: '8px 0' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              <input value={fDesc} onChange={(e) => setFDesc(e.target.value)} placeholder="Descrizione voce" style={FIELD} autoFocus />
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={fCode} onChange={(e) => setFCode(e.target.value)} placeholder="Codice" style={{ ...FIELD, width: 100, flexShrink: 0 }} />
                <input value={fUnit} onChange={(e) => setFUnit(e.target.value)} placeholder="unità" style={{ ...FIELD, width: 70, flexShrink: 0 }} />
                <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
                  <input inputMode="decimal" value={fCost} onChange={(e) => setFCost(e.target.value.replace(/[^\d.,]/g, ''))} placeholder="Costo" style={{ ...FIELD, paddingRight: 24 }} />
                  <span style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--cc-muted)' }}>€</span>
                </div>
              </div>
              {itemError && <p style={{ fontSize: 13, color: '#dc2626', fontWeight: 500, margin: 0 }}>{itemError}</p>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={saveItem} disabled={itemPending} style={{ flex: 1, minHeight: 42, border: 'none', borderRadius: 10, background: '#1a1a2e', color: '#fff', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: itemPending ? 0.7 : 1 }}>
                  {itemPending ? 'Salvataggio…' : editId ? 'Salva la voce' : 'Aggiungi la voce'}
                </button>
                <button type="button" onClick={() => setShowAdd(false)} style={{ minHeight: 42, padding: '0 13px', borderRadius: 10, border: '1px solid #e7e7ea', background: '#fff', color: '#1a1a2e', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Annulla
                </button>
              </div>
            </div>
          </div>
        )}

        {items.length === 0 && !showAdd ? (
          <p style={{ fontSize: 13, color: 'var(--cc-muted)', margin: '8px 0 4px', lineHeight: 1.6 }}>
            Nessuna voce ancora: importa il listino con una foto qui sopra, o aggiungi le voci a mano.
          </p>
        ) : (
          items.map((it, idx) => {
            const proposto = prezzoProposto(Number(it.unit_cost), list.markup_pct != null ? Number(list.markup_pct) : null)
            return (
              <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', borderBottom: idx < items.length - 1 ? '0.5px solid #eee' : 'none' }}>
                <button
                  type="button"
                  onClick={() => openEdit(it)}
                  style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#161616', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.description}</div>
                  <div style={{ fontSize: 12, color: 'var(--cc-muted)', marginTop: 2 }}>
                    {it.code ? `${it.code} · ` : ''}costo {fmtEur(Number(it.unit_cost))}/{it.unit}
                    {proposto != null && <> · <span style={{ color: '#2f8a63', fontWeight: 600 }}>vendi a {fmtEur(proposto)}</span></>}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => deleteItem(it)}
                  aria-label={`Elimina ${it.description}`}
                  style={{ background: 'none', border: 'none', padding: 5, cursor: 'pointer', color: '#a5a39b', flexShrink: 0, display: 'flex' }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            )
          })
        )}
      </div>

      <p style={{ fontSize: 12, color: '#767676', lineHeight: 1.6, margin: 0 }}>
        🔒 Costi e ricarichi sono solo per i tuoi occhi: non compaiono mai su preventivi, fatture o pagine viste dal cliente.
      </p>
    </div>
  )
}
