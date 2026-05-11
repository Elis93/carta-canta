import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { SetDefaultButton } from './_components/SetDefaultButton'
import { PresetSelector } from './_components/PresetSelector'
import { LayoutTemplate, Plus, Star, Lock, Paintbrush } from 'lucide-react'

export default async function TemplatePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let { data: workspace } = await supabase
    .from('workspaces')
    .select('id, plan, name, ragione_sociale, logo_url')
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
        .from('workspaces').select('id, plan, name, ragione_sociale, logo_url')
        .eq('id', membership.workspace_id)
        .maybeSingle()
      workspace = mw
    }
  }
  if (!workspace) redirect('/login')

  const { data: templates } = await supabase
    .from('templates')
    .select('*')
    .eq('workspace_id', workspace.id)
    .order('created_at', { ascending: true })

  const isFree = workspace.plan === 'free'
  const isPro = !isFree
  const workspaceName = workspace.ragione_sociale ?? workspace.name

  // Template predefinito (usato per mostrare il preset attivo)
  const defaultTemplate = templates?.find((t) => t.is_default) ?? templates?.[0]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const activePreset: string = (defaultTemplate as any)?.preset_key ?? 'classico'

  const canAddMore = isPro || (templates?.length ?? 0) < 1

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-8">

      {/* ── Intestazione ── */}
      <div>
        <h1 className="text-2xl font-semibold">Template</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Scegli il layout dei tuoi preventivi e personalizza i dettagli grafici.
        </p>
      </div>

      {/* ── Selettore preset ── */}
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold">Layout</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Scegli lo stile visivo di base. Disponibile su tutti i piani.
          </p>
        </div>

        <PresetSelector
          activePreset={activePreset}
          workspaceName={workspaceName}
          logoUrl={workspace.logo_url}
        />
      </section>

      <Separator />

      {/* ── Personalizzazione ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold">Personalizzazione</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isPro
                ? 'Colore brand, logo, font, nota legale e template multipli.'
                : 'Colore brand e logo disponibili su tutti i piani. Font e opzioni avanzate con Pro.'}
            </p>
          </div>
          {isPro ? (
            canAddMore ? (
              <Button asChild size="sm">
                <Link href="/template/nuovo">
                  <Plus className="size-4" /> Nuovo template
                </Link>
              </Button>
            ) : null
          ) : null}
        </div>

        {!isPro ? (
          // Sezione Free: mostra template esistente + upsell
          <div className="space-y-3">
            {/* Template Free corrente */}
            {defaultTemplate && (
              <div className="rounded-xl border bg-card p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="size-8 rounded-md shrink-0"
                    style={{ backgroundColor: defaultTemplate.color_primary ?? '#1a1a2e' }}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{defaultTemplate.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      Preset: {(defaultTemplate as any).preset_key ?? 'classico'} ·{' '}
                      Colore personalizzabile
                    </p>
                  </div>
                </div>
                <Button asChild variant="outline" size="sm" className="shrink-0">
                  <Link href={`/template/${defaultTemplate.id}`}>Modifica</Link>
                </Button>
              </div>
            )}

            {/* Banner upsell Pro */}
            <div className="rounded-xl border bg-muted/30 px-5 py-4 flex items-start gap-4">
              <Paintbrush className="size-5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Sblocca tutte le personalizzazioni con Pro</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Con Pro puoi scegliere il font, la posizione del logo, rimuovere il branding
                  &quot;Generato con Carta Canta&quot;, aggiungere una nota legale personalizzata
                  e salvare template multipli.
                </p>
              </div>
              <Button asChild size="sm" className="shrink-0">
                <Link href="/abbonamento">Scopri Pro</Link>
              </Button>
            </div>
          </div>
        ) : templates && templates.length > 0 ? (
          // Lista template (Pro)
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((tmpl) => (
              <Card key={tmpl.id} className="relative overflow-hidden">
                {/* Preview banda colore */}
                <div
                  className="h-2 w-full"
                  style={{ backgroundColor: tmpl.color_primary ?? '#1a1a2e' }}
                />
                <CardHeader className="pb-2 pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base truncate">{tmpl.name}</CardTitle>
                    {tmpl.is_default && (
                      <Badge variant="secondary" className="text-xs shrink-0 flex items-center gap-1">
                        <Star className="size-3" /> Default
                      </Badge>
                    )}
                  </div>
                  {tmpl.description && (
                    <CardDescription className="text-xs line-clamp-2">
                      {tmpl.description}
                    </CardDescription>
                  )}
                </CardHeader>

                <CardContent className="pb-2">
                  <div className="rounded-lg bg-muted/40 px-3 py-2 text-xs">
                    <p className="font-semibold truncate">
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      Preset: {(tmpl as any).preset_key ?? 'classico'} ·{' '}
                      Font: {tmpl.font_family ?? 'Inter'}
                    </p>
                    <p className="text-muted-foreground">
                      Logo: {tmpl.show_logo ? 'sì' : 'no'} ·
                      Watermark: {tmpl.show_watermark ? 'sì' : 'no'}
                    </p>
                  </div>
                </CardContent>

                <CardFooter className="gap-2 pt-2">
                  <Button asChild variant="outline" size="sm" className="flex-1">
                    <Link href={`/template/${tmpl.id}`}>Modifica</Link>
                  </Button>
                  {!tmpl.is_default && (
                    <SetDefaultButton templateId={tmpl.id} />
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          // Stato vuoto (Pro senza template)
          <div className="flex flex-col items-center justify-center py-12 text-center gap-3 border rounded-xl bg-muted/20">
            <div className="size-10 rounded-full bg-muted flex items-center justify-center">
              <LayoutTemplate className="size-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">Nessun template personalizzato.</p>
            <p className="text-xs text-muted-foreground">
              Crea il tuo primo template per personalizzare colori e font.
            </p>
            <Button asChild size="sm">
              <Link href="/template/nuovo">
                <Plus className="size-4" /> Crea template
              </Link>
            </Button>
          </div>
        )}
      </section>

    </div>
  )
}
