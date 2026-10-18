import type { Metadata, Viewport } from "next"
import { ServiceWorker } from "@/components/service-worker"
import { I18nProvider } from "@/lib/i18n"
import "./globals.css"

export const metadata: Metadata = {
  title: { default: "Sehat", template: "%s · Sehat" },
  description: "Offline-first patient records for small clinics.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
}

export const viewport: Viewport = { themeColor: "#0f766e" }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <body className="min-h-dvh font-sans">
        <I18nProvider>{children}</I18nProvider>
        <ServiceWorker />
      </body>
    </html>
  )
}
