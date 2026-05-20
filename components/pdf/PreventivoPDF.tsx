// ============================================================
// CARTA CANTA — PreventivoPDF
// Documento PDF generato con @react-pdf/renderer.
// 4 preset distinti: classico | bold | tecnico | elegante
// ============================================================

import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
  Font,
} from '@react-pdf/renderer'

Font.registerHyphenationCallback((word) => [word])

// ── Tipi ──────────────────────────────────────────────────────────────────

export interface PdfDocumentItem {
  sort_order: number
  description: string
  unit: string | null
  quantity: number | string
  unit_price: number | string
  discount_pct: number | string | null
  vat_rate: number | string | null
  total: number | string
}

export interface PdfData {
  doc: {
    doc_number: string | null
    title: string | null
    notes: string | null
    created_at: string | null
    expires_at: string | null
    payment_terms: string | null
    subtotal: number | string | null
    discount_pct: number | string | null
    discount_fixed: number | string | null
    tax_amount: number | string | null
    bollo_amount: number | string | null
    total: number | string | null
    vat_rate_default: number | string | null
    document_items: PdfDocumentItem[]
    status?: string | null
    doc_type?: string | null
  }
  workspace: {
    ragione_sociale: string | null
    name: string
    piva: string | null
    indirizzo: string | null
    cap: string | null
    citta: string | null
    provincia: string | null
    logo_url: string | null
    fiscal_regime: string
  }
  client: {
    name: string
    email: string | null
    phone: string | null
    piva: string | null
    indirizzo: string | null
    cap: string | null
    citta: string | null
    provincia: string | null
  } | null
  template: {
    color_primary: string | null
    show_logo: boolean | null
    show_watermark: boolean | null
    legal_notice: string | null
    preset_key?: string | null
    font_family?: string | null
  } | null
}

// ── Utility ────────────────────────────────────────────────────────────────

function n(v: number | string | null | undefined): number {
  return Number(v ?? 0) || 0
}

function fmt(v: number | string | null | undefined): string {
  return n(v).toLocaleString('it-IT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function fmtQty(v: number | string | null | undefined): string {
  return n(v).toLocaleString('it-IT', { maximumFractionDigits: 3 })
}

function curr(v: number | string | null | undefined): string {
  return `€ ${fmt(v)}`
}

function luminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) || 0
  const g = parseInt(hex.slice(3, 5), 16) || 0
  const b = parseInt(hex.slice(5, 7), 16) || 0
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

// ── Stili per preset ───────────────────────────────────────────────────────

