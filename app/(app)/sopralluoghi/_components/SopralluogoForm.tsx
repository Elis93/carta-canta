'use client'

// ============================================================
// SopralluogoForm — editor appunti di cantiere (mockup cantiere §1.2)
// Foglio libero + dettatura + foto + chip rapidi. "Trasforma in
// preventivo" crea la bozza con appunti nelle Note interne.
// ============================================================

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Loader2, X, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { ClientAutocomplete } from '@/components/shared/ClientAutocomplete'
import type { ClientHit } from '@/components/shared/QuickCreateClientDialog'
import { VoiceInput } from '@/components/shared/VoiceInput'
import {
  saveSopralluogoAction,
  addWorkPhotoAction,
  deleteWorkPhotoAction,
  createPreventivoFromSopralluogoAction,
} from '@/lib/actions/sopralluoghi'
import { uploadWorkPhoto, workPhotoUrl } from '@/lib/photos/upload-client'

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
  client: ClientHit | null
  documentId: string | null
  photos: SopralluogoPhoto[]
}

const CHIPS: Array<{ label: string; text: string }> = [
  { label: '➕ Misure', text: 'Misure: ' },
  { label: '➕ Materiali', text: 'Materiali: ' },
  { label: '➕ Manodopera', text: 'Manodopera: ore previste ' },
]

export function SopralluogoForm({ defaults }: { defaults: SopralluogoDefaults | null }) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [sopId, setSopId] = useState<string | null>(defaults?.id ?? null)
  const [title, setTitle] = useState(defaults?.title ?? '')
  const [address, setAddress] = useState(defaults?.address ?? '')
  const [notes, setNotes] = useState(defaults?.notes ?? '')
  const [client, setClient] = useState<ClientHit | null>(defaults?.client ?? null)
  const [photos, setPhotos] = useState<SopralluogoPhoto[]>(defaults?.photos ?? [])
  const [uploading, setUploading] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function buildFormData(): FormData {
    const fd = new FormData()
    if (sopId) fd.set('id', sopId)
    fd.set('title', title)
    fd.set('address', address)
    fd.set('notes', notes)
    fd.set('client_id', client?.id ?? '')
    return fd
  }

  /** Salva (creandolo se serve) e restituisce l'id — usato anche per le foto. */
  async function ensureSaved(): Promise<string | null> {
    const result = await saveSopralluogoAction(buildFormData())
    if (result?.error) {
      setError(result.error)
      return null
    }
    const id = result?.id ?? sopId
    if (id && !sopId) setSopId(id)
    return id ?? null
  }

  function handleSaveDraft() {
    setError(null)
    startTransition(async () => {
      const id = await ensureSaved()
      if (!id) return
      toast.success('Sopralluogo salvato', { description: 'Lo ritrovi nella lista Sopralluoghi.', duration: 10_000, closeButton: true })
      router.push('/sopralluoghi')
      router.refresh()
    })
  }

  function handleTransform() {
    setError(null)
    startTransition(async () => {
      const id = await ensureSaved()
      if (!id) return
      // Il redirect avviene nel server action (throw NEXT_REDIRECT)
      const result = await createPreventivoFromSopralluogoAction(id)
      if (result?.error) setError(result.error)
    })
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setError(null)
    setUploading(true)
    try {
      const id = sopId ?? (await ensureSaved())
      if (!id) return
      for (const file of Array.from(files).slice(0, 6)) {
        const uploaded = await uploadWorkPhoto(file)
        if ('error' in uploaded) { setError(uploaded.error); continue }
        const rec = await addWorkPhotoAction({ storagePath: uploaded.path, sopralluogoId: id })
        if (rec?.error) { setError(rec.error); continue }
        setPhotos((prev) => [...prev, { id: rec?.id ?? uploaded.path, storage_path: uploaded.path }])
      }
    } finally {
      setUploading(false)
    }
  }

  function handleDeletePhoto(photo: SopralluogoPhoto) {
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id))
    void deleteWorkPhotoAction(photo.id)
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
      </div>

      {/* Foto */}
      <div style={cardStyle}>
        <div style={secLabel}>Foto {photos.length > 0 && <span style={{ letterSpacing: 0, color: '#8a887f', textTransform: 'none' }}>({photos.length})</span>}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {photos.map((p) => (
            <div key={p.id} style={{ position: 'relative', height: 76, borderRadius: 10, overflow: 'hidden', background: '#f2f2f5' }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- storage pubblico, niente next/image per le anteprime */}
              <img src={workPhotoUrl(p.storage_path)} alt="Foto sopralluogo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            style={{ height: 76, borderRadius: 10, border: '1.5px dashed #d8d8dc', background: '#fff', color: '#8a887f', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            aria-label="Aggiungi foto"
          >
            {uploading ? <Loader2 size={18} className="animate-spin" /> : <Camera size={19} />}
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => { void handleFiles(e.target.files); e.target.value = '' }}
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
        {pending ? <Loader2 size={18} className="animate-spin" /> : <FileText size={17} />}
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
        Salva bozza
      </button>

      <p style={{ fontSize: 12, color: '#767676', textAlign: 'center', lineHeight: 1.5, padding: '0 6px' }}>
        Gli appunti vengono copiati nelle <b style={{ color: '#161616' }}>Note interne</b> del preventivo (non visibili al cliente).
      </p>
    </div>
  )
}
