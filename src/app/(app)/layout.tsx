"use client"

import { Suspense } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { AppProvider, useApp } from "@/client/app-context"
import { LanguageSelect } from "@/components/language-select"
import { SyncIndicator } from "@/components/sync-indicator"
import { Button, cx } from "@/components/ui"
import { useI18n } from "@/lib/i18n"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider fallback={<Loading />}>
      <Shell>{children}</Shell>
    </AppProvider>
  )
}

function Loading() {
  const { t } = useI18n()
  return <p className="p-8 text-sm text-muted">{t("loading")}</p>
}

function Shell({ children }: { children: React.ReactNode }) {
  const { session, logout } = useApp()
  const { t } = useI18n()
  const pathname = usePathname()

  const links = [
    { href: "/queue", label: t("queue"), section: ["/queue"] },
    { href: "/patients", label: t("patients"), section: ["/patient", "/visit"] },
    ...(session.role === "admin" ? [{ href: "/staff", label: t("staff"), section: ["/staff"] }] : []),
  ]

  return (
    <div className="min-h-dvh">
      <header className="no-print sticky top-0 z-10 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-6 px-4">
          <Link href="/queue" className="font-semibold text-brand">
            {t("appName")}
          </Link>
          <nav className="flex gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cx(
                  "rounded-md px-3 py-1.5 text-sm",
                  link.section.some((prefix) => pathname.startsWith(prefix)) ? "bg-bg font-medium text-fg" : "text-muted hover:text-fg",
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="ms-auto flex items-center gap-2">
            <SyncIndicator />
            <LanguageSelect className="hidden sm:block" />
            <span className="hidden text-sm text-muted md:inline">
              {session.name} · {session.clinicName}
            </span>
            <Button variant="ghost" size="sm" onClick={() => void logout()}>
              {t("signOut")}
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Suspense>{children}</Suspense>
      </main>
    </div>
  )
}
