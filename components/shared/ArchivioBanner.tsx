'use client'

// ============================================================
// Riga «Archiviato» sulla pagina del documento (075).
//
// PERCHÉ: si archivia dalla lista, ma poi ci si finisce dentro aprendo il
// documento — e da lì bisogna poterlo tirare fuori, altrimenti l'unica via è
// tornare indietro e cercare la pillola giusta.
//
// ⚠️ Il testo dice cosa NON succede, perché è la domanda vera di chi archivia
// una fattura: non è stata cancellata, resta nel Bilancio e nei conti.
// ============================================================

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Archive, Loader2, ArchiveRestore } from 'lucide-react'
import { runAction } from '@/lib/run-action'
import { disarchiviaDocumentoAction } from '@/lib/actions/documents'
import { docTypeLabel } from '@/lib/utils'

export function ArchivioBanner({ documentId, docType }: {
  documentId: string
  /** 'preventivo' | 'fattura' | 'nota_credito' */
  docType: string
}) {
  const router = useRouter()
  const [inCorso, setInCorso] = useState(false)

  async function ripristina() {
    if (inCorso) return
    setInCorso(true)
    const res = await runAction(() => disarchiviaDocumentoAction(documentId), 'togliere il documento dall’archivio')
    if (res.error) toast.error(res.error)
    else {
      toast.success(docType === 'preventivo' ? 'Preventivo tolto dall’archivio' : `${docTypeLabel(docType)} tolta dall’archivio`)
      router.refresh()
    }
    setInCorso(false)
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      background: '#f7f7f8', border: '1px solid #e6e6e6', borderRadius: 12,
      padding: '11px 13px', marginBottom: 12,
    }}>
      <Archive size={16} style={{ color: '#55534b', flexShrink: 0, marginTop: 2 }} aria-hidden />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: '#161616' }}>
          {docType === 'preventivo' ? 'Preventivo archiviato' : `${docTypeLabel(docType)} archiviata`}
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--cc-muted)', margin: '3px 0 0', lineHeight: 1.45 }}>
          Non compare nelle liste attive né fra i promemoria. Non è stato cancellato:
          resta nel Bilancio, negli export e nei conti.
        </p>
        <button
          type="button"
          onClick={ripristina}
          disabled={inCorso}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 9,
            border: '1px solid #e3e3e6', borderRadius: 10, background: '#fff',
            color: '#55534b', fontSize: 12.5, fontWeight: 600,
            padding: '7px 11px', cursor: inCorso ? 'default' : 'pointer', fontFamily: 'inherit',
          }}
        >
          {inCorso ? <Loader2 size={13} className="animate-spin" /> : <ArchiveRestore size={13} />}
          Togli dall&rsquo;archivio
        </button>
      </div>
    </div>
  )
}
