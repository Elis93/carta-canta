import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSessionWorkspace } from '@/lib/workspace-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BookOpen, Package, Plus, Search, Sparkles, Camera, Crown, Wand2 } from 'lucide-react'
import { CatalogItemForm } from './_components/CatalogItemForm'
import { CatalogItemRow } from './_components/CatalogItemRow'
import { AtecoCatalogSuggestion } from './_components/AtecoCatalogSuggestion'
import { getAllAtecoPresets } from '@/lib/catalog/ateco-presets'
import { getAiImportQuota, AI_IMPORT_PRO_MONTHLY } from '@/lib/ai/quota'
import { SearchBar } from '@/components/shared/SearchBar'
import type { Database } from '@/types/database'

type CatalogRow = Database['public']['Tables']['catalog_items']['Row']

export const metadata = { title: 'Catalogo voci' }

interface Props {
  searchParams: Promise<{ q?: string }>
}

export default async function CatalogoPage({ searchParams }: Props) {
  const { q = '' } = await searchParams
  const { supabase, user, workspace } = await getSessionWorkspace()
  if (!user) redirect('/login')
  if (!workspace) redirect('/login')

  let dbQuery = supabase
    .from('catalog_items')
    .select('*')
    .eq('workspace_id', workspace.id)
    .order('category', { nullsFirst: true })
    .order('name')

  if (q.trim()) {
    // Virgole/parentesi romperebbero la sintassi del filtro .or() di PostgREST
    const safe = q.replace(/[,()]/g, ' ').replace(/[%_\\]/g, (c) => `\\${c}`)
    dbQuery = dbQuery.or(`name.ilike.%${safe}%,description.ilike.%${safe}%`)
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

  // Suggerimento ATECO: solo quando il catalogo è DAVVERO vuoto (non quando
  // è una ricerca a non trovare nulla: `items` qui è già filtrato da q).
  const atecoCodes = workspace.ateco_codes ?? []
  const atecoPresets = !q && (items?.length ?? 0) === 0 ? getAllAtecoPresets(atecoCodes) : []

  // AI Import (flag NEXT_PUBLIC_AI_IMPORT_ENABLED): quota per la card entry-point
  const aiImportEnabled = process.env.NEXT_PUBLIC_AI_IMPORT_ENABLED === 'true'
  const aiQuota = aiImportEnabled ? await getAiImportQuota(workspace.id, workspace.plan) : null

  return (
    <div className="max-w-3xl mx-auto">

      {/* ── MOBILE LAYOUT ── */}
      <div className="lg:hidden">
        {/* Fascia titolo bianca */}
        <div className="cc-title-band" style={{ padding: '15px 15px 13px' }}>
          <div className="cc-page-title" style={{ fontSize: 22 }}>Catalogo</div>
        </div>

        {/* Search bar */}
        <form method="get" style={{ margin: '14px 15px 0' }}>
          <div
            className="flex items-center"
            style={{ gap: 9, background: '#fff', border: '1px solid #e3e3e6', boxShadow: '0 1px 2px rgba(20,20,40,.04)', borderRadius: 11, padding: '11px 13px' }}
          >
            <Search size={18} style={{ color: '#8a887f', flexShrink: 0 }} />
            <input
              name="q"
              defaultValue={q}
              placeholder="Cerca voce…"
              className="flex-1 bg-transparent border-none outline-none"
              style={{ color: '#161616', fontSize: 14 }}
            />
          </div>
        </form>

        {/* AI Import — card entry-point (mockup ai_import schermata 1/5) */}
        {aiQuota && (
          <div style={{ margin: '14px 15px 0', background: '#fff', borderLeft: '3px solid #c9a44c', borderRadius: 14, boxShadow: '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)', padding: '13px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <Sparkles size={19} style={{ color: '#b08d3e', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#161616' }}>Importa il tuo listino</div>
                <div style={{ fontSize: 12, color: '#767676', marginTop: 2, lineHeight: 1.5 }}>
                  {aiQuota.allowed
                    ? 'Foto o PDF del tuo vecchio listino: l’AI aggiunge le voci qui nel catalogo.'
                    : aiQuota.reason === 'pro_monthly'
                      ? 'Hai usato gli import di questo mese. Si ricaricano il mese prossimo.'
                      : <>Hai finito gli import gratuiti. <b>Con Pro importi quando vuoi.</b></>}
                </div>
              </div>
            </div>
            {aiQuota.allowed ? (
              <>
                <div style={{ marginTop: 9 }}>
                  <span style={{ display: 'inline-block', border: '1px solid #e8d6ad', color: '#b0863e', fontSize: 11, fontWeight: 600, borderRadius: 999, padding: '2px 9px' }}>
                    {aiQuota.isPro
                      ? `${aiQuota.remaining} di ${AI_IMPORT_PRO_MONTHLY} import disponibili questo mese`
                      : `${aiQuota.remaining} import gratuito disponibile`}
                  </span>
                </div>
                {/* CTA in stile oro (coerente con la card): il navy resta solo
                    su "Nuova voce" — un solo bottone primario per schermata
                    (feedback Eli 6 lug) */}
                <Link
                  href="/catalogo/importa"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, height: 42, borderRadius: 11, background: '#fff', border: '1px solid #e0c98f', color: '#b0863e', fontSize: 13, fontWeight: 600, textDecoration: 'none', boxShadow: '0 1px 2px rgba(20,20,40,.05)', marginTop: 11 }}
                >
                  <Camera size={15} /> Importa con AI
                </Link>
              </>
            ) : (aiQuota.reason === 'free_used' || aiQuota.reason === 'tank_empty') ? (
              <Link
                href="/abbonamento"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, height: 42, borderRadius: 11, background: '#fff', border: '1px solid #e0c98f', color: '#b0863e', fontSize: 13, fontWeight: 600, textDecoration: 'none', boxShadow: '0 1px 2px rgba(20,20,40,.05)', marginTop: 11 }}
              >
                <Crown size={15} style={{ color: '#c9a44c' }} /> Passa a Pro
              </Link>
            ) : null}
          </div>
        )}

        {/* "Nuova voce" — navy full-width anchor al form */}
        <a
          href="#nuova-voce"
          className="flex items-center justify-center text-white"
          style={{ margin: '14px 15px 0', gap: 8, background: '#1a1a2e', borderRadius: 11, padding: 13, boxShadow: '0 6px 16px -6px rgba(26,26,46,.5)', fontSize: 14, fontWeight: 600 }}
        >
          <Plus size={18} /> Nuova voce
        </a>

        {/* Lista voci — raggruppata per categoria con bande #ececef */}
        {items && items.length > 0 ? (
          <div style={{ margin: '14px 15px 0' }}>
            <div className="cc-card-md" style={{ padding: '4px 15px' }}>
              {categories.map((cat, catIdx) => {
                const catItems = grouped[cat] ?? []
                return (
                  <div key={cat}>
                    {catIdx > 0 && <div style={{ height: 6 }} />}
                    <div
                      style={{
                        background: '#ececef', margin: '0 -15px', padding: '7px 15px',
                        fontSize: 11, fontWeight: 700, letterSpacing: '.05em',
                        textTransform: 'uppercase', color: '#6f6d64',
                      }}
                    >
                      {cat === '—' ? 'Senza categoria' : cat}
                    </div>
                    {catItems.map((item, idx) => (
                      <div
                        key={item.id}
                        style={{ borderBottom: idx < catItems.length - 1 ? '0.5px solid #eee' : 'none' }}
                      >
                        <CatalogItemRow item={item} />
                      </div>
                    ))}
                  </div>
                )
              })}
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
          <div style={{ margin: '14px 15px 0' }}>
            <AtecoCatalogSuggestion presets={atecoPresets} />
          </div>
        )}

        {/* Form "Nuova voce" — con anchor */}
        <div id="nuova-voce" style={{ margin: '14px 15px 0', paddingBottom: 24 }}>
          <div className="cc-card-md" style={{ padding: '15px 15px' }}>
            <div className="cc-section-label" style={{ marginBottom: 12 }}>Aggiungi voce</div>
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
          {/* Entry-point AI anche su desktop (prima era solo nella card mobile) */}
          {aiImportEnabled && (
            <Link
              href="/catalogo/importa"
              className="ml-auto inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold"
              style={{ borderColor: '#e6d3a4', background: '#fdf9ef', color: '#8a6d1f' }}
            >
              <Wand2 className="size-4" /> Importa con AI
            </Link>
          )}
        </div>

        {/* Ricerca — prima esisteva solo su mobile */}
        <SearchBar placeholder="Cerca voce o descrizione…" className="max-w-sm" />

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
                <Link href="/impostazioni?tab=fiscale#ateco" className="underline underline-offset-2 hover:text-foreground">
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
