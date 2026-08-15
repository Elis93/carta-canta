import { Trash2 } from 'lucide-react'
import { BackButton } from '@/components/shared/BackButton'
import { CestinoInline } from '../_components/CestinoInline'

export const metadata = { title: 'Cestino' }

// La vista dei documenti eliminati (tutti i tipi). Il caricamento, il
// ripristino e l'eliminazione definitiva vivono in <CestinoInline/>, la stessa
// che i tab «Cestino» dentro Preventivi e Fatture usano filtrata per tipo:
// una sola logica, nessuna divergenza.
export default function CestinoPage() {
  return (
    <div className="max-w-3xl mx-auto">
      {/* Header — mobile */}
      <div
        className="flex items-center gap-2.5 lg:hidden"
        style={{ background: '#fff', borderBottom: '2px solid #c9a44c', padding: '12px 15px' }}
      >
        <BackButton fallback="/altro" />
        <span style={{ flex: 1, fontSize: 18, fontWeight: 600, fontFamily: "Georgia, 'Times New Roman', serif", color: '#1a1a2e' }}>Cestino</span>
        <span style={{ width: 24 }} />
      </div>

      {/* Header — desktop */}
      <div className="hidden lg:block p-4 md:p-6 pb-0 space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <BackButton fallback="/altro" />
          <span className="text-foreground font-medium flex items-center gap-1.5">
            <Trash2 className="size-3.5" /> Cestino
          </span>
        </div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Trash2 className="size-6 text-muted-foreground" />
          Cestino
        </h1>
      </div>

      <div style={{ padding: '14px 15px 32px' }} className="lg:px-6">
        <CestinoInline />
      </div>
    </div>
  )
}
