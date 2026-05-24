import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { SetDefaultButton } from './_components/SetDefaultButton'
import { DefaultTemplateCard } from './_components/DefaultTemplateCard'
import { LayoutTemplate, Plus, Star, Paintbrush } from 'lucide-react'

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

  // Il Default card è attivo quando nessun template ha is_default = true
  const isDefaultActive = !templates?.some((t) => t.is_default)

  const canAddMore = isPro || (templates?.length ?? 0) < 1

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-8">

      {/* ── Intestazione ── */}
      <div>
        <h1 className="text-2xl font-semibold">Template</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Scegli e personalizza il template dei tuoi preventivi e fatture.
        </p>
      </div>

      {/* ── Personalizzazione ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold">Template attivo</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isPro
                ? 'Colore brand, logo, font, nota legale e template multipli.'
                : 'Personalizza colore e logo. Con Pro sblocchi font, posizione logo, branding e altro.'}
            </p>
          </div>
          {isPro && canAddMore && (
            <Button asChild size="sm">
              <Link href="/template/nuovo">
                <Plus className="size-4" /> Nuovo template
              </Link>
            </Button>
          )}
        </div>

        {/* Griglia template */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {/* Card Default — sempre prima */}
          <DefaultTemplateCard
            isActive={isDefaultActive}
            workspaceName={workspaceName}
            logoUrl={workspace.logo_url}
          />

          {/* Template personalizzati */}
          {templates && templates.length > 0 ? (
            isPro ? (
              // Lista Pro: card complete con modifica/default
              templates.map((tmpl) => (
                <Card key={tmpl.id} className="relative overflow-hidden flex flex-col">
                  {/* Striscia colore */}
                  <div
                    className="h-2 w-full shrink-0"
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

                  <CardContent className="pb-2 flex-1">
                    <div className="rounded-lg bg-muted/40 px-3 py-2 text-xs">
                      <p className="font-semibold truncate">
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        Preset: {(tmpl as any).preset_key ?? 'classico'} · Font: {tmpl.font_family ?? 'Inter'}
                      </p>
                      <p className="text-muted-foreground">
                        Logo: {tmpl.show_logo ? 'sì' : 'no'} · Watermark: {tmpl.show_watermark ? 'sì' : 'no'}
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
              ))
            ) : (
              // Free: singola card compatta
              templates.map((tmpl) => (
                <div
                  key={tmpl.id}
                  className="rounded-xl border bg-card p-3 flex flex-col gap-2 relative overflow-hidden col-span-1"
                >
                  {tmpl.is_default && (
                    <div className="absolute top-2.5 right-2.5">
                      <div className="size-5 rounded-full bg-primary flex items-center justify-center">
                        <Star className="size-3 text-primary-foreground" />
                      </div>
                    </div>
                  )}
                  <div
                    className="h-2 w-full rounded-full"
                    style={{ backgroundColor: tmpl.color_primary ?? '#1a1a2e' }}
                  />
                  <p className="text-sm font-semibold truncate pr-6">{tmpl.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    Preset: {(tmpl as any).preset_key ?? 'classico'}
                  </p>
                  <div className="flex gap-2 mt-auto pt-1">
                    <Button asChild variant="outline" size="sm" className="flex-1">
                      <Link href={`/template/${tmpl.id}`}>Modifica</Link>
                    </Button>
                    {!tmpl.is_default && (
                      <SetDefaultButton templateId={tmpl.id} />
                    )}
                  </div>
                </div>
              ))
            )
          ) : (
            // Nessun template personalizzato: pulsante crea
            <div className="rounded-xl border border-dashed bg-muted/20 p-3 flex flex-col items-center justify-center gap-2 text-center min-h-[160px]">
              <LayoutTemplate className="size-5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                {isPro ? 'Crea un template personalizzato.' : 'Personalizza colore e logo.'}
              </p>
              {canAddMore && (
                <Button asChild variant="outline" size="sm">
                  <Link href="/template/nuovo">
                    <Plus className="size-3.5" /> {isPro ? 'Crea' : 'Personalizza'}
                  </Link>
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Banner upsell Free */}
        {!isPro && (
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
        )}
      </section>

    </div>
  )
}
