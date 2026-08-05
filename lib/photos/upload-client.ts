'use client'

// Upload foto lavoro (bucket work-photos) — lato client.
// Le foto vengono RIDIMENSIONATE nel browser (max 1600px, JPEG q0.82)
// prima dell'upload: risparmio storage/banda e upload veloci in cantiere.

import { createClient } from '@/lib/supabase/client'
import { PHOTO_URL_TTL } from '@/lib/photos/signed-url'

const MAX_DIMENSION = 1600
const JPEG_QUALITY = 0.82

async function resizeImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
  if (scale >= 1 && file.type === 'image/jpeg' && file.size < 1_500_000) {
    bitmap.close()
    return file
  }
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) { bitmap.close(); return file }
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return await new Promise<Blob>((resolve) => {
    canvas.toBlob((b) => resolve(b ?? file), 'image/jpeg', JPEG_QUALITY)
  })
}

export async function uploadWorkPhoto(file: File): Promise<{ path: string } | { error: string }> {
  if (!file.type.startsWith('image/')) return { error: 'Il file non è un’immagine.' }
  try {
    const blob = await resizeImage(file)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Sessione scaduta. Ricarica la pagina.' }

    const path = `${user.id}/${crypto.randomUUID()}.jpg`
    const { error } = await supabase.storage
      .from('work-photos')
      .upload(path, blob, { contentType: 'image/jpeg', upsert: false })
    if (error) return { error: 'Upload non riuscito. Controlla la connessione e riprova.' }
    return { path }
  } catch {
    return { error: 'Impossibile elaborare la foto. Prova con un altro file.' }
  }
}

/**
 * URL firmate a scadenza per le foto, dal browser (una sola chiamata).
 *
 * ⚠️ Serve per le foto APPENA caricate dall'utente (di cui abbiamo solo il
 * percorso): funziona perché la policy di storage consente la lettura della
 * PROPRIA cartella. Le foto già esistenti — che in un team possono essere
 * state caricate da un collaboratore — arrivano invece già firmate dal server.
 */
export async function signWorkPhotoUrls(paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const unici = [...new Set(paths.filter(Boolean))]
  if (unici.length === 0) return out
  try {
    const supabase = createClient()
    const { data, error } = await supabase.storage
      .from('work-photos')
      .createSignedUrls(unici, PHOTO_URL_TTL)
    if (error || !Array.isArray(data)) return out
    for (const row of data) {
      if (row?.path && row?.signedUrl) out.set(row.path, row.signedUrl)
    }
  } catch { /* niente URL: le miniature restano segnaposto */ }
  return out
}
