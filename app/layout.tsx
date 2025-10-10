import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import "./globals.css"

export const metadata: Metadata = {
  title: "API IA",
  description: "Segmentation leads with AI",
  generator: "LogsFlow v1.0",
  applicationName: "LogsFlow Dashboard",
  referrer: "origin-when-cross-origin",
  keywords: [
    "monitoreo de logs",
    "análisis de logs",
    "dashboard de logs",
    "sistema de monitoreo",
    "logs en tiempo real",
    "business intelligence",
    "análisis de datos",
    "alertas automáticas",
    "observabilidad",
    "DevOps",
    "infraestructura",
    "rendimiento de sistemas",
    "troubleshooting",
    "logs empresariales",
    "métricas de sistema",
  ],
  authors: [{ name: "LogsFlow Team" }],
  creator: "LogsFlow",
  publisher: "LogsFlow Solutions",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL("https://logsflow.com"),
  alternates: {
    canonical: "/",
    languages: {
      "es-ES": "/es",
      "en-US": "/en",
    },
  },
  openGraph: {
    type: "website",
    locale: "es_ES",
    url: "https://logsflow.com",
    title: "LogsFlow - Monitoreo Inteligente de Logs Empresariales",
    description:
      "Transforma tus logs en insights accionables con nuestra plataforma de monitoreo avanzada. Análisis en tiempo real, alertas inteligentes y dashboards personalizables para optimizar el rendimiento de tus sistemas.",
    siteName: "LogsFlow",
    images: [
      {
        url: "https://pcfcdn.kommo.com/favicon.ico",
        width: 1200,
        height: 630,
        alt: "LogsFlow - Dashboard de Monitoreo de Logs",
      },
      {
        url: "/og-image-square.png",
        width: 1200,
        height: 1200,
        alt: "LogsFlow - Sistema de Análisis de Logs",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "LogsFlow - Monitoreo Inteligente de Logs",
    description:
      "Plataforma avanzada para análisis de logs en tiempo real con dashboards inteligentes y alertas automáticas.",
    site: "@LogsFlow",
    creator: "@LogsFlow",
    images: ["/twitter-image.png"],
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
  },
  robots: {
    index: true,
    follow: true,
    nocache: true,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "https://pcfcdn.kommo.com/favicon.ico" },
      { url: "https://pcfcdn.kommo.com/favicon.ico", sizes: "16x16", type: "image/png" },
      { url: "https://pcfcdn.kommo.com/favicon.ico", sizes: "32x32", type: "image/png" },
      { url: "https://pcfcdn.kommo.com/favicon.ico", sizes: "96x96", type: "image/png" },
    ],
    shortcut: "https://pcfcdn.kommo.com/favicon.ico",
    apple: [
      { url: "https://pcfcdn.kommo.com/favicon.ico" },
      { url: "/apple-touch-icon-57x57.png", sizes: "57x57", type: "image/png" },
      { url: "/apple-touch-icon-60x60.png", sizes: "60x60", type: "image/png" },
      { url: "/apple-touch-icon-72x72.png", sizes: "72x72", type: "image/png" },
      { url: "/apple-touch-icon-76x76.png", sizes: "76x76", type: "image/png" },
      { url: "/apple-touch-icon-114x114.png", sizes: "114x114", type: "image/png" },
      { url: "/apple-touch-icon-120x120.png", sizes: "120x120", type: "image/png" },
      { url: "/apple-touch-icon-144x144.png", sizes: "144x144", type: "image/png" },
      { url: "/apple-touch-icon-152x152.png", sizes: "152x152", type: "image/png" },
      { url: "/apple-touch-icon-180x180.png", sizes: "180x180", type: "image/png" },
    ],
    other: [
      {
        rel: "apple-touch-icon-precomposed",
        url: "https://pcfcdn.kommo.com/favicon.ico",
      },
      {
        rel: "mask-icon",
        url: "/safari-pinned-tab.svg",
        color: "#000000",
      },
    ],
  },
  manifest: "/site.webmanifest",
  other: {
    "apple-mobile-web-app-title": "LogsFlow",
    "application-name": "LogsFlow",
    "msapplication-TileColor": "#000000",
    "msapplication-TileImage": "/mstile-144x144.png",
    "msapplication-config": "/browserconfig.xml",
    "theme-color": "#000000",
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
    "format-detection": "telephone=no",
    HandheldFriendly: "True",
    MobileOptimized: "320",
    "target-densitydpi": "device-dpi",
    "full-screen": "yes",
    browsermode: "application",
    nightmode: "enable/disable",
    layoutmode: "fitscreen/standard",
    imagemode: "force",
    "screen-orientation": "portrait",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`}>
            {children}
      </body>
    </html>
  )
}
