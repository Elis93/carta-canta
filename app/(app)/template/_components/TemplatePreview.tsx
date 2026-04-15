'use client'

import Image from 'next/image'

interface TemplatePreviewProps {
  color: string
  font: string
  showLogo: boolean
  showWatermark: boolean
  legalNotice: string
  workspaceName: string
  logoUrl?: string | null
  templateName?: string
}

// Preventivo di esempio per la preview
const SAMPLE_ITEMS = [
  { description: 'Installazione impianto elettrico', qty: 1, price: 850.0 },
  { description: 'Materiale e cavi', qty: 1, price: 320.0 },
  { description: 'Collaudo e certificazione', qty: 1, price: 80.0 },
]

export function TemplatePreview({
  color,
  font,
  showLogo,
  showWatermark,
  legalNotice,
  workspaceName,
  logoUrl,
}: TemplatePreviewProps) {
  const subtotal = SAMPLE_ITEMS.reduce((s, i) => s + i.qty * i.price, 0)

  // Calcola colore testo (chiaro su scuro)
  const r = parseInt(color.slice(1, 3), 16) || 0
  const g = parseInt(color.slice(3, 5), 16) || 0
  const b = parseInt(color.slice(5, 7), 16) || 0
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  const headerTextColor = luminance > 0.5 ? '#000000' : '#ffffff'

  return (
    <div
      className="border rounded-xl overflow-hidden shadow-sm text-xs bg-white relative"
      style={{ fontFamily: font }}
    >
      {/* Watermark */}
      {showWatermark && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 opacity-[0.06] rotate-[-30deg]">
          <span className="text-5xl font-black text-gray-800 whitespace-nowrap select-none">
            Carta Canta
          </span>
        </div>
      )}

      {/* Header */}
      <div
        className="px-5 py-4 flex items-center justify-between"
        style={{ backgroundColor: color, color: headerTextColor }}
      >
        <div className="flex items-center gap-3">
          {showLogo && logoUrl ? (
            <Image
              src={logoUrl}
              alt={workspaceName}
              width={36}
              height={36}
              className="rounded object-contain bg-white/10"
              unoptimized
            />
          ) : showLogo ? (
            <div className="size-9 rounded bg-white/20 flex items-center justify-center">
              <span className="font-bold text-sm" style={{ color: headerTextColor }}>
                {workspaceName[0]?.toUpperCase()}
              </span>
            </div>
          ) : null}
          <div>
            <p className="font-semibold text-sm">{workspaceName}</p>
            <p className="opacity-75 text-xs">Via Roma 1 — Milano (MI)</p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-bold text-sm">PREVENTIVO</p>
          <p className="opacity-75 text-xs">#2026/001</p>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-4 space-y-3">
        {/* Info cliente */}
        <div className="flex justify-between gap-4">
          <div>
            <p className="font-semibold text-[11px] text-gray-500 uppercase tracking-wide mb-1">
              Destinatario
            </p>
            <p className="font-medium">Mario Rossi Costruzioni</p>
            <p className="text-gray-500">via Garibaldi 42, Roma</p>
          </div>
          <div className="text-right">
            <p className="font-semibold text-[11px] text-gray-500 uppercase tracking-wide mb-1">
              Data
            </p>
            <p>15/04/2026</p>
            <p className="text-gray-500">Valido 30 giorni</p>
          </div>
        </div>

        {/* Tabella voci */}
        <table className="w-full border-collapse mt-2">
          <thead>
            <tr style={{ backgroundColor: color + '18' }}>
              <th className="text-left py-1.5 px-2 font-semibold" style={{ color }}>
                Descrizione
              </th>
              <th className="text-right py-1.5 px-2 font-semibold w-8" style={{ color }}>
                Qtà
              </th>
              <th className="text-right py-1.5 px-2 font-semibold w-16" style={{ color }}>
                Prezzo
              </th>
              <th className="text-right py-1.5 px-2 font-semibold w-16" style={{ color }}>
                Totale
              </th>
            </tr>
          </thead>
          <tbody>
            {SAMPLE_ITEMS.map((item, i) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="py-1.5 px-2">{item.description}</td>
                <td className="py-1.5 px-2 text-right text-gray-500">{item.qty}</td>
                <td className="py-1.5 px-2 text-right text-gray-500">
                  €{item.price.toFixed(2)}
                </td>
                <td className="py-1.5 px-2 text-right font-medium">
                  €{(item.qty * item.price).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totale */}
        <div className="flex justify-end">
          <div className="text-right space-y-0.5">
            <div className="flex justify-between gap-8 text-gray-500">
              <span>Subtotale</span>
              <span>€{subtotal.toFixed(2)}</span>
            </div>
            <div
              className="flex justify-between gap-8 font-bold text-sm pt-1 border-t"
              style={{ color }}
            >
              <span>TOTALE</span>
              <span>€{subtotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Nota legale */}
        {legalNotice && (
          <p className="text-[10px] text-gray-400 border-t pt-2 leading-relaxed">
            {legalNotice}
          </p>
        )}
      </div>

      {/* Footer */}
      <div
        className="px-5 py-2 text-center opacity-60"
        style={{ backgroundColor: color + '12', color }}
      >
        <p className="text-[10px]">
          Generato con Carta Canta · cartacanta.it
        </p>
      </div>
    </div>
  )
}
