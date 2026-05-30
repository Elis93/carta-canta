import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { DefaultTemplateCard } from './_components/DefaultTemplateCard'
import { CustomTemplateCard } from './_components/CustomTemplateCard'
import { LayoutTemplate, Plus, Paintbrush } from 'lucide-react'

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

  // "Template predefinito" è il template di sistema gestito dalla DefaultTemplateCard.
  // Non va mostrato come card custom — va usato solo per le prop della DefaultTemplateCard.
  const systemDefault = templates?.find((t) => t.name === 'Template predefinito')
  const customTemplates = templates?.filter((t) => t.name !== 'Template predefinito') ?? []

  // show_watermark / show_logo del template di sistema (se esiste) — per la DefaultTemplateCard
  const defaultTemplate = templates?.find((t) => t.is_default)
  const defaultShowWatermark = (systemDefault ?? defaultTemplate)?.show_watermark ?? true

  // Il Default card è attivo quando:
  //  - nessun custom template ha is_default=true, OPPURE
  //  - l'unico template con is_default=true è "Template predefinito" (il template di sistema)
  const isDefaultActive = !customTemplates.some((t) => t.is_default)

  const canAddMore = isPro || customTemplates.length < 1

  // legal_notice del template di sistema (se esiste) — per la DefaultTemplateCard
  const defaultLegalNotice = systemDefault?.legal_notice ?? ''

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-8">

      {/* ── Intestazione ── */}
      <div className="flex items-center gap-3 min-w-0">
        <LayoutTemplate className="size-6 text-primary shrink-0" />
        <div className="min-w-0">
        <h1 className="text-2xl font-semibold">Template</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Scegli e personalizza il template dei tuoi preventivi e fatture.
        </p>
        </div>
      </div>

      {/* ── Personalizzazione ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold">Selezione template</h2>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {/* Card Default — sempre prima */}
          <DefaultTemplateCard
            isActive={isDefaultActive}
            workspaceName={workspaceName}
            logoUrl={workspace.logo_url}
            isPro={isPro}
            showWatermark={defaultShowWatermark}
            legalNotice={defaultLegalNotice}
          />

          {/* Template personalizzati (escluso "Template predefinito" di sistema) */}
          {customTemplates.length > 0 ? (
            customTemplates.map((tmpl) => (
              <CustomTemplateCard
                key={tmpl.id}
                id={tmpl.id}
                name={tmpl.name}
                isActive={!!tmpl.is_default}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                presetKey={(tmpl as any).preset_key ?? 'classico'}
                colorPrimary={tmpl.color_primary ?? '#374151'}
                fontFamily={tmpl.font_family ?? 'Inter'}
                showLogo={tmpl.show_logo ?? true}
                showWatermark={tmpl.show_watermark ?? true}
                logoPosition={(tmpl.logo_position as 'left' | 'right') ?? 'left'}
                legalNotice={tmpl.legal_notice ?? ''}
                workspaceName={workspaceName ?? ''}
                logoUrl={workspace.logo_url}
              />
            ))
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
