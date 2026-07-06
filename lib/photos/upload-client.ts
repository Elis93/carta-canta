'use client'

// Upload foto lavoro (bucket work-photos) — lato client.
// Le foto vengono RIDIMENSIONATE nel browser (max 1600px, JPEG q0.82)
// prima dell'upload: risparmio storage/banda e upload veloci in cantiere.

import { createClient } from '@/lib/supabase/client'

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

export function workPhotoUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  return `${base}/storage/v1/object/public/work-photos/${path}`
}
