import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { DefaultTemplateCard } from './_components/DefaultTemplateCard'
import { CustomTemplateCard } from './_components/CustomTemplateCard'
import { LayoutTemplate, Plus, Paintbrush, ChevronLeft, ChevronRight, Lock, Crown, Eye } from 'lucide-react'

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
  const templateEditHref: string = activeCustom ? `/template/${activeCustom.id}` : '/template/nuovo'

  // Preset thumbnail visuals
  const PRESETS = [
    {
      key: 'classico',
      label: 'Classico',
      thumb: (
        <div style={{ height: 66, borderRadius: 8, background: '#f4f4f1', padding: 9, display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ height: 8, width: '60%', background: '#c8cdd6', borderRadius: 2 }} />
          <div style={{ height: 5, width: '90%', background: '#dfe2e8', borderRadius: 2 }} />
          <div style={{ height: 5, width: '80%', background: '#dfe2e8', borderRadius: 2 }} />
        </div>
      ),
    },
    {
      key: 'bold',
      label: 'Bold',
      pro: true,
      thumb: (
        <div style={{ height: 66, borderRadius: 8, background: '#1a1a2e', padding: 9, display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ height: 10, width: '55%', background: '#5b6072', borderRadius: 2 }} />
          <div style={{ height: 5, width: '85%', background: '#3a3f4f', borderRadius: 2 }} />
        </div>
      ),
    },
    {
      key: 'tecnico',
      label: 'Tecnico',
      pro: true,
      thumb: (
        <div style={{ height: 66, borderRadius: 8, background: '#f4f4f1', borderTop: '3px solid #1a1a2e', padding: 9, display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ height: 7, width: '50%', background: '#c8cdd6', borderRadius: 2 }} />
          <div style={{ height: 5, width: '88%', background: '#dfe2e8', borderRadius: 2 }} />
          <div style={{ height: 5, width: '70%', background: '#dfe2e8', borderRadius: 2 }} />
        </div>
      ),
    },
    {
      key: 'elegante',
      label: 'Elegante',
      pro: true,
      thumb: (
        <div style={{ height: 66, borderRadius: 8, background: '#faf8f3', padding: 9, display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ height: 9, width: '55%', background: '#cdbf9e', borderRadius: 2 }} />
          <div style={{ height: 5, width: '40%', background: '#e4dcc8', borderRadius: 2 }} />
        </div>
      ),
    },
  ]

  return (
    <div className="max-w-4xl mx-auto">

      {/* ── MOBILE LAYOUT ── */}
      <div className="lg:hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-[var(--cc-border-color)]">
          <Link href="/altro" style={{ color: 'var(--cc-navy)', display: 'flex', alignItems: 'center' }}>
            <ChevronLeft size={22} />
          </Link>
          <span style={{ fontSize: 17, fontWeight: 600, color: 'var(--cc-text)', flex: 1 }}>Template documenti</span>
        </div>

        <div className="px-4 py-4 space-y-3 pb-8">
          {/* Card Modello — griglia 2×2 preset */}
          <div className="cc-card-md" style={{ padding: '14px 15px' }}>
            <div className="cc-section-label mb-3">Modello</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11 }}>
              {PRESETS.map((preset) => {
                const isActive = activePresetKey === preset.key
                const locked = isFree && preset.pro
                return (
                  <div key={preset.key} style={{ textAlign: 'center', opacity: locked ? 0.55 : 1 }}>
                    <div style={{ position: 'relative', marginBottom: 7 }}>
                      <div style={{ boxShadow: isActive ? '0 0 0 2px #1a1a2e' : 'none', borderRadius: 8 }}>
                        {preset.thumb}
                      </div>
                      {locked && (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8 }}>
                          <Lock size={18} style={{ color: 'var(--cc-text-2)' }} />
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--cc-text)' }}>{preset.label}</div>
                    <div style={{ fontSize: 12, color: isActive ? '#1a1a2e' : (locked ? 'var(--cc-text-3)' : 'var(--cc-text-3)'), fontWeight: isActive ? 500 : 400 }}>
                      {isActive ? 'Attivo' : preset.pro ? 'Pro' : ''}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Card Personalizzazione */}
          <div className="cc-card-md" style={{ padding: '4px 15px' }}>
            <div className="cc-section-label" style={{ padding: '13px 0 3px' }}>Personalizzazione</div>

            {/* Colore accento */}
            <Link
              href={isPro ? templateEditHref : '/abbonamento'}
              className="flex items-center justify-between py-3 border-t border-[var(--cc-border-color)]"
            >
              <span style={{ fontSize: 14, color: 'var(--cc-text)' }}>Colore accento</span>
              {isPro ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: activeColor, boxShadow: '0 0 0 2px #fff, 0 0 0 3.5px ' + activeColor }} />
                </div>
              ) : (
                <Lock size={15} style={{ color: 'var(--cc-text-3)' }} />
              )}
            </Link>

            {/* Font */}
            <Link
              href={isPro ? templateEditHref : '/abbonamento'}
              className="flex items-center justify-between py-3 border-t border-[var(--cc-border-color)]"
            >
              <span style={{ fontSize: 14, color: isPro ? 'var(--cc-text)' : 'var(--cc-text-3)' }}>Font</span>
              {isPro ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--cc-text-2)' }}>
                  {activeFont} <ChevronRight size={15} style={{ color: 'var(--cc-text-3)' }} />
                </span>
              ) : (
                <Lock size={15} style={{ color: 'var(--cc-text-3)' }} />
              )}
            </Link>

            {/* Posizione logo */}
            <Link
              href={isPro ? templateEditHref : '/abbonamento'}
              className="flex items-center justify-between py-3 border-t border-[var(--cc-border-color)]"
            >
              <span style={{ fontSize: 14, color: isPro ? 'var(--cc-text)' : 'var(--cc-text-3)' }}>Posizione logo</span>
              {isPro ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--cc-text-2)' }}>
                  {activeLogoPos} <ChevronRight size={15} style={{ color: 'var(--cc-text-3)' }} />
                </span>
              ) : (
                <Lock size={15} style={{ color: 'var(--cc-text-3)' }} />
              )}
            </Link>

            {/* Mostra logo — toggle (funziona anche Free) */}
            <Link
              href={templateEditHref}
              className="flex items-center justify-between py-3 border-t border-[var(--cc-border-color)]"
            >
              <span style={{ fontSize: 14, color: 'var(--cc-text)' }}>Mostra logo</span>
              <div style={{ width: 42, height: 24, borderRadius: 999, background: activeLogo ? '#1a1a2e' : 'var(--cc-border-color)', position: 'relative' }}>
                <div style={{ position: 'absolute', top: 2, borderRadius: '50%', width: 20, height: 20, background: '#fff', left: activeLogo ? undefined : 2, right: activeLogo ? 2 : undefined }} />
              </div>
            </Link>

            {/* Watermark */}
            <div className="flex items-center justify-between py-3 border-t border-[var(--cc-border-color)]">
              <span style={{ fontSize: 14, color: 'var(--cc-text)' }}>Watermark Carta Canta</span>
              {isPro ? (
                <div style={{ width: 42, height: 24, borderRadius: 999, background: activeWatermark ? '#1a1a2e' : 'var(--cc-border-color)', position: 'relative' }}>
                  <div style={{ position: 'absolute', top: 2, borderRadius: '50%', width: 20, height: 20, background: '#fff', left: activeWatermark ? undefined : 2, right: activeWatermark ? 2 : undefined }} />
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span style={{ fontSize: 13, color: 'var(--cc-text-3)' }}>Sempre attivo</span>
                  <Lock size={14} style={{ color: 'var(--cc-text-3)' }} />
                </div>
              )}
            </div>

            {/* Note legali */}
            <Link
              href={isPro ? templateEditHref : '/abbonamento'}
              className="flex items-center justify-between py-3 border-t border-[var(--cc-border-color)]"
            >
              <span style={{ fontSize: 14, color: isPro ? 'var(--cc-text)' : 'var(--cc-text-3)' }}>Note legali in calce</span>
              {isPro ? (
                <ChevronRight size={15} style={{ color: 'var(--cc-text-3)' }} />
              ) : (
                <Lock size={15} style={{ color: 'var(--cc-text-3)' }} />
              )}
            </Link>
          </div>

          {/* Banner upsell Free */}
          {isFree && (
            <div style={{ background: 'var(--cc-warning-bg, #faeeda)', borderRadius: 13, padding: '13px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <Crown size={18} style={{ color: '#c9a44c', flexShrink: 0, marginTop: 1 }} />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--cc-text)', marginBottom: 8 }}>
                  Sblocca tutto con Pro
                </p>
                <Link
                  href="/abbonamento"
                  className="flex items-center justify-center gap-2 rounded-[9px] py-2.5 text-white"
                  style={{ background: '#1a1a2e', boxShadow: '0 6px 16px -6px rgba(26,26,46,.5)', fontSize: 13, fontWeight: 500 }}
                >
                  <Crown size={14} /> Passa a Pro
                </Link>
              </div>
            </div>
          )}

          {/* Azioni (Anteprima + link modifica/salva) */}
          <div style={{ display: 'flex', gap: 9 }}>
            <Link
              href={`/api/documents/template-preview?preset=${activePresetKey}`}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-[9px] py-3"
              style={{ border: '0.5px solid var(--cc-border-color)', fontSize: 14, fontWeight: 500, color: '#1a1a2e' }}
            >
              <Eye size={16} /> Anteprima
            </Link>
            <Link
              href={templateEditHref}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-[9px] py-3 text-white"
              style={{ background: '#1a1a2e', boxShadow: '0 6px 16px -6px rgba(26,26,46,.5)', fontSize: 14, fontWeight: 500 }}
            >
              Personalizza
            </Link>
          </div>
        </div>
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
