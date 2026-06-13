import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BookOpen, Package, Plus, Search } from 'lucide-react'
import { CatalogItemForm } from './_components/CatalogItemForm'
import { CatalogItemRow } from './_components/CatalogItemRow'
import { AtecoCatalogSuggestion } from './_components/AtecoCatalogSuggestion'
import { getAllAtecoPresets } from '@/lib/catalog/ateco-presets'
import type { Database } from '@/types/database'

type CatalogRow = Database['public']['Tables']['catalog_items']['Row']

export const metadata = { title: 'Catalogo voci' }

interface Props {
  searchParams: Promise<{ q?: string }>
}

export default async function CatalogoPage({ searchParams }: Props) {
  const { q = '' } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let { data: workspace } = await supabase
    .from('workspaces')
    .select('id, ateco_codes')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!workspace) {
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .not('accepted_at', 'is', null)
      .limit(1)
      .maybeSingle()
    if (membership) {
      const { data: mw } = await supabase
        .from('workspaces').select('id, ateco_codes')
        .eq('id', membership.workspace_id)
        .maybeSingle()
      workspace = mw
    }
  }
  if (!workspace) redirect('/login')

  let dbQuery = supabase
    .from('catalog_items')
    .select('*')
    .eq('workspace_id', workspace.id)
    .order('category', { nullsFirst: true })
    .order('name')

  if (q.trim()) {
    dbQuery = dbQuery.or(`name.ilike.%${q}%,description.ilike.%${q}%`)
  }

  const { data: items } = await dbQuery

  // Raggruppa per categoria
  const grouped = (items ?? []).reduce<Record<string, CatalogRow[]>>((acc, item) => {
    const key = item.category ?? '—'
    if (!acc[key]) acc[key] = []
    acc[key]!.push(item)
    return acc
  }, {})

  const categories = Object.keys(grouped).sort((a, b) =>
    a === '—' ? 1 : b === '—' ? -1 : a.localeCompare(b, 'it')
  )

  // Suggerimento ATECO: solo quando il catalogo è vuoto e ci sono codici ATECO mappati
  const atecoCodes = workspace.ateco_codes ?? []
  const atecoPresets = (items?.length ?? 0) === 0 ? getAllAtecoPresets(atecoCodes) : []

  return (
    <div className="max-w-3xl mx-auto">

      {/* ── MOBILE LAYOUT ── */}
      <div className="lg:hidden">
        <div className="px-4 pt-5 pb-3 flex items-center justify-between">
          <span style={{ fontSize: 20, fontWeight: 500, color: 'var(--cc-text)' }}>Catalogo</span>
          <span style={{ fontSize: 13, color: 'var(--cc-text-3)' }}>{items?.length ?? 0} voci</span>
        </div>

        <div className="px-4 space-y-3">
          {/* Search bar — cream background */}
          <form method="get">
            <div
              className="flex items-center gap-2.5 rounded-[9px]"
              style={{ background: '#f0efe9', padding: '11px 13px' }}
            >
              <Search size={17} style={{ color: 'var(--cc-text-3)', flexShrink: 0 }} />
              <input
                name="q"
                defaultValue={q}
                placeholder="Cerca voce…"
                className="flex-1 bg-transparent border-none outline-none text-sm"
                style={{ color: 'var(--cc-text)', fontSize: 14 }}
              />
            </div>
          </form>

          {/* "Nuova voce" — navy full-width anchor al form */}
          <a
            href="#nuova-voce"
            className="flex items-center justify-center gap-2 rounded-[9px] py-3 text-white"
            style={{ background: 'var(--cc-navy)', boxShadow: '0 6px 16px -6px rgba(26,26,46,.5)', fontSize: 14, fontWeight: 500 }}
          >
            <Plus size={17} /> Nuova voce
          </a>
        </div>

        {/* Lista voci — tutti in un solo cc-card-md */}
        {items && items.length > 0 ? (
          <div className="px-4 mt-4">
            <div className="cc-card-md" style={{ padding: '4px 15px' }}>
              {items.map((item, idx) => (
                <div
                  key={item.id}
                  style={{ borderBottom: idx < items.length - 1 ? '0.5px solid var(--cc-border-color)' : 'none' }}
                >
                  <CatalogItemRow item={item} />
                </div>
              ))}
            </div>
          </div>
        ) : atecoPresets.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center gap-2 px-4">
            <Package size={36} style={{ color: 'var(--cc-text-3)', opacity: 0.4 }} />
            <p className="text-sm" style={{ color: 'var(--cc-text-2)' }}>
              {q ? 'Nessuna voce trovata.' : 'Nessuna voce nel catalogo.'}
            </p>
          </div>
        )}

        {/* Suggerimenti ATECO — mobile */}
        {atecoPresets.length > 0 && (
          <div className="px-4 mt-4">
            <AtecoCatalogSuggestion presets={atecoPresets} />
          </div>
        )}

        {/* Form "Nuova voce" — con anchor */}
        <div id="nuova-voce" className="px-4 mt-4 pb-6">
          <div className="cc-card-md" style={{ padding: '14px 15px' }}>
            <div className="cc-section-label mb-3">Aggiungi voce</div>
            <CatalogItemForm />
          </div>
        </div>
      </div>

      {/* ── DESKTOP LAYOUT (invariato) ── */}
      <div className="hidden lg:block p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <BookOpen className="size-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold">Catalogo voci</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {items?.length ?? 0} voci salvate — usale per compilare i preventivi più velocemente
            </p>
          </div>
        </div>

        {/* Form nuova voce */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Aggiungi nuova voce</CardTitle>
            <CardDescription>
              Le voci del catalogo possono essere inserite rapidamente nei preventivi.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CatalogItemForm />
          </CardContent>
        </Card>

        {/* Suggerimento ATECO */}
        {atecoPresets.length > 0 && (
          <AtecoCatalogSuggestion presets={atecoPresets} />
        )}

        {/* Lista voci per categoria */}
        {items && items.length > 0 ? (
          <div className="space-y-4">
            {categories.map((cat) => (
              <Card key={cat} className="overflow-hidden">
                <CardHeader className="py-2.5 px-4 bg-muted/30 border-b">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {cat === '—' ? 'Senza categoria' : cat}
                    <span className="ml-2 font-normal normal-case">
                      ({grouped[cat]?.length ?? 0})
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {(grouped[cat] ?? []).map((item) => (
                    <CatalogItemRow key={item.id} item={item} />
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : atecoPresets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <Package className="size-10 text-muted-foreground/40" />
            <p className="text-muted-foreground text-sm">
              Nessuna voce nel catalogo ancora.<br />
              Aggiungine una sopra per iniziare.
            </p>
            {atecoCodes.length === 0 && (
              <p className="text-xs text-muted-foreground/70 max-w-xs">
                Vuoi ricevere voci preimpostate per il tuo settore?{' '}
                <Link href="/impostazioni" className="underline underline-offset-2 hover:text-foreground">
                  Imposta il codice ATECO
                </Link>
                {' '}nelle impostazioni.
              </p>
            )}
          </div>
        ) : null}
      </div>

    </div>
  )
}
