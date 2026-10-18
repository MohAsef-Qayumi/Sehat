"use client"

import { useApp } from "@/client/app-context"
import { useI18n } from "@/lib/i18n"
import { cx } from "./ui"

export function SyncIndicator() {
  const { status, syncNow } = useApp()
  const { t } = useI18n()

  const label =
    status.state === "syncing"
      ? t("syncSyncing")
      : status.state === "offline"
        ? t("syncOffline")
        : status.state === "error"
          ? t("syncError")
          : status.pending > 0
            ? t("syncPending", { count: status.pending })
            : t("syncOnline")

  const tone =
    status.state === "error" ? "bg-danger" : status.state === "offline" || status.pending > 0 ? "bg-warn" : "bg-brand"

  const detail = [
    status.state === "error" ? status.message : null,
    status.pending > 0 && status.state !== "idle" ? t("syncPending", { count: status.pending }) : null,
    t("lastSynced", { time: status.lastSyncedAt ? new Date(status.lastSyncedAt).toLocaleTimeString() : t("never") }),
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <button
      type="button"
      onClick={syncNow}
      title={`${detail} — ${t("syncNow")}`}
      className="inline-flex h-8 items-center gap-2 rounded-md border border-line bg-surface px-2.5 text-xs font-medium text-muted hover:text-fg"
    >
      <span className={cx("h-2 w-2 rounded-full", tone, status.state === "syncing" && "animate-pulse")} />
      {label}
    </button>
  )
}
