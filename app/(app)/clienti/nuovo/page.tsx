import Link from 'next/link'
import { ArrowLeft, X } from 'lucide-react'
import { ClientForm } from '../_components/ClientForm'

export default function NuovoClientePage() {
  return (
    <div className="max-w-2xl mx-auto">
      {/* ── Header mobile: ✕ · Titolo · spacer ── */}
      <div
        className="lg:hidden flex items-center"
        style={{ background: '#fff', borderBottom: '2px solid #c9a44c', padding: '12px 15px' }}
      >
        <Link
          href="/clienti"
          className="flex items-center justify-center"
          style={{ width: 34, height: 34, borderRadius: '50%', background: '#f4f4f5', color: '#55534b', flexShrink: 0 }}
          aria-label="Chiudi"
        >
          <X size={19} />
        </Link>
        <span style={{ flex: 1, textAlign: 'center', fontSize: 18, fontWeight: 600, fontFamily: "Georgia, 'Times New Roman', serif", color: '#1a1a2e' }}>
          Nuovo cliente
        </span>
        <span style={{ width: 34 }} />
      </div>

      <div className="p-4 md:p-6 space-y-5">
        {/* ── Header desktop ── */}
        <div className="hidden lg:block space-y-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/clienti" className="flex items-center gap-1 hover:text-foreground transition-colors">
              <ArrowLeft className="size-3.5" /> Clienti
            </Link>
            <span>/</span>
            <span className="text-foreground font-medium">Nuovo cliente</span>
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Nuovo cliente</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Aggiungi un nuovo cliente alla tua rubrica.
            </p>
          </div>
        </div>
        <ClientForm mode="create" />
      </div>
    </div>
  )
}
