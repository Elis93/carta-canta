// Skeleton di caricamento condiviso (PERF, feedback Eli 5 lug):
// appare ISTANTANEAMENTE al cambio pagina mentre il server prepara i dati,
// così la navigazione non sembra "ferma". Stile coerente col design system
// (fascia bianca + card con shimmer).

function Bar({ w, h = 14, r = 7 }: { w: number | string; h?: number; r?: number }) {
  return (
    <div
      className="animate-pulse"
      style={{ width: w, height: h, borderRadius: r, background: '#ececef' }}
    />
  )
}

function CardSkeleton({ lines = 2 }: { lines?: number }) {
  return (
    <div
      style={{
        background: '#fff', borderRadius: 14, padding: '15px 15px',
        boxShadow: '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)',
        display: 'flex', flexDirection: 'column', gap: 11,
      }}
    >
      <Bar w={90} h={11} />
      {Array.from({ length: lines }).map((_, i) => (
        <Bar key={i} w={i % 2 === 0 ? '75%' : '55%'} />
      ))}
    </div>
  )
}

export function PageSkeleton({ title = true, cards = 3 }: { title?: boolean; cards?: number }) {
  return (
    <div className="max-w-4xl mx-auto">
      {title && (
        <div style={{ background: '#fff', borderBottom: '0.5px solid #eeeeee', padding: '15px 15px 13px' }}>
          <Bar w={140} h={20} r={8} />
        </div>
      )}
      <div style={{ padding: '14px 15px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {Array.from({ length: cards }).map((_, i) => (
          <CardSkeleton key={i} lines={i === 0 ? 3 : 2} />
        ))}
      </div>
    </div>
  )
}
