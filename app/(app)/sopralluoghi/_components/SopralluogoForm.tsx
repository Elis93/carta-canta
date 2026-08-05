'use client'

// ============================================================
// SopralluogoForm — editor appunti di cantiere (mockup cantiere §1.2)
// Foglio libero + dettatura + foto + chip rapidi. "Trasforma in
// preventivo" crea la bozza con appunti nelle Note interne.
// ============================================================

import { useEffect, useRef, useState, useTransition } from 'react'
import { runAction } from '@/lib/run-action'
import { useRouter } from 'next/navigation'
import { Camera, Images, Loader2, X, FileText, Navigation, Ruler, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { ClientAutocomplete } from '@/components/shared/ClientAutocomplete'
import type { ClientHit } from '@/components/shared/QuickCreateClientDialog'
import { VoiceInput } from '@/components/shared/VoiceInput'
import { Calcolatrice, type CalcSnapshot } from '@/components/calc/Calcolatrice'
import { AppointmentPicker } from '@/app/(app)/_components/AppointmentPicker'
import { fmtMisura, type Misura } from '@/lib/calc/misure'
import {
  saveSopralluogoAction,
  addWorkPhotoAction,
  deleteWorkPhotoAction,
  createPreventivoFromSopralluogoAction,
} from '@/lib/actions/sopralluoghi'
import { uploadWorkPhoto } from '@/lib/photos/upload-client'
import { useSignedPhotos } from '@/lib/photos/use-signed-photos'

const SH = '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)'

const cardStyle: React.CSSProperties = {
  background: '#fff', borderRadius: 14, boxShadow: SH, padding: '14px 15px',
}
const secLabel: React.CSSProperties = {
  fontSize: 13, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: '#6f6d64', marginBottom: 10,
}
const fieldStyle: React.CSSProperties = {
  width: '100%', border: '1px solid #e3e3e6', borderRadius: 10, padding: '11px 12px',
  fontSize: 14, fontFamily: 'inherit', color: '#161616', background: '#fff', boxSizing: 'border-box', outline: 'none',
}

export interface SopralluogoPhoto {
  id: string
  storage_path: string
}

export interface SopralluogoDefaults {
  id: string
  title: string
  address: string | null
  notes: string | null
  /** Appuntamento in formato datetime-local ("YYYY-MM-DDTHH:MM", ora italiana) */
  scheduledAt: string | null
  client: ClientHit | null
  documentId: string | null
  photos: SopralluogoPhoto[]
  /** URL firmate dal server per le foto già presenti (collaboratori in team) */
  photoSignedUrls?: Record<string, string>
  /** Misure calcolate salvate (migration 054) — rimodificabili con un tocco */
  measurements: Misura[]
}

/** Descrizione leggibile degli input di un calcolo ("4 × 3,5 m +10% scarto"). */
function describeCalc(s: CalcSnapshot): string {
  const f = s.fields
  const pct = (v?: string) => (v && v.trim() && v.trim() !== '0' ? ` +${v.trim()}% scarto` : '')
  switch (s.tab) {
    case 'superficie': return `${f.lungh} × ${f.largh} m${pct(f.scarto)}`
    case 'volume':     return `${f.lungh} × ${f.largh} × ${f.alt} m${pct(f.scarto)}`
    case 'piastrelle': return `${f.area} m², piastrella ${f.lato1 || '?'} × ${f.lato2 || '?'} cm${pct(f.scarto)}`
    case 'vernice':    return `${f.area} m², ${f.mani} mani, resa ${f.resa} m²/l`
  }
}

const CHIPS: Array<{ label: string; text: string }> = [
  { label: '➕ Misure', text: 'Misure: ' },
  { label: '➕ Materiali', text: 'Materiali: ' },
  { label: '➕ Manodopera', text: 'Manodopera: ore previste ' },
]

export function SopralluogoForm({ defaults }: { defaults: SopralluogoDefaults | null }) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const [sopId, setSopId] = useState<string | null>(defaults?.id ?? null)
  const [title, setTitle] = useState(defaults?.title ?? '')
  const [address, setAddress] = useState(defaults?.address ?? '')
  const [scheduledAt, setScheduledAt] = useState(defaults?.scheduledAt ?? '')
  // Giorno scelto senza ora nel picker: il salvataggio va bloccato con un
  // messaggio, altrimenti l'appuntamento sparirebbe in silenzio (finding M4).
  const [apptIncomplete, setApptIncomplete] = useState(false)
  const [notes, setNotes] = useState(defaults?.notes ?? '')
  const [client, setClient] = useState<ClientHit | null>(defaults?.client ?? null)
  const [photos, setPhotos] = useState<SopralluogoPhoto[]>(defaults?.photos ?? [])
  // Archivio privato: gli indirizzi delle miniature si chiedono e scadono.
  const photoUrls = useSignedPhotos(photos.map((p) => p.storage_path), defaults?.photoSignedUrls)
  // Misure calcolate (054): restano salvate con i loro input; un tocco le riapre
  const [misure, setMisure] = useState<Misura[]>(defaults?.measurements ?? [])
  const [calcOpen, setCalcOpen] = useState(false)
  const [editingMisura, setEditingMisura] = useState<Misura | null>(null)
  // Sorgente dell'upload in corso: spinner SOLO sul bottone premuto
  const [uploading, setUploading] = useState<'camera' | 'gallery' | null>(null)
  const [pending, startTransition] = useTransition()
  // Spinner solo sul bottone premuto (non su entrambi)
  const [pendingAction, setPendingAction] = useState<'transform' | 'save' | null>(null)
  const [error, setError] = useState<string | null>(null)

  function buildFormData(): FormData {
    const fd = new FormData()
    if (sopId) fd.set('id', sopId)
    fd.set('title', title)
    fd.set('address', address)
    fd.set('notes', notes)
    fd.set('client_id', client?.id ?? '')
    fd.set('scheduled_at', scheduledAt)
    fd.set('measurements', JSON.stringify(misure))
    return fd
  }

  // Blocca lo scroll di fondo quando la calcolatrice è aperta (stesso
  // pattern di CalcQuantitaButton)
  useEffect(() => {
    if (!calcOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [calcOpen])

  function handleCalcSnapshot(snap: CalcSnapshot) {
    const nuova: Misura = {
      id: editingMisura?.id ?? `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      tab: snap.tab,
      fields: snap.fields,
      label: snap.label,
      detail: describeCalc(snap),
      value: snap.value,
      unit: snap.unit,
      decimals: snap.decimals,
    }
    setMisure((prev) => {
      // Re-edit: sostituisce la misura toccata; altrimenti si aggiunge in coda
      const idx = editingMisura ? prev.findIndex((m) => m.id === editingMisura.id) : -1
      if (idx >= 0) return prev.map((m, i) => (i === idx ? nuova : m))
      return [...prev, nuova]
    })
    setCalcOpen(false)
    setEditingMisura(null)
  }

  /** Salva (creandolo se serve) e restituisce l'id — usato anche per le foto. */
  async function ensureSaved(): Promise<string | null> {
    const result = await runAction(() => saveSopralluogoAction(buildFormData()), 'salvare il sopralluogo')
    if (result?.error) {
      setError(result.error)
      return null
    }
    const id = result?.id ?? sopId
    if (id && !sopId) setSopId(id)
    return id ?? null
  }

  const APPT_INCOMPLETE_MSG = 'Hai scelto il giorno dell’appuntamento ma non l’ora. Scegli l’ora, oppure tocca di nuovo il giorno per togliere l’appuntamento.'

  function handleSaveDraft() {
    if (apptIncomplete) { setError(APPT_INCOMPLETE_MSG); return }
    setError(null)
    setPendingAction('save')
    startTransition(async () => {
      const id = await ensureSaved()
      if (!id) return
      toast.success('Sopralluogo salvato', { description: 'Lo ritrovi nella lista Sopralluoghi.', closeButton: true })
      router.push('/sopralluoghi')
      router.refresh()
    })
  }

  function handleTransform() {
    if (apptIncomplete) { setError(APPT_INCOMPLETE_MSG); return }
    setError(null)
    setPendingAction('transform')
    startTransition(async () => {
      const id = await ensureSaved()
      if (!id) return
      // Il redirect avviene nel server action (throw NEXT_REDIRECT)
      const result = await runAction(() => createPreventivoFromSopralluogoAction(id), 'creare il preventivo')
      if (result?.error) setError(result.error)
    })
  }

  async function handleFiles(files: FileList | null, source: 'camera' | 'gallery') {
    if (!files || files.length === 0) return
    // Come Salva/Trasforma (review 25 lug B3): scattare una foto salva il
    // sopralluogo — con un appuntamento a metà (giorno senza ora) lo
    // salverebbe SENZA l'appuntamento, in silenzio.
    if (apptIncomplete) {
      setError('Manca l’ora dell’appuntamento: scegli l’ora (o togli il giorno) prima di aggiungere le foto.')
      return
    }
    setError(null)
    setUploading(source)
    try {
      const id = sopId ?? (await ensureSaved())
      if (!id) return
      if (files.length > 6) {
      toast.info('Puoi caricare al massimo 6 foto per volta: uso le prime 6.', { closeButton: true })
    }
    for (const file of Array.from(files).slice(0, 6)) {
        const uploaded = await uploadWorkPhoto(file)
        if ('error' in uploaded) { setError(uploaded.error); continue }
        const rec = await runAction(() => addWorkPhotoAction({ storagePath: uploaded.path, sopralluogoId: id }), 'allegare la foto')
        if (rec?.error) { setError(rec.error); continue }
        setPhotos((prev) => [...prev, { id: rec?.id ?? uploaded.path, storage_path: uploaded.path }])
      }
    } finally {
      setUploading(null)
    }
  }

  function handleDeletePhoto(photo: SopralluogoPhoto) {
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id))
    // Non fire-and-forget: se l'eliminazione fallisce la foto esiste ancora →
    // rimettila in lista e avvisa (stesso pattern del toggle in WorkPhotosCard).
    deleteWorkPhotoAction(photo.id).then((res) => {
      if (res?.error) {
        setPhotos((prev) => [...prev, photo])
        toast.error('Eliminazione foto non riuscita. Riprova.')
      }
    }).catch(() => {
      setPhotos((prev) => [...prev, photo])
      toast.error('Eliminazione foto non riuscita. Riprova.')
    })
  }

  return (
    <div style={{ padding: '14px 15px 16px', display: 'flex', flexDirection: 'column', gap: 13 }}>

      {/* Cliente / Cantiere */}
      <div style={cardStyle}>
        <div style={secLabel}>Cliente / Cantiere</div>
        <ClientAutocomplete value={client} onChange={setClient} placeholder="Cerca cliente…" />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titolo lavoro (es. Bagno piano primo)"
          maxLength={120}
          style={{ ...fieldStyle, marginTop: 10 }}
        />
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Indirizzo cantiere (facoltativo)"
          maxLength={200}
          style={{ ...fieldStyle, marginTop: 10 }}
        />
        {address.trim() && (
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address.trim())}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 13, fontWeight: 600, color: '#1a1a2e', textDecoration: 'none' }}
          >
            <Navigation size={14} /> Naviga con Google Maps
          </a>
        )}
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--cc-muted)', marginBottom: 6 }}>
            Appuntamento <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>(facoltativo)</span>
          </div>
          <AppointmentPicker
            value={scheduledAt}
            onChange={setScheduledAt}
            onIncompleteChange={setApptIncomplete}
            excludeKind="sopralluogo"
            excludeId={sopId}
          />
        </div>
      </div>

      {/* Appunti */}
      <div style={cardStyle}>
        <div style={secLabel}>Appunti</div>
        <textarea
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value)
            e.currentTarget.style.height = 'auto'
            e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px'
          }}
          ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = Math.max(128, el.scrollHeight) + 'px' } }}
          placeholder={'Misure… (es. parete 3,20 × 2,60 m)\nMateriali… (es. 2 rubinetti € 45 cad.)\nOre previste… (es. 6 h a € 30/h)'}
          style={{ ...fieldStyle, minHeight: 128, resize: 'none', overflow: 'hidden', lineHeight: 1.6, fontSize: 13 }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
          <VoiceInput
            compact
            className="flex-none text-[#55534b]"
            onTranscript={(text) => setNotes((prev) => (prev ? `${prev}\n${text}` : text))}
          />
          <span style={{ fontSize: 12, color: '#767676' }}>Detta col microfono o scrivi liberamente</span>
        </div>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 10 }}>
          {CHIPS.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={() => setNotes((prev) => (prev ? `${prev}\n${chip.text}` : chip.text))}
              style={{ border: '1px solid #e3e3e6', borderRadius: 999, background: '#fff', padding: '5px 11px', fontSize: 12, fontWeight: 500, color: '#55534b', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Misure calcolate (richiesta Eli 18 lug): la calcolatrice di
            cantiere direttamente negli appunti. Ogni misura salvata mostra
            IL CALCOLO e il risultato; un tocco la riapre per rimodificarla. */}
        <div style={{ borderTop: '0.5px solid #eee', marginTop: 13, paddingTop: 12 }}>
          {misure.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 10 }}>
              {misure.map((m) => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f6f0e2', border: '1px solid #e6dcc2', borderRadius: 11, padding: '8px 10px' }}>
                  <button
                    type="button"
                    onClick={() => { setEditingMisura(m); setCalcOpen(true) }}
                    aria-label={`Rimodifica misura: ${m.label}`}
                    style={{ flex: 1, minWidth: 0, border: 'none', background: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
                  >
                    <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#1a1a2e' }}>
                      {m.label}: {fmtMisura(m.value, m.decimals)} {m.unit}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#8a7a52', marginTop: 1 }}>
                      <Pencil size={11} style={{ flexShrink: 0 }} aria-hidden />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.detail}</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Elimina misura: ${m.label}`}
                    onClick={() => setMisure((prev) => prev.filter((x) => x.id !== m.id))}
                    style={{ flexShrink: 0, width: 26, height: 26, borderRadius: '50%', border: 'none', background: 'rgba(26,26,46,.08)', color: '#55534b', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => { setEditingMisura(null); setCalcOpen(true) }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid #e0c98f', borderRadius: 999, background: '#fff', padding: '7px 13px', fontSize: 13, fontWeight: 600, color: '#b0863e', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            <Ruler size={14} /> Calcola una misura
          </button>
          <p style={{ fontSize: 12, color: '#767676', marginTop: 7, lineHeight: 1.45 }}>
            Le misure salvate restano qui col loro calcolo: toccale per
            rimodificarle. Passano nelle Note interne del preventivo.
          </p>
        </div>
      </div>

      {/* Calcolatrice (stesso overlay centrato di "Calcola quantità", F13) */}
      {calcOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => { setCalcOpen(false); setEditingMisura(null) }}
          style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(20,20,40,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px 12px' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 440, maxHeight: 'calc(82dvh / var(--cc-zoom, 1))', overflowY: 'auto', background: '#fff', borderRadius: 18, padding: '16px 16px 18px', boxShadow: '0 18px 50px rgba(20,20,40,.35)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span style={{ flex: 1, fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 18, fontWeight: 600, color: '#1a1a2e' }}>
                {editingMisura ? 'Rimodifica la misura' : 'Calcola una misura'}
              </span>
              <button type="button" onClick={() => { setCalcOpen(false); setEditingMisura(null) }} aria-label="Chiudi" style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 4 }}>
                <X size={20} style={{ color: 'var(--cc-muted)' }} />
              </button>
            </div>
            <Calcolatrice
              key={editingMisura?.id ?? 'nuova'}
              initial={editingMisura ? { tab: editingMisura.tab, fields: editingMisura.fields } : undefined}
              onSnapshot={handleCalcSnapshot}
            />
          </div>
        </div>
      )}

      {/* Foto */}
      <div style={cardStyle}>
        <div style={secLabel}>Foto {photos.length > 0 && <span style={{ letterSpacing: 0, color: 'var(--cc-muted)', textTransform: 'none' }}>({photos.length})</span>}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {photos.map((p) => (
            <div key={p.id} style={{ position: 'relative', height: 76, borderRadius: 10, overflow: 'hidden', background: '#f2f2f5' }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- storage pubblico, niente next/image per le anteprime */}
              <img src={photoUrls.get(p.storage_path) ?? ''} alt="Foto sopralluogo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <button
                type="button"
                aria-label="Elimina foto"
                onClick={() => handleDeletePhoto(p)}
                style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: '50%', background: 'rgba(22,22,22,.65)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <X size={13} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            disabled={uploading !== null}
            style={{ height: 76, borderRadius: 10, border: '1.5px dashed #d8d8dc', background: '#fff', color: '#55534b', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, cursor: 'pointer' }}
            aria-label="Scatta una foto adesso"
          >
            {uploading === 'camera' ? <Loader2 size={18} className="animate-spin" /> : <Camera size={19} />}
            <span style={{ fontSize: 11, fontWeight: 600 }}>Scatta</span>
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading !== null}
            style={{ height: 76, borderRadius: 10, border: '1.5px dashed #d8d8dc', background: '#fff', color: 'var(--cc-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, cursor: 'pointer' }}
            aria-label="Scegli foto dalla galleria"
          >
            {uploading === 'gallery' ? <Loader2 size={18} className="animate-spin" /> : <Images size={19} />}
            <span style={{ fontSize: 11, fontWeight: 600 }}>Galleria</span>
          </button>
        </div>
        {/* Galleria (selezione multipla) */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => { void handleFiles(e.target.files, 'gallery'); e.target.value = '' }}
        />
        {/* Fotocamera: capture apre direttamente la camera posteriore sul telefono */}
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={(e) => { void handleFiles(e.target.files, 'camera'); e.target.value = '' }}
        />
      </div>

      {error && <p style={{ fontSize: 13, color: '#dc2626', fontWeight: 500 }}>{error}</p>}

      {/* Azioni */}
      <button
        type="button"
        onClick={handleTransform}
        disabled={pending}
        style={{
          width: '100%', height: 48, border: 'none', borderRadius: 12, background: '#1a1a2e', color: '#fff',
          fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          boxShadow: '0 6px 16px -6px rgba(26,26,46,.5)', cursor: 'pointer', fontFamily: 'inherit',
          opacity: pending ? 0.7 : 1,
        }}
      >
        {pending && pendingAction === 'transform' ? <Loader2 size={18} className="animate-spin" /> : <FileText size={17} />}
        {defaults?.documentId ? 'Apri il preventivo creato' : 'Trasforma in preventivo'}
      </button>
      <button
        type="button"
        onClick={handleSaveDraft}
        disabled={pending}
        style={{
          width: '100%', height: 48, borderRadius: 12, border: '1px solid #e7e7ea', background: '#fff', color: '#1a1a2e',
          fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 1px 2px rgba(20,20,40,.05)',
        }}
      >
        {pending && pendingAction === 'save' ? <Loader2 size={16} className="animate-spin" style={{ display: 'inline-block', verticalAlign: '-3px', marginRight: 8 }} /> : null}Salva bozza
      </button>

      <p style={{ fontSize: 12, color: '#767676', textAlign: 'center', lineHeight: 1.5, padding: '0 6px' }}>
        Gli appunti vengono copiati nelle <b style={{ color: '#161616' }}>Note interne</b> del preventivo (non visibili al cliente).
      </p>
    </div>
  )
}