function makeStyles(primary: string, preset: string) {
  const isBold     = preset === 'bold'
  const isTecnico  = preset === 'tecnico'
  const isElegante = preset === 'elegante'
  // isClassico = default

  const onPrimary  = luminance(primary) > 0.5 ? '#000000' : '#ffffff'

  // Font set: Elegante usa Times-Roman (serif), tutti gli altri Helvetica
  const fontBase   = isElegante ? 'Times-Roman'   : 'Helvetica'
  const fontBold   = isElegante ? 'Times-Bold'    : 'Helvetica-Bold'
  const fontItalic = isElegante ? 'Times-Italic'  : 'Helvetica-Oblique'

  return StyleSheet.create({
    page: {
      fontFamily: fontBase,
      fontSize: 9,
      color: '#111111',
      backgroundColor: '#ffffff',
      flexDirection: 'column',
    },

    // ── Header ───────────────────────────────────────────────
    header: isBold ? {
      // Bold: banda scura
      backgroundColor: primary,
      paddingVertical: 18,
      paddingHorizontal: 28,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    } : isTecnico ? {
      // Tecnico: bianco con bordo inferiore spesso
      backgroundColor: '#ffffff',
      paddingVertical: 16,
      paddingHorizontal: 28,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottomWidth: 3,
      borderBottomColor: primary,
    } : {
      // Classico / Elegante: bianco con linea sottile
      backgroundColor: '#ffffff',
      paddingVertical: 16,
      paddingHorizontal: 28,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: '#e5e5e5',
    },

    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    logo: {
      width: 38,
      height: 38,
      objectFit: 'contain',
      borderRadius: 4,
    },
    logoPlaceholder: {
      width: 38,
      height: 38,
      borderRadius: 4,
      backgroundColor: isBold ? 'rgba(255,255,255,0.2)' : `${primary}20`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    logoInitial: {
      color: isBold ? onPrimary : primary,
      fontSize: 18,
      fontFamily: fontBold,
    },
    companyName: {
      color: isBold ? onPrimary : '#111111',
      fontSize: isTecnico ? 12 : 13,
      fontFamily: fontBold,
      letterSpacing: isTecnico ? 0.8 : 0,
    },
    companyMeta: {
      color: isBold ? `${onPrimary}BF` : '#666666',
      fontSize: 8,
      opacity: isBold ? 0.75 : 1,
      marginTop: 2,
    },
    headerRight: {
      alignItems: 'flex-end',
    },
    docType: {
      color: isBold ? onPrimary : primary,
      fontSize: isElegante ? 13 : 15,
      fontFamily: fontBold,
      letterSpacing: isBold ? 1 : 0.5,
    },
    docNumber: {
      color: isBold ? `${onPrimary}CC` : '#666666',
      fontSize: isElegante ? 11 : 9,
      fontFamily: isElegante ? fontItalic : fontBase,
      marginTop: 3,
    },

    // ── Body ────────────────────────────────────────────────
    body: {
      paddingHorizontal: 28,
      paddingTop: 20,
      paddingBottom: 60,
      flex: 1,
    },

    // ── Info row ─────────────────────────────────────────────
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 18,
      gap: 20,
    },
    infoLabel: {
      fontSize: 7,
      fontFamily: fontBold,
      color: '#999999',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 4,
    },
    clientName: {
      fontSize: 11,
      fontFamily: fontBold,
      color: '#111111',
      marginBottom: 2,
    },
    clientMeta: {
      fontSize: 8,
      color: '#666666',
      marginTop: 1,
    },
    dateMeta: {
      fontSize: 9,
      fontFamily: fontBold,
      color: '#111111',
    },
    dateSecondary: {
      fontSize: 8,
      color: '#666666',
      marginTop: 2,
    },
    metaRight: {
      alignItems: 'flex-end',
    },

    // ── Titolo + note ─────────────────────────────────────────
    docTitle: {
      fontSize: 13,
      fontFamily: fontBold,
      color: '#111111',
      marginBottom: 4,
    },
    docNotes: {
      fontSize: 8,
      color: '#555555',
      lineHeight: 1.5,
      marginBottom: 14,
    },

    // ── Tabella voci ─────────────────────────────────────────
    tableHeader: isElegante ? {
      // Elegante: nessun fill, solo bordo inferiore
      flexDirection: 'row',
      paddingVertical: 5,
      paddingHorizontal: 6,
      marginBottom: 1,
      borderBottomWidth: 1,
      borderBottomColor: '#999999',
    } : isBold ? {
      // Bold: sfondo tintato leggero
      flexDirection: 'row',
      backgroundColor: `${primary}18`,
      paddingVertical: 5,
      paddingHorizontal: 6,
      marginBottom: 1,
    } : {
      // Classico / Tecnico: sfondo pieno colorato
      flexDirection: 'row',
      backgroundColor: primary,
      paddingVertical: 5,
      paddingHorizontal: 6,
      marginBottom: 1,
    },
    tableHeaderCell: {
      fontSize: 7,
      fontFamily: fontBold,
      color: isElegante ? '#888888' : (isBold ? primary : onPrimary),
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    tableRow: {
      flexDirection: 'row',
      paddingVertical: 5,
      paddingHorizontal: 6,
      borderBottomWidth: 1,
      borderBottomColor: '#f0f0f0',
    },
    tableRowAlt: {
      backgroundColor: '#fafafa',
    },
    cellDesc: { flex: 1 },
    cellUnit: { width: 28, textAlign: 'center' },
    cellQty: { width: 38, textAlign: 'right' },
    cellPrice: { width: 55, textAlign: 'right' },
    cellDisc: { width: 35, textAlign: 'right' },
    cellVat: { width: 35, textAlign: 'right' },
    cellTotal: { width: 72, textAlign: 'right' },
    cellText: {
      fontSize: 9,
      color: '#111111',
    },
    cellMuted: {
      fontSize: 9,
      color: '#666666',
    },
    cellBold: {
      fontSize: 9,
      fontFamily: fontBold,
      color: '#111111',
    },

    // ── Riepilogo fiscale ────────────────────────────────────
    summaryContainer: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginTop: 14,
    },
    summaryBox: {
      width: 200,
      borderTopWidth: 1,
      borderTopColor: '#e5e5e5',
      paddingTop: 10,
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 2,
    },
    summaryLabel: {
      fontSize: 8,
      color: '#666666',
    },
    summaryValue: {
      fontSize: 8,
      color: '#111111',
    },
    summaryTotalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      borderTopWidth: isBold ? 2 : 1,
      borderTopColor: primary,
      paddingTop: 6,
      marginTop: 4,
    },
    summaryTotalLabel: {
      fontSize: isElegante ? 11 : 12,
      fontFamily: fontBold,
      color: primary,
    },
    summaryTotalValue: {
      fontSize: isElegante ? 11 : 12,
      fontFamily: fontBold,
      color: primary,
    },
    summaryDiscount: {
      fontSize: 8,
      color: '#16a34a',
    },

    // ── Note e legale ─────────────────────────────────────────
    notesContainer: {
      marginTop: 20,
      borderTopWidth: 1,
      borderTopColor: '#e5e5e5',
      paddingTop: 10,
    },
    notesLabel: {
      fontSize: 7,
      fontFamily: fontBold,
      color: '#999999',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 4,
    },
    notesText: {
      fontSize: 8,
      color: '#555555',
      lineHeight: 1.5,
    },
    legalContainer: {
      marginTop: 16,
      borderTopWidth: 1,
      borderTopColor: '#eeeeee',
      paddingTop: 8,
    },
    legalText: {
      fontSize: 7,
      color: '#aaaaaa',
      lineHeight: 1.5,
    },

    // ── Watermark branding ────────────────────────────────────
    watermark: {
      position: 'absolute',
      top: '40%',
      left: '10%',
      right: '10%',
      transform: 'rotate(-30deg)',
      opacity: 0.04,
    },
    watermarkText: {
      fontSize: 60,
      fontFamily: fontBold,
      color: '#555555',
      textAlign: 'center',
    },

    // ── Draft watermark ───────────────────────────────────────
    draftWatermark: {
      position: 'absolute',
      top: '28%',
      left: 0,
      right: 0,
      transform: 'rotate(-30deg)',
      opacity: 0.13,
      alignItems: 'center',
    },
    draftWatermarkBig: {
      fontSize: 80,
      fontFamily: 'Helvetica-Bold',
      color: '#444444',
      textAlign: 'center',
    },
    draftWatermarkSub: {
      fontSize: 80,
      fontFamily: 'Helvetica-Bold',
      color: '#444444',
      textAlign: 'center',
      marginTop: 24,
      marginBottom: 24,
    },

    // ── Footer ───────────────────────────────────────────────
    footer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      paddingVertical: 7,
      paddingHorizontal: 28,
      backgroundColor: isBold ? `${primary}12` : '#f9f9f9',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderTopWidth: isBold ? 0 : 1,
      borderTopColor: '#eeeeee',
    },
    footerText: {
      fontSize: 7,
      color: isBold ? primary : '#aaaaaa',
      opacity: isBold ? 0.6 : 1,
    },
  })
}

