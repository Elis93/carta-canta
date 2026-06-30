import { ImageResponse } from 'next/og'

// Card Open Graph 1200×630 (standard accettato da WhatsApp/Facebook/Telegram):
// logo "firma" centrato su sfondo crema brand.
// Runtime EDGE: è l'unico in cui `fetch(new URL('./asset', import.meta.url))`
// funziona per gli asset colocati (su nodejs il fetch di file:// non è implementato).
export const runtime = 'edge'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'Carta Canta — il tuo ufficio in tasca'

export default async function OpengraphImage() {
  const logo = await fetch(new URL('./logo-firma.png', import.meta.url)).then((r) => r.arrayBuffer())
  // base64 data-URI (btoa è disponibile su edge; Buffer no) → src robusto per <img>
  const bytes = new Uint8Array(logo)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!)
  const src = `data:image/png;base64,${btoa(binary)}`

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f3ede0',
        }}
      >
        {/* logo 900×210 → larghezza 1000, altezza proporzionale 233 (meno margine, ma con aria) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} width={1000} height={233} alt="Carta Canta" />
      </div>
    ),
    { ...size },
  )
}
