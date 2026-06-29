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
        <img src={logo as unknown as string} width={820} height={191} alt="Carta Canta" />
      </div>
    ),
    { ...size },
  )
}
