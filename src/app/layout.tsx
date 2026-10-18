import type { Metadata, Viewport } from "next"
import { Inter, Vazirmatn } from "next/font/google"
import { ServiceWorker } from "@/components/service-worker"
import { I18nProvider } from "@/lib/i18n"
import "./globals.css"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })
// Covers the Perso-Arabic script used by Dari and Pashto.
const vazirmatn = Vazirmatn({ subsets: ["arabic"], variable: "--font-vazirmatn" })

export const metadata: Metadata = {
  title: { default: "Sehat", template: "%s · Sehat" },
  description: "Offline-first patient records for small clinics.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
}

export const viewport: Viewport = { themeColor: "#0f766e" }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning className={`${inter.variable} ${vazirmatn.variable}`}>
      <body className="min-h-dvh font-sans">
        <I18nProvider>{children}</I18nProvider>
        <ServiceWorker />
      </body>
    </html>
  )
}
