import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Sehat",
  description: "Offline-first patient records for small clinics.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