// ── Componente principale ──────────────────────────────────────────────────

export function PreventivoPDF({ doc, workspace, client, template }: PdfData) {
  const primary     = template?.color_primary ?? '#1a1a2e'
  const preset      = template?.preset_key ?? 'classico'
  const showLogo    = template?.show_logo ?? true
  const showWatermark = template?.show_watermark ?? false
  const legalNotice =
    template?.legal_notice ??
    (workspace.fiscal_regime === 'forfettario'
      ? "Operazione effettuata ai sensi dell'art. 1, commi 54-89, L. 190/2014 (Regime Forfettario) – Operazione fuori campo IVA ai sensi del comma 58, lettera a), del medesimo articolo"
      : null)
  const isForfettario = workspace.fiscal_regime === 'forfettario'

  const s = makeStyles(primary, preset)
  const wsName = workspace.ragione_sociale ?? workspace.name

  const wsAddressParts = [
    workspace.indirizzo,
    workspace.cap && workspace.citta
      ? `${workspace.cap} ${workspace.citta}`
      : workspace.citta,
    workspace.provincia ? `(${workspace.provincia})` : null,
  ].filter(Boolean) as string[]

  const docDate = doc.created_at
    ? new Date(doc.created_at).toLocaleDateString('it-IT', {
        day: '2-digit', month: 'long', year: 'numeric',
      })
    : '—'
  const expiresDate = doc.expires_at
    ? new Date(doc.expires_at).toLocaleDateString('it-IT', {
        day: '2-digit', month: 'long', year: 'numeric',
      })
    : null

  const items = [...doc.document_items].sort((a, b) => a.sort_order - b.sort_order)

  const vatGroups: Record<number, number> = {}
  if (!isForfettario) {
    for (const item of items) {
      const rate = n(item.vat_rate) || n(doc.vat_rate_default) || 22
      if (rate > 0) {
        vatGroups[rate] = (vatGroups[rate] ?? 0) + n(item.total) * (rate / 100)
      }
    }
  }

  const subtotal     = n(doc.subtotal)
  const discPct      = n(doc.discount_pct)
  const discFixed    = n(doc.discount_fixed)
  const afterDiscount = subtotal * (1 - discPct / 100) - discFixed
  const discount     = subtotal - afterDiscount
  const hasDiscount  = Math.abs(discount) > 0.001
  const taxAmount    = n(doc.tax_amount)
  const bolloAmount  = n(doc.bollo_amount)
  const total        = n(doc.total)

  const logoUri = workspace.logo_url ?? null
  const initial = wsName?.[0]?.toUpperCase() ?? '?'

  const docTypeLabel = doc.doc_type === 'fattura' ? 'FATTURA' : 'PREVENTIVO'

  return (
    <Document
      title={`${docTypeLabel === 'FATTURA' ? 'Fattura' : 'Preventivo'} ${doc.doc_number ?? ''} — ${wsName}`}
      author={wsName}
      creator="Carta Canta"
    >
      <Page size="A4" style={s.page}>

        {/* ── Watermark branding (Free plan) ─────────────── */}
        {showWatermark && (
          <View style={s.watermark} fixed>
            <Text style={s.watermarkText}>Carta Canta</Text>
          </View>
        )}

        {/* ── Draft watermark ────────────────────────────── */}
        {doc.status === 'draft' && (
          <View style={s.draftWatermark} fixed>
            <Text style={s.draftWatermarkBig}>BOZZA</Text>
            <Text style={s.draftWatermarkSub}>CARTA CANTA</Text>
            <Text style={s.draftWatermarkBig}>BOZZA</Text>
          </View>
        )}

        {/* ── Header ───────────────────────────────────────── */}
        <View style={s.header} fixed>
          <View style={s.headerLeft}>
            {showLogo && (
              logoUri
                ? (
                  <View style={{ width: 38, height: 38, flexShrink: 0 }}>
                    <Image src={logoUri} style={s.logo} />
                  </View>
                )
                : (
                  <View style={s.logoPlaceholder}>
                    <Text style={s.logoInitial}>{initial}</Text>
                  </View>
                )
            )}
            <View style={{ flex: 1 }}>
              <Text style={s.companyName}>{wsName}</Text>
              {wsAddressParts.length > 0 && (
                <Text style={s.companyMeta}>{wsAddressParts.join(' ')}</Text>
              )}
              {workspace.piva && (
                <Text style={s.companyMeta}>P.IVA {workspace.piva}</Text>
              )}
            </View>
          </View>

          <View style={s.headerRight}>
            <Text style={s.docType}>{docTypeLabel}</Text>
            <Text style={s.docNumber}>
              {doc.doc_number ? `#${doc.doc_number}` : 'BOZZA'}
            </Text>
          </View>
        </View>

        {/* ── Body ─────────────────────────────────────────── */}
        <View style={s.body}>

          {/* Info row: cliente + date */}
          <View style={s.infoRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.infoLabel}>Destinatario</Text>
              {client ? (
                <>
                  <Text style={s.clientName}>{client.name}</Text>
                  {client.piva && (
                    <Text style={s.clientMeta}>P.IVA: {client.piva}</Text>
                  )}
                  {client.indirizzo && (
                    <Text style={s.clientMeta}>{client.indirizzo}</Text>
                  )}
                  {(client.cap || client.citta) && (
                    <Text style={s.clientMeta}>
                      {[client.cap, client.citta, client.provincia ? `(${client.provincia})` : null]
                        .filter(Boolean).join(' ')}
                    </Text>
                  )}
                  {client.email && (
                    <Text style={s.clientMeta}>{client.email}</Text>
                  )}
                  {client.phone && (
                    <Text style={s.clientMeta}>{client.phone}</Text>
                  )}
                </>
              ) : (
                <Text style={s.clientMeta}>
                  Nessun cliente specificato
                </Text>
              )}
            </View>

            <View style={s.metaRight}>
              <Text style={s.infoLabel}>Data emissione</Text>
              <Text style={s.dateMeta}>{docDate}</Text>
              {expiresDate && (
                <Text style={s.dateSecondary}>Valido fino al {expiresDate}</Text>
              )}
              {doc.payment_terms && (
                <Text style={{ ...s.dateSecondary, marginTop: 6 }}>
                  Pagamento: {doc.payment_terms}
                </Text>
              )}
            </View>
          </View>

          {/* Titolo + note */}
          {(doc.title || doc.notes) && (
            <View style={{ marginBottom: 14 }}>
              {doc.title && (
                <Text style={s.docTitle}>{doc.title}</Text>
              )}
              {doc.notes && (
                <Text style={s.docNotes}>{doc.notes}</Text>
              )}
            </View>
          )}

          {/* ── Tabella voci ──────────────────────────────── */}
          <View style={s.tableHeader}>
            <Text style={{ ...s.tableHeaderCell, ...s.cellDesc }}>Descrizione</Text>
            <Text style={{ ...s.tableHeaderCell, ...s.cellUnit }}>UM</Text>
            <Text style={{ ...s.tableHeaderCell, ...s.cellQty }}>Qtà</Text>
            <Text style={{ ...s.tableHeaderCell, ...s.cellPrice }}>Prezzo</Text>
            <Text style={{ ...s.tableHeaderCell, ...s.cellDisc }}>Sc.%</Text>
            {!isForfettario && (
              <Text style={{ ...s.tableHeaderCell, ...s.cellVat }}>IVA</Text>
            )}
            <Text style={{ ...s.tableHeaderCell, ...s.cellTotal }}>Totale</Text>
          </View>

          {items.map((item, i) => {
            const vatRate = n(item.vat_rate) || n(doc.vat_rate_default) || 22
            return (
              <View
                key={i}
                style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]}
                wrap={false}
              >
                <Text style={{ ...s.cellText, ...s.cellDesc }}>{item.description}</Text>
                <Text style={{ ...s.cellMuted, ...s.cellUnit }}>{item.unit ?? 'pz'}</Text>
                <Text style={{ ...s.cellMuted, ...s.cellQty }}>{fmtQty(item.quantity)}</Text>
                <Text style={{ ...s.cellMuted, ...s.cellPrice }}>{curr(item.unit_price)}</Text>
                <Text style={{ ...s.cellMuted, ...s.cellDisc }}>
                  {n(item.discount_pct) > 0 ? `${n(item.discount_pct)}%` : '—'}
                </Text>
                {!isForfettario && (
                  <Text style={{ ...s.cellMuted, ...s.cellVat }}>{vatRate}%</Text>
                )}
                <Text style={{ ...s.cellBold, ...s.cellTotal }}>{curr(item.total)}</Text>
              </View>
            )
          })}

          {/* ── Riepilogo fiscale ────────────────────────── */}
          <View style={s.summaryContainer}>
            <View style={s.summaryBox}>
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>Subtotale</Text>
                <Text style={s.summaryValue}>{curr(subtotal)}</Text>
              </View>

              {hasDiscount && (
                <>
                  <View style={s.summaryRow}>
                    <Text style={s.summaryLabel}>Sconto</Text>
                    <Text style={s.summaryDiscount}>−{curr(Math.abs(discount))}</Text>
                  </View>
                  <View style={s.summaryRow}>
                    <Text style={s.summaryLabel}>Imponibile</Text>
                    <Text style={s.summaryValue}>{curr(afterDiscount)}</Text>
                  </View>
                </>
              )}

              {Object.entries(vatGroups).map(([rate, amount]) => (
                <View key={rate} style={s.summaryRow}>
                  <Text style={s.summaryLabel}>IVA {rate}%</Text>
                  <Text style={s.summaryValue}>{curr(amount)}</Text>
                </View>
              ))}

              {taxAmount > 0 && Object.keys(vatGroups).length === 0 && (
                <View style={s.summaryRow}>
                  <Text style={s.summaryLabel}>IVA</Text>
                  <Text style={s.summaryValue}>{curr(taxAmount)}</Text>
                </View>
              )}

              {bolloAmount > 0 && (
                <View style={s.summaryRow}>
                  <Text style={s.summaryLabel}>Marca da bollo</Text>
                  <Text style={s.summaryValue}>{curr(bolloAmount)}</Text>
                </View>
              )}

              <View style={s.summaryTotalRow}>
                <Text style={s.summaryTotalLabel}>TOTALE</Text>
                <Text style={s.summaryTotalValue}>{curr(total)}</Text>
              </View>
            </View>
          </View>

          {/* ── Note ─────────────────────────────────────── */}
          {doc.notes && !doc.title && (
            <View style={s.notesContainer}>
              <Text style={s.notesLabel}>Note</Text>
              <Text style={s.notesText}>{doc.notes}</Text>
            </View>
          )}

          {/* ── Avviso legale ─────────────────────────────── */}
          {legalNotice && (
            <View style={s.legalContainer}>
              <Text style={s.legalText}>{legalNotice}</Text>
            </View>
          )}
        </View>

        {/* ── Footer ───────────────────────────────────────── */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>Generato con Carta Canta · cartacanta.app</Text>
          <Text style={s.footerText}>{wsName}</Text>
        </View>

      </Page>
    </Document>
  )
}
