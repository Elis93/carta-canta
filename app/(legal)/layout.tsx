import Link from 'next/link'
import { FileText } from 'lucide-react'

// Layout minimale per le pagine legali pubbliche (/privacy, /termini).
// Header con logo + ritorno alla home e footer con i link legali.
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <span className="font-semibold tracking-tight">Carta Canta</span>
          </Link>
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Home
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">{children}</main>

      <footer className="border-t py-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} Carta Canta</span>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link href="/termini" className="hover:text-foreground">Termini</Link>
            <Link href="/cancella-account" className="hover:text-foreground">Cancella account</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
