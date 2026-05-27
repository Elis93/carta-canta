import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Settings, Receipt, Bell, Users, CreditCard } from 'lucide-react'
import { ImpostazioniGenerali } from './tabs/generali'
import { ImpostazioniFiscali } from './tabs/fiscali'
import { ImpostazioniNotifiche } from './tabs/notifiche'
import { ImpostazioniPiano } from './tabs/piano'
import { ImpostazioniTeam } from './tabs/team'
import { getWorkspaceMembers } from '@/lib/actions/team'
import { PLAN_FEATURES } from '@/lib/stripe/plans'
import type { NotificationPrefs } from '@/lib/actions/workspace'

const NAV_ITEMS = [
  { value: 'generale',   label: 'Generale',   Icon: Settings    },
  { value: 'fiscale',    label: 'Fiscale',     Icon: Receipt     },
  { value: 'notifiche',  label: 'Notifiche',   Icon: Bell        },
  { value: 'team',       label: 'Team',        Icon: Users       },
  { value: 'piano',      label: 'Piano',       Icon: CreditCard  },
] as const

export default async function ImpostazioniPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let { data: workspace } = await supabase
    .from('workspaces')
    .select('*')
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
        .from('workspaces').select('*')
        .eq('id', membership.workspace_id)
        .maybeSingle()
      workspace = mw
    }
  }

  if (!workspace) redirect('/login')

  // Carica membri del team
  const members = await getWorkspaceMembers(workspace.id)
  const planFeatures = PLAN_FEATURES[workspace.plan]
  const canInvite = planFeatures.teamMembers > 0

  // Nome owner per la lista team
  const ownerName: string =
    user.user_metadata?.full_name ||
    `${user.user_metadata?.nome ?? ''} ${user.user_metadata?.cognome ?? ''}`.trim() ||
    user.email?.split('@')[0] ||
    'Proprietario'

  // Estrai e valida le preferenze notifiche dal workspace
  const rawPrefs = workspace.notification_prefs as Record<string, unknown> | null
  const notifPrefs: NotificationPrefs | null = rawPrefs
    ? {
        preventivo_accettato: rawPrefs.preventivo_accettato !== false,
        preventivo_rifiutato: rawPrefs.preventivo_rifiutato !== false,
        preventivo_scaduto:   rawPrefs.preventivo_scaduto   !== false,
        reminder_cliente:     rawPrefs.reminder_cliente     !== false,
      }
    : null

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      {/* Intestazione */}
      <div>
        <h1 className="text-2xl font-semibold">Impostazioni</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Gestisci il tuo profilo, le impostazioni fiscali e il piano.
        </p>
      </div>

      {/*
        Layout due colonne su desktop:
        - Sinistra: sidebar nav verticale fissa (md:w-44)
        - Destra:   contenuto a larghezza piena (flex-1)
        Su mobile: tab-bar orizzontale con wrap sopra al contenuto.
      */}
      <Tabs defaultValue="generale" className="flex flex-col md:flex-row gap-4 md:gap-8 items-start">

        {/* ── Sidebar nav ─────────────────────────────────── */}
        <div className="w-full md:w-44 shrink-0 md:sticky md:top-6">
          <TabsList
            className={[
              // Layout
              'flex flex-row flex-wrap md:flex-col',
              'w-full h-auto',
              // Sfondo trasparente — le singole voci gestiscono lo stato attivo
              'bg-transparent p-0',
              'gap-1',
              'items-start justify-start',
            ].join(' ')}
          >
            {NAV_ITEMS.map(({ value, label, Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                title={label}
                className={[
                  // Layout interno
                  'justify-start gap-2 px-3 py-2 text-sm font-medium rounded-md',
                  // Dimensioni
                  'w-auto md:w-full',
                  // Colori default
                  'text-muted-foreground',
                  'hover:text-foreground hover:bg-muted/60',
                  // Stato attivo
                  'data-[state=active]:bg-muted',
                  'data-[state=active]:text-foreground',
                  // Rimuove l'ombra del trigger shadcn default
                  'shadow-none data-[state=active]:shadow-none',
                ].join(' ')}
              >
                <Icon className="size-4 shrink-0" />
                <span className="hidden sm:inline">{label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* ── Contenuto ────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          <TabsContent value="generale" className="mt-0 focus-visible:ring-0 focus-visible:ring-offset-0">
            <ImpostazioniGenerali workspace={workspace} userEmail={user.email ?? ''} />
          </TabsContent>

          <TabsContent value="fiscale" className="mt-0 focus-visible:ring-0 focus-visible:ring-offset-0">
            <ImpostazioniFiscali workspace={workspace} />
          </TabsContent>

          <TabsContent value="notifiche" className="mt-0 focus-visible:ring-0 focus-visible:ring-offset-0">
            <ImpostazioniNotifiche initialPrefs={notifPrefs} />
          </TabsContent>

          <TabsContent value="team" className="mt-0 focus-visible:ring-0 focus-visible:ring-offset-0">
            <ImpostazioniTeam
              ownerEmail={user.email ?? ''}
              ownerName={ownerName}
              members={members}
              canInvite={canInvite}
              maxMembers={planFeatures.teamMembers}
            />
          </TabsContent>

          <TabsContent value="piano" className="mt-0 focus-visible:ring-0 focus-visible:ring-offset-0">
            <ImpostazioniPiano workspace={workspace} />
          </TabsContent>
        </div>

      </Tabs>
    </div>
  )
}
