// Skeleton della directory pubblica: è la prima pagina che vede un
// potenziale cliente — mai lasciarla bianca durante il fetch.
export default function Loading() {
  return (
    <div className="max-w-2xl mx-auto" style={{ padding: '14px 15px 24px' }}>
      <div style={{ background: '#fff', borderRadius: 14, height: 118, boxShadow: '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)', marginBottom: 13 }} className="animate-pulse" />
      <div style={{ background: '#fff', borderRadius: 14, height: 280, boxShadow: '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)' }} className="animate-pulse" />
    </div>
  )
}
