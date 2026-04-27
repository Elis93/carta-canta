import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BookOpen, Package } from 'lucide-react'
import { CatalogItemForm } from './_components/CatalogItemForm'
import { CatalogItemRow } from './_components/CatalogItemRow'
import type { Database } from '@/types/database'

type CatalogRow = Database['public']['Tables']['catalog_items']['Row']

export const metadata = { title: 'Catalogo voci' }

export default async function CatalogoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
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
        .from('workspaces').select('id')
        .eq('id', membership.workspace_id)
        .maybeSingle()
      workspace = mw
    }
  }
  if (!workspace) redirect('/login')

  const { data: items } = await supabase
    .from('catalog_items')
    .select('*')
    .eq('workspace_id', workspace.id)
    .order('category', { nullsFirst: true })
    .order('name')

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

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
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
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <Package className="size-10 text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm">
            Nessuna voce nel catalogo ancora.<br />
            Aggiungine una sopra per iniziare.
          </p>
        </div>
      )}
    </div>
  )
}
