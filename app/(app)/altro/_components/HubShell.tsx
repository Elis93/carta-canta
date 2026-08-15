import { BackButton } from '@/components/shared/BackButton'

// ── Guscio delle pagine-contenitore («Altro», Impostazioni, Account) ────────
// Testata a filo oro con la freccia Indietro + il contenuto. Stessa veste
// delle altre pagine dell'app.
//
// - `back`: dove torna la freccia Indietro (default «/altro»). Le sotto-pagine
//   di Impostazioni/Account tornano al loro hub, non ad Altro.
// - `card`: true (default) avvolge i figli in una card bianca — giusto per gli
//   ELENCHI di voci (MenuRow). false li rende direttamente — giusto per le
//   sotto-pagine con FORM, che portano già le loro card.
export function HubShell({
  title,
  children,
  back = '/altro',
  card = true,
}: {
  title: string
  children: React.ReactNode
  back?: string
  card?: boolean
}) {
  return (
    <div className="max-w-3xl mx-auto">
      <div style={{ background: '#fff', borderBottom: '2px solid #c9a44c', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 15px' }}>
        <BackButton fallback={back} />
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, fontFamily: "Georgia, 'Times New Roman', serif", color: '#1a1a2e' }}>
          {title}
        </h1>
      </div>

      <div style={{ padding: '0 15px' }}>
        {card ? (
          <div
            style={{ marginTop: 16, borderRadius: 13, background: '#fff', boxShadow: '0 1px 2px rgba(20,20,40,.05), 0 8px 24px -10px rgba(20,20,40,.15)', padding: '2px 14px' }}
          >
            {children}
          </div>
        ) : (
          <div style={{ marginTop: 16 }}>{children}</div>
        )}
        <div style={{ height: 24 }} />
      </div>
    </div>
  )
}
