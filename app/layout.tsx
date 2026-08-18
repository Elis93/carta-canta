import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { GeistMono } from "geist/font/mono";
import { Toaster } from "sonner";
import { ServiceWorkerRegister } from "@/components/shared/ServiceWorkerRegister";
import { VersionGuard } from "@/components/shared/VersionGuard";
import { UtmCapture } from "@/components/shared/UtmCapture";
import { PostHogProvider } from "@/components/shared/PostHogProvider";
import { CookieConsentBanner } from "@/components/shared/CookieConsentBanner";
import "./globals.css";

// ⚠️ FONT SENZA RETE IN BUILD (11 ago 2026): prima Inter/Geist arrivavano da
// next/font/google, che SCARICA da Google a ogni build — un timeout su quel
// download fa FALLIRE il deploy (successo l'11 ago, e riprodotto in locale).
// Ora: Inter dal file già self-hosted in public/fonts (lo stesso del PDF,
// variabile 400-800, subset latin = italiano coperto) e Geist Mono dal
// pacchetto npm `geist` (font impacchettati). Geist Sans è stato TOLTO:
// la sua variabile --font-geist-sans non era usata da nessuna parte.
const inter = localFont({
  src: "../public/fonts/inter-latin-400-800.woff2",
  variable: "--font-inter",
  weight: "400 800",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: 'Carta Canta',
    template: '%s | Carta Canta',
  },
  description: 'Preventivi professionali in pochi minuti. Senza Excel, senza carta.',
  metadataBase: new URL('https://cartacanta.app'),
  // PWA: apple-touch-icon per iOS (Safari non legge sempre il manifest per l'icona Home)
  icons: {
    apple: '/apple-touch-icon.png',
  },
  // PWA: Apple Web App (standalone su iOS/Safari)
  appleWebApp: {
    capable: true,
    title: 'Carta Canta',
    statusBarStyle: 'default',
  },
  // manifest.webmanifest è generato automaticamente da app/manifest.ts (Next.js metadata route)
  manifest: '/manifest.webmanifest',
};

// Viewport separato da metadata (Next.js 16 requirement).
// maximumScale=5 permette il pinch-to-zoom su mobile.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  // Estende il layout sotto notch/status bar → abilita env(safe-area-inset-*)
  viewportFit: 'cover',
  // PWA: theme color (barra browser/status bar su Android/iOS)
  themeColor: '#1a1a2e',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="it"
      // suppressHydrationWarning: lo script qui sotto può aggiungere la classe
      // cc-large PRIMA dell'hydration (pattern standard dei theme switcher)
      suppressHydrationWarning
      className={`${inter.variable} ${GeistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* ACCESSIBILITÀ: applica la modalità "Testo grande e leggibile"
            (classe cc-large su <html>) PRIMA del primo disegno, leggendo la
            scelta salvata sul telefono — niente lampeggio piccolo→grande.
            Si attiva/disattiva da Altro › Strumenti (mobile) o
            Impostazioni › Generale (desktop). */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(localStorage.getItem('cc_large')==='1')document.documentElement.classList.add('cc-large')}catch(e){}",
          }}
        />
        {/* PWA: cattura PRESTO l'evento beforeinstallprompt (parte prima che
            React monti) e lo conserva per il bottone "Installa l'app" in Altro.
            Senza questa cattura anticipata l'evento sfugge e il popup nativo
            non è più richiamabile a mano. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__ccInstallPrompt=e;window.dispatchEvent(new Event('cc-install-available'))});window.addEventListener('appinstalled',function(){window.__ccInstallPrompt=null});",
          }}
        />
        {/* PERF: preconnect a Supabase — le chiamate client (auth refresh,
            cestino, upload) saltano il costo di DNS+TLS al primo uso.
            React 19 solleva automaticamente i <link> nell'<head>. */}
        {process.env.NEXT_PUBLIC_SUPABASE_URL && (
          <link rel="preconnect" href={process.env.NEXT_PUBLIC_SUPABASE_URL} crossOrigin="anonymous" />
        )}
        {children}
        {/* Comportamento UNIFORME dei banner (decisione Eli 12 ago, «due famiglie
            coerenti»): tutti in fondo a destra, tutti con la ✕ per chiuderli
            (closeButton globale — così le semplici conferme «Link copiato»,
            «Salvato», «Eliminato» si comportano tutte allo stesso modo). La
            DURATA di serie è 4 secondi (regola Eli 16 lug: le conferme sono
            brevi); solo gli AVVISI che portano un'informazione da leggere —
            i 12 giorni SdI, l'acconto, l'esito SdI — passano una `duration`
            più lunga per-chiamata. Gli errori restano più a lungo allo stesso
            modo. Non aggiungere `closeButton` sulle singole chiamate: è già
            globale qui. */}
        <Toaster richColors closeButton position="bottom-right" duration={4000} />
        <ServiceWorkerRegister />
        {/* Al rientro in app confronta la build del client con quella del
            server: una PWA rimasta aperta per giorni ha JS vecchio e i tocchi
            sulle server action falliscono in silenzio. */}
        <VersionGuard current={process.env.VERCEL_GIT_COMMIT_SHA ?? 'dev'} />
        <UtmCapture />
        <PostHogProvider />
        <CookieConsentBanner />
      </body>
    </html>
  );
}
