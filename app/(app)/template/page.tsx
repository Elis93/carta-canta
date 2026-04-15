import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SetDefaultButton } from './_components/SetDefaultButton'
import { LayoutTemplate, Plus, Star, Lock } from 'lucide-react'

export default async function TemplatePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, plan')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!workspace) redirect('/login')

  const { data: templates } = await supabase
    .from('templates')
    .select('*')
    .eq('workspace_id', workspace.id)
    .order('created_at', { ascending: true })

  const isFree = workspace.plan === 'free'
  const atLimit = isFree && (templates?.length ?? 0) >= 1

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Template</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Personalizza l&apos;aspetto dei tuoi preventivi.
          </p>
        </div>
        {atLimit ? (
          <Button asChild variant="outline">
            <Link href="/abbonamento">
              <Lock className="size-4" /> Upgrade per più template
            </Link>
          </Button>
        ) : (
          <Button asChild>
            <Link href="/template/nuovo">
              <Plus className="size-4" /> Nuovo template
            </Link>
          </Button>
        )}
      </div>

      {/* Paywall banner Free */}
      {isFree && (
        <div className="rounded-xl border bg-muted/30 px-4 py-3 flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Piano Free: <strong>1 template</strong>.
            Passa a Pro per template illimitati con colori, font e header personalizzati.
          </p>
          <Button asChild size="sm" variant="outline">
            <Link href="/abbonamento">Upgrade</Link>
          </Button>
        </div>
      )}

      {templates && templates.length > 0 ? (
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

              {/* Mini-preview stile font */}
              <CardContent className="pb-2">
                <div
                  className="rounded-lg bg-muted/40 px-3 py-2 text-xs"
                  style={{ fontFamily: tmpl.font_family ?? 'Inter' }}
                >
                  <p className="font-semibold truncate">Preventivo #2026/001</p>
                  <p className="text-muted-foreground">
                    Font: {tmpl.font_family ?? 'Inter'} ·
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
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <div className="size-12 rounded-full bg-muted flex items-center justify-center">
            <LayoutTemplate className="size-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">Nessun template ancora.</p>
          <p className="text-xs text-muted-foreground">
            Crea il tuo primo template per personalizzare i preventivi.
          </p>
          <Button asChild size="sm">
            <Link href="/template/nuovo">
              <Plus className="size-4" /> Crea template
            </Link>
          </Button>
        </div>
      )}
    </div>
  )
}
