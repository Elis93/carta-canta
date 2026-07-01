import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { DefaultTemplateCard } from './_components/DefaultTemplateCard'
import { CustomTemplateCard } from './_components/CustomTemplateCard'
import { LayoutTemplate, Plus, Paintbrush, ChevronLeft, ChevronDown, Lock, Crown, Save } from 'lucide-react'

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

  // Per il layout mobile: calcola i valori del template attivo
  const activeCustom = customTemplates.find((t) => t.is_default) ?? null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const activePresetKey: string = isDefaultActive ? ((systemDefault as any)?.preset_key ?? 'classico') : ((activeCustom as any)?.preset_key ?? 'classico')
  const activeColor: string = isDefaultActive ? '#374151' : (activeCustom?.color_primary ?? '#374151')
  const activeFont: string = isDefaultActive ? 'Inter' : (activeCustom?.font_family ?? 'Inter')
  const activeLogo: boolean = isDefaultActive ? true : (activeCustom?.show_logo ?? true)
  const activeWatermark: boolean = isDefaultActive ? (defaultShowWatermark ?? true) : (activeCustom?.show_watermark ?? true)
  const activeLogoPos: string = isDefaultActive ? 'Sinistra' : (activeCustom?.logo_position === 'right' ? 'Destra' : 'Sinistra')
  const activeLegalNotice: string = isDefaultActive ? defaultLegalNotice : (activeCustom?.legal_notice ?? '')
  const templateEditHref: string = activeCustom ? `/template/${activeCustom.id}` : '/template/nuovo'

  // Preset thumbnail visuals — allineati al mockup (chrome pagina, NON TemplatePreview)
  const PRESETS = [
    {
      key: 'classico',
      label: 'Classico',
      thumb: (
        <div style={{ height: 92, borderRadius: 9, border: '1px solid #eee', background: '#fff', padding: 9, overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ width: 42, height: 7, borderRadius: 2, background: '#1a1a2e' }} />
          </div>
          <div style={{ height: 1, background: '#e3e3e6', margin: '7px 0' }} />
          <div style={{ width: '80%', height: 5, borderRadius: 2, background: '#dcdce0', marginBottom: 5 }} />
          <div style={{ width: '65%', height: 5, borderRadius: 2, background: '#dcdce0', marginBottom: 5 }} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
            <div style={{ width: 48, height: 13, borderRadius: 3, background: '#1a1a2e' }} />
          </div>
        </div>
      ),
    },
    {
      key: 'bold',
      label: 'Bold',
      pro: true,
      thumb: (
        <div style={{ height: 92, borderRadius: 9, border: '1px solid #eee', background: '#fff', overflow: 'hidden' }}>
          <div style={{ height: 24, background: '#1a1a2e' }} />
          <div style={{ padding: 9 }}>
            <div style={{ width: '70%', height: 5, borderRadius: 2, background: '#dcdce0', marginBottom: 5 }} />
            <div style={{ width: '55%', height: 5, borderRadius: 2, background: '#dcdce0', marginBottom: 8 }} />
            <div style={{ width: 55, height: 14, borderRadius: 7, background: '#1a1a2e' }} />
          </div>
        </div>
      ),
    },
    {
      key: 'tecnico',
      label: 'Tecnico',
      pro: true,
      thumb: (
        <div style={{ height: 92, borderRadius: 9, border: '1px solid #eee', background: '#fff', padding: 9, overflow: 'hidden' }}>
          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            <div style={{ flex: 1, height: 16, borderRadius: 3, background: '#eef0f3' }} />
            <div style={{ flex: 1, height: 16, borderRadius: 3, background: '#eef0f3' }} />
            <div style={{ flex: 1, height: 16, borderRadius: 3, background: '#eef0f3' }} />
            <div style={{ flex: 1, height: 16, borderRadius: 3, background: '#eef0f3' }} />
          </div>
          <div style={{ width: '80%', height: 5, borderRadius: 2, background: '#dcdce0', marginBottom: 5 }} />
          <div style={{ width: '60%', height: 5, borderRadius: 2, background: '#dcdce0' }} />
        </div>
      ),
    },
    {
      key: 'elegante',
      label: 'Elegante',
      pro: true,
      thumb: (
        <div style={{ height: 92, borderRadius: 9, border: '1px solid #eee', background: '#fff', padding: 9, display: 'flex', flexDirection: 'column', alignItems: 'center', overflow: 'hidden' }}>
          <div style={{ width: 26, height: 26, borderRadius: '50%', border: '1.5px solid #b9b6ac', marginBottom: 7 }} />
          <div style={{ width: '64%', height: 5, borderRadius: 2, background: '#dcdce0', marginBottom: 5 }} />
          <div style={{ width: '46%', height: 5, borderRadius: 2, background: '#dcdce0' }} />
        </div>
      ),
    },
  ]

  return (
    <div className="max-w-4xl mx-auto">

      {/* ── MOBILE LAYOUT ── */}
      <div className="lg:hidden -mx-4 -mt-4 pb-8">
        {/* Header */}
        <div
          className="flex items-center gap-2.5"
          style={{ background: '#fff', borderBottom: '0.5px solid #eeeeee', padding: '12px 15px' }}
        >
          <Link href="/altro" style={{ color: '#55534b', display: 'flex', alignItems: 'center' }}>
            <ChevronLeft size={25} />
          </Link>
          <span style={{ flex: 1, fontSize: 17, fontWeight: 600, color: '#161616' }}>Template documenti</span>
          <span style={{ width: 24 }} />
        </div>

        {/* Griglia 2×2 preset */}
        <div style={{ margin: '14px 15px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11 }}>
          {PRESETS.map((preset) => {
            const isActive = activePresetKey === preset.key
            const locked = isFree && preset.pro
            return (
              <div
                key={preset.key}
                style={{
                  background: '#fff',
                  borderRadius: 12,
                  border: isActive ? '1.5px solid #1a1a2e' : '1px solid #eee',
                  boxShadow: '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)',
                  padding: 9,
                  opacity: locked ? 0.9 : 1,
                }}
              >
                {preset.thumb}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 9 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#161616' }}>{preset.label}</span>
                  {isActive ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, color: '#2f8a63', background: '#d4efe2', borderRadius: 999, padding: '2px 8px' }}>
                      Attivo
                    </span>
                  ) : locked ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, color: '#b08d3e' }}>
                      <Lock size={12} /> Pro
                    </span>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>

        {/* Nota Free */}
        {isFree && (
          <div style={{ margin: '13px 15px 0', fontSize: 12, color: '#767676', lineHeight: 1.45 }}>
            Con il piano Free usi il <b>Classico</b>. Gli altri template e le personalizzazioni (colore, logo, font) sono Pro.
          </div>
        )}

        {/* Card Personalizzazione (Pro) */}
        {isPro && (
          <div style={{ margin: '14px 15px 0', background: '#fff', borderRadius: 14, boxShadow: '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)', padding: '15px 15px' }}>
            <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: '#6f6d64', marginBottom: 12 }}>
              Personalizzazione
            </div>

            {/* Colore brand */}
            <Link href={templateEditHref} className="block">
              <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: '#8a887f', marginBottom: 7 }}>
                Colore brand
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: activeColor, boxShadow: `0 0 0 2px #fff, 0 0 0 4px ${activeColor}` }} />
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#c9a44c' }} />
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#3f6fb0' }} />
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#2f8a63' }} />
                <div style={{ width: 30, height: 30, borderRadius: '50%', border: '1.5px dashed #c9c7bf', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8a887f' }}>
                  <Plus size={15} />
                </div>
              </div>
            </Link>

            <div style={{ height: 14 }} />

            {/* Mostra logo */}
            <Link href={templateEditHref} className="block" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
              <span style={{ fontSize: 14, fontWeight: 500, color: '#161616' }}>Mostra logo</span>
              <div style={{ width: 42, height: 24, borderRadius: 999, background: activeLogo ? '#1a1a2e' : '#e3e3e6', position: 'relative', flex: '0 0 auto' }}>
                <div style={{ position: 'absolute', top: 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', left: activeLogo ? undefined : 2, right: activeLogo ? 2 : undefined, boxShadow: activeLogo ? undefined : '0 1px 2px rgba(0,0,0,.2)' }} />
              </div>
            </Link>

            <div style={{ height: 12 }} />

            {/* Posizione logo */}
            <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: '#8a887f', marginBottom: 7 }}>
              Posizione logo
            </div>
            <Link href={templateEditHref} className="inline-block">
              <div style={{ display: 'inline-flex', background: '#f0f0f2', borderRadius: 10, padding: 3 }}>
                <span style={{ background: activeLogoPos === 'Sinistra' ? '#fff' : 'transparent', borderRadius: 8, padding: '6px 16px', fontSize: 13, fontWeight: activeLogoPos === 'Sinistra' ? 600 : 400, color: activeLogoPos === 'Sinistra' ? '#1a1a2e' : '#8a887f', boxShadow: activeLogoPos === 'Sinistra' ? '0 1px 2px rgba(0,0,0,.08)' : undefined }}>
                  Sinistra
                </span>
                <span style={{ background: activeLogoPos === 'Destra' ? '#fff' : 'transparent', borderRadius: 8, padding: '6px 16px', fontSize: 13, fontWeight: activeLogoPos === 'Destra' ? 600 : 400, color: activeLogoPos === 'Destra' ? '#1a1a2e' : '#8a887f', boxShadow: activeLogoPos === 'Destra' ? '0 1px 2px rgba(0,0,0,.08)' : undefined }}>
                  Destra
                </span>
              </div>
            </Link>

            <div style={{ height: 14 }} />

            {/* Font */}
            <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: '#8a887f', marginBottom: 7 }}>
              Font
            </div>
            <Link href={templateEditHref} className="block" style={{ border: '1px solid #e3e3e6', borderRadius: 10, padding: '11px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ flex: 1, fontSize: 14, color: '#161616' }}>{activeFont}</span>
              <ChevronDown size={18} style={{ color: '#8a887f' }} />
            </Link>

            <div style={{ height: 14 }} />

            {/* Filigrana */}
            <Link href={templateEditHref} className="block" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#161616' }}>Filigrana &ldquo;Carta Canta&rdquo;</div>
                <div style={{ fontSize: 12, color: '#8a887f', marginTop: 2 }}>Con Pro puoi rimuoverla dal PDF</div>
              </div>
              <div style={{ width: 42, height: 24, borderRadius: 999, background: activeWatermark ? '#1a1a2e' : '#e3e3e6', position: 'relative', flex: '0 0 auto' }}>
                <div style={{ position: 'absolute', top: 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', left: activeWatermark ? undefined : 2, right: activeWatermark ? 2 : undefined, boxShadow: activeWatermark ? undefined : '0 1px 2px rgba(0,0,0,.2)' }} />
              </div>
            </Link>

            <div style={{ height: 12 }} />

            {/* Nota legale */}
            <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: '#8a887f', marginBottom: 7 }}>
              Nota legale (facoltativa in fattura)
            </div>
            <Link href={templateEditHref} className="block" style={{ border: '1px solid #e3e3e6', borderRadius: 10, padding: '11px 12px', fontSize: 14, color: activeLegalNotice ? '#161616' : '#8a887f', minHeight: 54 }}>
              {activeLegalNotice || 'Es. Pagamento a 30 giorni data fattura…'}
            </Link>
          </div>
        )}

        {/* Bottone Salva (Pro) */}
        {isPro && (
          <div style={{ padding: '0 15px', marginTop: 16 }}>
            <Link
              href={templateEditHref}
              className="flex items-center justify-center gap-2 text-white"
              style={{ background: '#1a1a2e', borderRadius: 12, height: 50, boxSizing: 'border-box', fontSize: 14, fontWeight: 600, boxShadow: '0 6px 16px -6px rgba(26,26,46,.5)' }}
            >
              <Save size={18} /> Salva
            </Link>
          </div>
        )}
      </div>

      {/* ── DESKTOP LAYOUT (invariato) ── */}
      <div className="hidden lg:block p-4 md:p-6 space-y-8">

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

      </div>{/* fine desktop */}
    </div>
  )
}
