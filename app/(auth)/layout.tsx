import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: {
    default: 'Accedi',
    template: '%s | Carta Canta',
  },
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center" style={{ background: '#fff' }}>
      {/* Frame mobile — la pagina controlla il proprio layout (mockup 392px) */}
      <div className="w-full max-w-[420px]">{children}</div>
    </div>
  )
}
