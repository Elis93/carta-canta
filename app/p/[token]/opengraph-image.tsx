import { ImageResponse } from 'next/og'

// Card Open Graph 1200×630 (standard accettato da WhatsApp/Facebook/Telegram):
// logo "firma" centrato su sfondo crema brand.
export const runtime = 'nodejs'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'Carta Canta — il tuo ufficio in tasca'

export default async function OpengraphImage() {
  // Asset colocato con la route → bundlato da Next tramite import.meta.url
  const logo = await fetch(new URL('./logo-firma.png', import.meta.url)).then((r) => r.arrayBuffer())
  const src = `data:image/png;base64,${Buffer.from(logo).toString('base64')}`

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
        {/* logo 900×210 → larghezza 820, altezza proporzionale 191 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} width={820} height={191} alt="Carta Canta" />
      </div>
    ),
    { ...size },
  )
}
