'use client'

// ============================================================
// WorkPhotosCard — card "Foto lavoro" nel dettaglio documento
// (mockup cantiere §2.1): etichette PRIMA/DOPO a contorno (tap per
// cambiare), occhio per la visibilità al cliente (default: nessuna
// visibile), ✕ per staccare la foto dal documento.
// ============================================================

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Images, Eye, EyeOff, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  addWorkPhotoAction,
  updateWorkPhotoAction,
  deleteWorkPhotoAction,
} from '@/lib/actions/sopralluoghi'
import { uploadWorkPhoto, workPhotoUrl } from '@/lib/photos/upload-client'

const SH = '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)'

export interface WorkPhoto {
  id: string
  storage_path: string
  label: 'prima' | 'dopo' | null
  visible_to_client: boolean
  sopralluogo_id: string | null
}

export function WorkPhotosCard({
  documentId,
  initialPhotos,
}: {
  documentId: string
  initialPhotos: WorkPhoto[]
}) {
  const router = useRouter()
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const [photos, setPhotos] = useState<WorkPhoto[]>(initialPhotos)
  // Quale bottone ha avviato l'upload → lo spinner compare SOLO lì
  const [uploading, setUploading] = useState<'camera' | 'gallery' | null>(null)

  async function handleFiles(files: FileList | null, source: 'camera' | 'gallery') {
    if (!files || files.length === 0) return
    if (files.length > 6) {
      toast.info('Puoi caricare al massimo 6 foto per volta: uso le prime 6.', { closeButton: true })
    }
    setUploading(source)
    try {
      for (const file of Array.from(files).slice(0, 6)) {
        const uploaded = await uploadWorkPhoto(file)
        if ('error' in uploaded) { toast.error(uploaded.error, { duration: 10_000, closeButton: true }); continue }
        const rec = await addWorkPhotoAction({ storagePath: uploaded.path, documentId, label: 'prima' })
        if (rec?.error) { toast.error(rec.error, { duration: 10_000, closeButton: true }); continue }
        setPhotos((prev) => [...prev, {
          id: rec?.id ?? uploaded.path,
          storage_path: uploaded.path,
          label: 'prima',
          visible_to_client: false,
          sopralluogo_id: null,
        }])
      }
      router.refresh()
    } finally {
      setUploading(null)
    }
  }

  function toggleLabel(photo: WorkPhoto) {
    const next = photo.label === 'prima' ? 'dopo' : 'prima'
    setPhotos((prev) => prev.map((p) => (p.id === photo.id ? { ...p, label: next } : p)))
    void updateWorkPhotoAction(photo.id, { label: next }).then((res) => {
      if (res?.error) {
        // Rollback: l'update ottimistico non deve mentire sull'etichetta
        setPhotos((prev) => prev.map((p) => (p.id === photo.id ? { ...p, label: photo.label } : p)))
        toast.error(res.error, { duration: 10_000, closeButton: true })
      }
    })
  }

  function toggleVisible(photo: WorkPhoto) {
    const next = !photo.visible_to_client
    setPhotos((prev) => prev.map((p) => (p.id === photo.id ? { ...p, visible_to_client: next } : p)))
    void updateWorkPhotoAction(photo.id, { visibleToClient: next }).then((res) => {
      if (res?.error) {
        // Rollback: qui l'errore silenzioso è GRAVE (l'artigiano crede che
        // il cliente veda/non veda la foto quando non è vero)
        setPhotos((prev) => prev.map((p) => (p.id === photo.id ? { ...p, visible_to_client: photo.visible_to_client } : p)))
        toast.error(res.error, { duration: 10_000, closeButton: true })
        return
      }
      router.refresh()
    })
  }

  function detach(photo: WorkPhoto) {
    // Foto arrivata da un sopralluogo → si stacca solo dal documento;
    // foto caricata direttamente qui → si elimina DEL TUTTO: chiedi conferma.
    if (!photo.sopralluogo_id) {
      const ok = window.confirm('Eliminare questa foto? Non è collegata a un sopralluogo: verrà cancellata definitivamente.')
      if (!ok) return
    }
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id))
    // Esito controllato: se l'azione fallisce la foto esiste ancora →
    // rollback in lista + toast (stesso pattern del toggle visibilità).
    const rollback = () => {
      setPhotos((prev) => [...prev, photo])
      toast.error('Operazione non riuscita. Riprova.')
    }
    const op = photo.sopralluogo_id
      ? updateWorkPhotoAction(photo.id, { detachFromDocument: true })
      : deleteWorkPhotoAction(photo.id)
    op.then((res) => {
      if (res?.error) rollback()
      else router.refresh()
    }).catch(rollback)
  }

  const btnSm: React.CSSProperties = {
    flex: 1, height: 40, borderRadius: 11, border: '1px solid #e7e7ea', background: '#fff',
    color: '#1a1a2e', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center',
    justifyContent: 'center', gap: 6, cursor: 'pointer', fontFamily: 'inherit',
    boxShadow: '0 1px 2px rgba(20,20,40,.05)',
  }

  return (
    <div style={{ background: '#fff', borderRadius: 14, boxShadow: SH, padding: '14px 15px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: photos.length > 0 ? 12 : 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: '#6f6d64' }}>Foto lavoro</span>
        {photos.length > 0 && <span style={{ fontSize: 12, color: 'var(--cc-muted)' }}>{photos.length} foto</span>}
      </div>

      {photos.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
          {photos.map((p) => (
            <div key={p.id} style={{ position: 'relative', height: 88, borderRadius: 10, overflow: 'hidden', background: '#f2f2f5' }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- storage pubblico */}
              <img src={workPhotoUrl(p.storage_path)} alt={`Foto ${p.label ?? 'lavoro'}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <button
                type="button"
                onClick={() => toggleLabel(p)}
                aria-label={`Etichetta: ${p.label ?? 'nessuna'} — tocca per cambiare`}
                style={{ position: 'absolute', top: 5, left: 5, border: '1px solid rgba(255,255,255,.85)', background: 'rgba(22,22,22,.55)', color: '#fff', borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 700, letterSpacing: '.05em', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                {(p.label ?? 'prima').toUpperCase()}
              </button>
              <button
                type="button"
                onClick={() => detach(p)}
                aria-label="Stacca foto dal documento"
                style={{ position: 'absolute', top: 5, right: 5, width: 22, height: 22, borderRadius: '50%', background: 'rgba(22,22,22,.65)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <X size={13} />
              </button>
              <button
                type="button"
                onClick={() => toggleVisible(p)}
                aria-label={p.visible_to_client ? 'Visibile al cliente — tocca per nascondere' : 'Nascosta al cliente — tocca per mostrare'}
                style={{
                  position: 'absolute', bottom: 5, right: 5, width: 26, height: 26, borderRadius: '50%',
                  background: p.visible_to_client ? '#2f8a63' : 'rgba(22,22,22,.55)',
                  color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                }}
              >
                {p.visible_to_client ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 9, marginTop: photos.length > 0 ? 11 : 4 }}>
        <button type="button" style={btnSm} disabled={uploading !== null} onClick={() => cameraRef.current?.click()}>
          {uploading === 'camera' ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />} Scatta
        </button>
        <button type="button" style={btnSm} disabled={uploading !== null} onClick={() => galleryRef.current?.click()}>
          {uploading === 'gallery' ? <Loader2 size={15} className="animate-spin" /> : <Images size={15} />} Galleria
        </button>
      </div>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={(e) => { void handleFiles(e.target.files, 'camera'); e.target.value = '' }} />
      <input ref={galleryRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={(e) => { void handleFiles(e.target.files, 'gallery'); e.target.value = '' }} />

      <div style={{ height: 1, background: '#eee', margin: '12px -15px' }} />
      <p style={{ fontSize: 12, color: '#767676', lineHeight: 1.55 }}>
        <b style={{ color: '#161616' }}>Di default il cliente non vede nessuna foto.</b> Tocca
        l&rsquo;occhio per scegliere quali mostrare sulla pagina del cliente. La ✕ stacca la foto dal documento.
      </p>
    </div>
  )
}
