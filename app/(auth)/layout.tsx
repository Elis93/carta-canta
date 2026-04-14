import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: {
    default: 'Accedi',
    template: '%s | Carta Canta',
  },
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 px-4">
      {/* Logo */}
      <Link href="/" className="mb-8 flex flex-col items-center gap-2 group">
        <div className="size-10 rounded-xl bg-primary flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow">
          <span className="text-primary-foreground font-bold text-lg leading-none">CC</span>
        </div>
        <span className="text-xl font-semibold tracking-tight">Carta Canta</span>
      </Link>

      {/* Card contenuto */}
      <div className="w-full max-w-sm">{children}</div>

      {/* Footer */}
      <p className="mt-8 text-xs text-muted-foreground text-center">
        &copy; {new Date().getFullYear()} Carta Canta &mdash;{' '}
        <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
          Privacy
        </Link>{' '}
        &middot;{' '}
        <Link href="/termini" className="underline underline-offset-2 hover:text-foreground">
          Termini
        </Link>
      </p>
    </div>
  )
}
