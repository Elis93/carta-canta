import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: 'Carta Canta',
    template: '%s | Carta Canta',
  },
  description: 'Preventivi professionali in 60 secondi. Senza Excel, senza carta.',
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster richColors position="bottom-right" />
      </body>
    </html>
  );
}
