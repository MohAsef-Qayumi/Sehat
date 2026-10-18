"use client"

import Link from "next/link"
import { useState } from "react"
import { useApp } from "@/client/app-context"
import { ageFrom, today, usePatients, useQueue, type QueueRow } from "@/client/hooks"
import { Badge, Button, Card, Empty, Input, PageHeader, cx } from "@/components/ui"
import type { QueueStatus } from "@/lib/domain"
import { useI18n } from "@/lib/i18n"

const statusTone = { waiting: "warn", "with-doctor": "brand", done: "neutral", left: "neutral" } as const

export default function QueuePage() {
  const { t } = useI18n()
  const { write, create, store } = useApp()
  const day = today()
  const queue = useQueue(day)
  const [search, setSearch] = useState("")
  const matches = usePatients(search)

  const active = queue?.filter((q) => q.status === "waiting" || q.status === "with-doctor") ?? []
  const finished = queue?.filter((q) => q.status === "done" || q.status === "left") ?? []
  const queuedIds = new Set(active.map((q) => q.patientId))

  const setStatus = (row: QueueRow, status: QueueStatus) => write("queue", row.id, { status })

  async function enqueue(patientId: string) {
    await create("queue", { patientId, day, checkedInAt: store.clock.tick(), status: "waiting", deleted: false })
    setSearch("")
  }

  return (
    <>
      <PageHeader
        title={t("todayQueue")}
        description={`${t("waitingCount", { count: active.length })} · ${t("seenCount", { count: finished.filter((q) => q.status === "done").length })}`}
        actions={
          <Link href="/patients/new">
            <Button variant="secondary">{t("newPatient")}</Button>
          </Link>
        }
      />

      <div className="relative mb-6">
        <Input type="search" placeholder={`${t("addToQueue")}: ${t("searchPatients")}`} value={search} onChange={(e) => setSearch(e.target.value)} />
        {search.trim() && (
          <Card className="absolute inset-x-0 top-11 z-10 max-h-72 divide-y divide-line overflow-auto shadow-lg">
            {matches?.length === 0 && <p className="px-4 py-3 text-sm text-muted">{t("noMatches")}</p>}
            {matches?.slice(0, 8).map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.fullName}</p>
                  <p className="truncate text-xs text-muted">{[p.fatherName, p.phone].filter(Boolean).join(" · ")}</p>
                </div>
                {queuedIds.has(p.id) ? (
                  <Badge tone="brand">{t("inQueue")}</Badge>
                ) : (
                  <Button size="sm" onClick={() => void enqueue(p.id)}>
                    {t("addToQueue")}
                  </Button>
                )}
              </div>
            ))}
          </Card>
        )}
      </div>

      {queue !== undefined && active.length === 0 && (
        <Empty title={t("queueEmpty")}>{t("queueEmptyHint")}</Empty>
      )}

      {active.length > 0 && (
        <Card className="divide-y divide-line">
          {active.map((row) => (
            <QueueItem key={row.id} row={row} onStatus={setStatus} />
          ))}
        </Card>
      )}

      {finished.length > 0 && (
        <Card className="mt-6 divide-y divide-line opacity-70">
          {finished.map((row) => (
            <QueueItem key={row.id} row={row} onStatus={setStatus} />
          ))}
        </Card>
      )}
    </>
  )
}

function QueueItem({ row, onStatus }: { row: QueueRow; onStatus: (row: QueueRow, status: QueueStatus) => void }) {
  const { t } = useI18n()
  const age = ageFrom(row.patient?.birthYear)
  const status = row.status ?? "waiting"

  return (
    <div className={cx("flex flex-wrap items-center gap-4 px-4 py-3", status === "with-doctor" && "bg-brand/5")}>
      <span className="w-8 text-center text-lg font-semibold tabular-nums text-muted">{row.number}</span>
      <Link href={`/patient?id=${row.patientId}`} className="min-w-0 flex-1 hover:underline">
        <p className="truncate font-medium">{row.patient?.fullName ?? "…"}</p>
        <p className="truncate text-sm text-muted">
          {[row.patient?.fatherName, age !== null && t("ageYears", { age })].filter(Boolean).join(" · ")}
        </p>
      </Link>
      <Badge tone={statusTone[status]}>{t(`status${status[0]!.toUpperCase()}${status.slice(1)}` as "statusWaiting")}</Badge>
      <div className="flex gap-1">
        {status === "waiting" && (
          <Button size="sm" onClick={() => onStatus(row, "with-doctor")}>
            {t("callIn")}
          </Button>
        )}
        {status === "with-doctor" && (
          <>
            <Link href={`/visit/new?patient=${row.patientId}`}>
              <Button size="sm">{t("newVisit")}</Button>
            </Link>
            <Button size="sm" variant="secondary" onClick={() => onStatus(row, "done")}>
              {t("markDone")}
            </Button>
          </>
        )}
        {(status === "waiting" || status === "with-doctor") && (
          <Button size="sm" variant="ghost" onClick={() => onStatus(row, "left")}>
            {t("markLeft")}
          </Button>
        )}
        {(status === "done" || status === "left") && (
          <Button size="sm" variant="ghost" onClick={() => onStatus(row, "waiting")}>
            {t("backToWaiting")}
          </Button>
        )}
      </div>
    </div>
  )
}
