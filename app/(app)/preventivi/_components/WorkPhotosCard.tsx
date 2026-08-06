'use client'

// ============================================================
// WorkPhotosCard — card "Foto lavoro" nel dettaglio documento
// (mockup cantiere §2.1): etichette PRIMA/DOPO a contorno (tap per
// cambiare), occhio per la visibilità al cliente (default: nessuna
// visibile), ✕ per staccare la foto dal documento.
// ============================================================

import { useRef, useState } from 'react'
import { runAction } from '@/lib/run-action'
import { useRouter } from 'next/navigation'
import { Camera, Images, Eye, EyeOff, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { usePhotoLightbox, ZoomHotspot } from '@/components/shared/PhotoLightbox'
import {
  addWorkPhotoAction,
  updateWorkPhotoAction,
  deleteWorkPhotoAction,
} from '@/lib/actions/sopralluoghi'
import { uploadWorkPhoto } from '@/lib/photos/upload-client'
import { useSignedPhotos } from '@/lib/photos/use-signed-photos'

const SH = '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)'

export interface WorkPhoto {
  id: string
  storage_path: string
  label: 'prima' | 'dopo' | null
  visible_to_client: boolean
  sopralluogo_id: string | null
  // Foto che appartiene a un ALTRO documento (es. il preventivo di origine
  // mostrato nella fattura): qui è di sola lettura, così un'azione dalla
  // fattura non stacca/elimina/nasconde la foto del preventivo (finding M2).
  readonly?: boolean
}

export function WorkPhotosCard({
  documentId,
  initialPhotos,
  initialSignedUrls,
}: {
  documentId: string
  initialPhotos: WorkPhoto[]
  /** URL firmate dal server per le foto già presenti — servono ai collaboratori
      (in un team le foto stanno nella cartella di chi le ha caricate). */
  initialSignedUrls?: Record<string, string>
}) {
  const router = useRouter()
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const [photos, setPhotos] = useState<WorkPhoto[]>(initialPhotos)
  // Archivio privato: gli indirizzi delle miniature si chiedono e scadono.
  const photoUrls = useSignedPhotos(photos.map((p) => p.storage_path), initialSignedUrls)
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
        const rec = await runAction(() => addWorkPhotoAction({ storagePath: uploaded.path, documentId, label: 'prima' }), 'allegare la foto')
        // break, non continue: gli errori dell'action valgono per TUTTO il
        // documento (rapportino firmato, tetto foto Free) — continuare
        // produrrebbe N toast identici e N upload inutili (review 25 lug D1).
        if (rec?.error) { toast.error(rec.error, { duration: 10_000, closeButton: true }); break }
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
    // runAction: senza rete la promise verrebbe RIFIUTATA e il .then non
    // partirebbe → nessun rollback e nessun avviso, con l'etichetta che
    // mente. Così il guasto arriva come { error } e il rollback scatta.
    void runAction(() => updateWorkPhotoAction(photo.id, { label: next }), 'cambiare l’etichetta della foto').then((res) => {
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
    void runAction(() => updateWorkPhotoAction(photo.id, { visibleToClient: next }), 'cambiare la visibilità della foto').then((res) => {
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
    const rollback = (msg?: string) => {
      setPhotos((prev) => [...prev, photo])
      toast.error(msg ?? 'Operazione non riuscita. Riprova.', { closeButton: true })
    }
    const op = photo.sopralluogo_id
      ? updateWorkPhotoAction(photo.id, { detachFromDocument: true })
      : deleteWorkPhotoAction(photo.id)
    op.then((res) => {
      if (res?.error) rollback(res.error)
      else router.refresh()
    }).catch(() => rollback())
  }

  const btnSm: React.CSSProperties = {
    flex: 1, height: 40, borderRadius: 11, border: '1px solid #e7e7ea', background: '#fff',
    color: '#1a1a2e', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center',
    justifyContent: 'center', gap: 6, cursor: 'pointer', fontFamily: 'inherit',
    boxShadow: '0 1px 2px rgba(20,20,40,.05)',
  }

  // Ingrandimento della foto toccata. L'ordine dell'elenco qui è lo stesso
  // della griglia sotto, quindi l'indice combacia.
  const { openPhoto, lightbox } = usePhotoLightbox(
    photos.map((p) => ({ src: photoUrls.get(p.storage_path), label: p.label })),
  )

  return (
    <div style={{ background: '#fff', borderRadius: 14, boxShadow: SH, padding: '14px 15px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: photos.length > 0 ? 12 : 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: '#6f6d64' }}>Foto lavoro</span>
        {photos.length > 0 && <span style={{ fontSize: 12, color: 'var(--cc-muted)' }}>{photos.length} foto</span>}
      </div>

      {photos.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
          {photos.map((p, i) => (
            <div key={p.id} style={{ position: 'relative', height: 88, borderRadius: 10, overflow: 'hidden', background: '#f2f2f5' }}>
              {/* Finché l'indirizzo firmato non è arrivato resta il riquadro grigio:
                  un src vuoto farebbe partire una richiesta alla pagina stessa e
                  mostrerebbe l'icona di immagine rotta. */}
              {photoUrls.has(p.storage_path) && (
                /* eslint-disable-next-line @next/next/no-img-element -- URL firmata dello storage */
                <img src={photoUrls.get(p.storage_path)} alt={`Foto ${p.label ?? 'lavoro'}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              )}
              {/* Tocco sulla foto = ingrandimento. Sta PRIMA dei controlli e a
                  zIndex più basso, così etichetta / ✕ / occhio restano cliccabili
                  al loro posto e il resto della miniatura apre la foto grande. */}
              {photoUrls.has(p.storage_path) && (
                <ZoomHotspot onClick={() => openPhoto(i)} label={`Ingrandisci la foto ${p.label ?? 'del lavoro'}`} />
              )}
              {p.readonly ? (
                // Foto del preventivo di origine: solo lettura dalla fattura.
                <span
                  style={{ position: 'absolute', zIndex: 2, top: 5, left: 5, border: '1px solid rgba(255,255,255,.85)', background: 'rgba(22,22,22,.55)', color: '#fff', borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 700, letterSpacing: '.05em', fontFamily: 'inherit' }}
                >
                  {(p.label ?? 'prima').toUpperCase()}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => toggleLabel(p)}
                  aria-label={`Etichetta: ${p.label ?? 'nessuna'} — tocca per cambiare`}
                  style={{ position: 'absolute', zIndex: 2, top: 5, left: 5, border: '1px solid rgba(255,255,255,.85)', background: 'rgba(22,22,22,.55)', color: '#fff', borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 700, letterSpacing: '.05em', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  {(p.label ?? 'prima').toUpperCase()}
                </button>
              )}
              {p.readonly ? (
                <span
                  title="Foto del preventivo di origine — si gestisce dalla scheda del preventivo"
                  style={{ position: 'absolute', zIndex: 2, top: 5, right: 5, background: 'rgba(22,22,22,.65)', color: '#fff', borderRadius: 999, padding: '2px 7px', fontSize: 10, fontWeight: 600, letterSpacing: '.03em', fontFamily: 'inherit' }}
                >
                  dal preventivo
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => detach(p)}
                  aria-label="Stacca foto dal documento"
                  style={{ position: 'absolute', zIndex: 2, top: 5, right: 5, width: 22, height: 22, borderRadius: '50%', background: 'rgba(22,22,22,.65)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                >
                  <X size={13} />
                </button>
              )}
              {p.readonly ? (
                // Indicatore di visibilità NON interattivo: dice se il cliente
                // la vede, senza poterla cambiare dalla fattura.
                <span
                  aria-label={p.visible_to_client ? 'Visibile al cliente (dal preventivo)' : 'Nascosta al cliente (dal preventivo)'}
                  style={{
                    position: 'absolute', zIndex: 2, bottom: 5, right: 5, width: 26, height: 26, borderRadius: '50%',
                    background: p.visible_to_client ? '#2f8a63' : 'rgba(22,22,22,.55)',
                    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: .9,
                  }}
                >
                  {p.visible_to_client ? <Eye size={14} /> : <EyeOff size={14} />}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => toggleVisible(p)}
                  aria-label={p.visible_to_client ? 'Visibile al cliente — tocca per nascondere' : 'Nascosta al cliente — tocca per mostrare'}
                  style={{
                    position: 'absolute', zIndex: 2, bottom: 5, right: 5, width: 26, height: 26, borderRadius: '50%',
                    background: p.visible_to_client ? '#2f8a63' : 'rgba(22,22,22,.55)',
                    color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                  }}
                >
                  {p.visible_to_client ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
              )}
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
        <b style={{ color: '#161616' }}>Di default il cliente non vede nessuna foto.</b>{' '}Tocca
        l&rsquo;occhio per scegliere quali mostrare sulla pagina del cliente. La ✕ stacca la foto dal documento.
        {photos.length > 0 && <>{' '}Tocca la foto per ingrandirla.</>}
      </p>
      {photos.some((p) => p.readonly) && (
        <p style={{ fontSize: 12, color: '#767676', lineHeight: 1.55, marginTop: 6 }}>
          Le foto con l&rsquo;etichetta{' '}<b style={{ color: '#161616' }}>dal preventivo</b>{' '}arrivano
          dal preventivo di origine: qui le vedi soltanto. Per cambiarle o nasconderle apri la scheda di quel preventivo.
        </p>
      )}

      {lightbox}
    </div>
  )
}
