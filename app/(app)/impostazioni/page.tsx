import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSessionWorkspace } from '@/lib/workspace-context'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Settings, Receipt, Bell, CreditCard, Banknote, ChevronLeft } from 'lucide-react'
import { ImpostazioniGenerali } from './tabs/generali'
import { ImpostazioniFiscali } from './tabs/fiscali'
import { ImpostazioniPagamenti } from './tabs/pagamenti'
import { ImpostazioniNotifiche } from './tabs/notifiche'
import { ImpostazioniPiano } from './tabs/piano'
import type { NotificationPrefs } from '@/lib/actions/workspace'
import { BackButton } from '@/components/shared/BackButton'

// NB: tab "Team" temporaneamente nascosto (piano Team non disponibile).
// Il componente ImpostazioniTeam e getWorkspaceMembers restano nel codice per
// quando il piano Team verrà riattivato.
const NAV_ITEMS = [
  { value: 'generale',   label: 'Generale',   Icon: Settings    },
  { value: 'fiscale',    label: 'Fiscale',     Icon: Receipt     },
  { value: 'pagamenti',  label: 'Pagamenti',   Icon: Banknote    },
  { value: 'notifiche',  label: 'Notifiche',   Icon: Bell        },
  { value: 'piano',      label: 'Piano',       Icon: CreditCard  },
] as const

export default async function ImpostazioniPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
  const initialTab = ['generale', 'fiscale', 'pagamenti', 'notifiche', 'piano'].includes(tab ?? '') ? tab! : 'generale'
  const { user, workspace } = await getSessionWorkspace()
  if (!user) redirect('/login')
  if (!workspace) redirect('/login')

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
    <div className="max-w-4xl mx-auto">

      {/* ── Header mobile ── */}
      <div
        className="lg:hidden flex items-center"
        style={{ background: '#fff', borderBottom: '0.5px solid #eeeeee', gap: 10, padding: '12px 15px' }}
      >
        <BackButton fallback="/altro" />
        <span style={{ flex: 1, fontSize: 17, fontWeight: 600, color: '#161616' }}>Impostazioni</span>
        <span style={{ width: 24 }} />
      </div>

      {/* Intestazione desktop */}
      <div className="hidden lg:flex items-center gap-3 min-w-0 p-4 md:p-8 pb-0 md:pb-0">
        <Settings className="size-6 text-primary shrink-0" />
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">Impostazioni</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Gestisci il tuo profilo, le impostazioni fiscali e il piano.
          </p>
        </div>
      </div>

      {/*
        Tabs con doppio stile responsivo:
        - Mobile: barra orizzontale con sottolineatura (underline sui tab attivi)
        - Desktop: sidebar verticale con bg-muted sull'attivo
        Usa un'unica istanza Tabs per sincronizzare lo stato.
      */}
      <Tabs defaultValue={initialTab} className="flex flex-col mt-0 lg:mt-6 lg:flex-row lg:gap-8 lg:items-start lg:p-8 lg:pt-0">

        {/* ── Tab bar ── */}
        <div className="lg:w-44 lg:shrink-0 lg:sticky lg:top-6">
          <TabsList className="
            flex flex-row w-full h-auto p-0 gap-0 rounded-none
            bg-white lg:bg-transparent
            border-b border-[#eeeeee] lg:border-b-0
            px-2 lg:px-0
            lg:flex-col lg:gap-1
          ">
            {NAV_ITEMS.map(({ value, label, Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                title={label}
                className="
                  group flex-1 lg:flex-none
                  flex items-center justify-center lg:justify-start gap-2
                  px-1 py-3 lg:px-3 lg:py-2 text-[14px] font-medium
                  rounded-none lg:rounded-md
                  text-[#8a887f] lg:text-muted-foreground
                  hover:text-[var(--cc-text)] lg:hover:text-foreground lg:hover:bg-muted/60
                  border-0 border-b-2 border-solid border-transparent bg-transparent rounded-none
                  data-[state=active]:bg-transparent data-[state=active]:border-[#1a1a2e] data-[state=active]:text-[#1a1a2e] data-[state=active]:font-semibold
                  lg:data-[state=active]:border-0 lg:data-[state=active]:bg-muted lg:data-[state=active]:text-foreground lg:data-[state=active]:font-medium
                  shadow-none data-[state=active]:shadow-none
                  -mb-px lg:mb-0
                "
              >
                <Icon className="size-4 shrink-0 hidden lg:block" />
                <span>{label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        {/* Spacer top del contenuto mobile allineato al mockup */}

        {/* ── Contenuto ── */}
        <div className="flex-1 min-w-0 px-[15px] pt-[14px] lg:px-0 lg:pt-0">
          <TabsContent value="generale" className="mt-0 focus-visible:ring-0 focus-visible:ring-offset-0">
            <ImpostazioniGenerali workspace={workspace} userEmail={user.email ?? ''} />
          </TabsContent>

          <TabsContent value="fiscale" className="mt-0 focus-visible:ring-0 focus-visible:ring-offset-0">
            <ImpostazioniFiscali workspace={workspace} />
          </TabsContent>

          <TabsContent value="pagamenti" className="mt-0 focus-visible:ring-0 focus-visible:ring-offset-0">
            <ImpostazioniPagamenti workspace={workspace} />
          </TabsContent>

          <TabsContent value="notifiche" className="mt-0 focus-visible:ring-0 focus-visible:ring-offset-0">
            <ImpostazioniNotifiche initialPrefs={notifPrefs} />
          </TabsContent>

          <TabsContent value="piano" className="mt-0 focus-visible:ring-0 focus-visible:ring-offset-0">
            <ImpostazioniPiano workspace={workspace} />
          </TabsContent>
        </div>

      </Tabs>
    </div>
  )
}
