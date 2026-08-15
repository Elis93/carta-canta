import { BackButton } from '@/components/shared/BackButton'

// ── Guscio delle pagine-contenitore di «Altro» ─────────────────────────────
// Testata a filo oro con la freccia Indietro (torna ad Altro) + una card con
// le 2-3 destinazioni. Stessa veste delle altre pagine dell'app.
export function HubShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ background: '#fff', borderBottom: '2px solid #c9a44c', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 15px' }}>
        <BackButton fallback="/altro" />
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, fontFamily: "Georgia, 'Times New Roman', serif", color: '#1a1a2e' }}>
          {title}
        </h1>
      </div>

      <div style={{ padding: '0 15px' }}>
        <div
          style={{ marginTop: 16, borderRadius: 13, background: '#fff', boxShadow: '0 1px 2px rgba(20,20,40,.05), 0 8px 24px -10px rgba(20,20,40,.15)', padding: '2px 14px' }}
        >
          {children}
        </div>
        <div style={{ height: 16 }} />
      </div>
    </div>
  )
}
