import type { Metadata } from 'next'
import Link from 'next/link'
import { logoutAction } from '@/app/(auth)/actions'

export const metadata: Metadata = { title: 'Area studio — Carta Canta' }

// Layout minimale dell'area commercialista: NON usa la shell dell'artigiano
// (niente navigazione dell'app). Header sobrio + contenuto.
export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: '#fafafa', minHeight: '100vh' }}>
      <div style={{ background: '#fff', borderBottom: '0.5px solid #eee', padding: '13px 16px' }}>
        <div className="max-w-3xl mx-auto" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/studio" style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e', textDecoration: 'none' }}>
            Carta Canta <span style={{ color: 'var(--cc-muted)', fontWeight: 500 }}>· Studio</span>
          </Link>
          <form action={logoutAction}>
            <button type="submit" style={{ border: 'none', background: 'none', color: 'var(--cc-muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              Esci
            </button>
          </form>
        </div>
      </div>
      <div className="max-w-3xl mx-auto" style={{ padding: '18px 16px 40px' }}>
        {children}
      </div>
    </div>
  )
}
