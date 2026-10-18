import { MAX_PUSH, type SyncRequest, type SyncResponse } from "@/lib/sync/protocol"
import type { Store } from "./store"

export type Transport = (request: SyncRequest) => Promise<SyncResponse>

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

type StatusBase = { lastSyncedAt: number | null; pending: number; rejected: number }

export type SyncStatus =
  | ({ state: "idle" | "syncing" | "offline" } & StatusBase)
  | ({ state: "error"; message: string } & StatusBase)

export const httpTransport: Transport = async (request) => {
  const res = await fetch("/api/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new HttpError(res.status, body.error ?? `Sync failed (${res.status})`)
  return body as SyncResponse
}

/**
 * Pushes the outbox and pulls remote changes until both sides are caught up.
 * Only one run happens at a time; requests made during a run are coalesced
 * into a single follow-up run.
 */
export class SyncEngine {
  private running: Promise<void> | null = null
  private timer: ReturnType<typeof setTimeout> | undefined
  private again = false
  private listeners = new Set<(status: SyncStatus) => void>()
  private lastSyncedAt: number | null = null
  status: SyncStatus = { state: "idle", lastSyncedAt: null, pending: 0, rejected: 0 }

  constructor(
    private readonly store: Store,
    private readonly transport: Transport = httpTransport,
    private readonly isOnline: () => boolean = () => typeof navigator === "undefined" || navigator.onLine,
  ) {}

  subscribe(listener: (status: SyncStatus) => void) {
    this.listeners.add(listener)
    listener(this.status)
    return () => this.listeners.delete(listener)
  }

  /** Sync shortly, coalescing bursts of local edits into one request. */
  syncSoon(delayMs = 800) {
    clearTimeout(this.timer)
    this.timer = setTimeout(() => void this.sync(), delayMs)
  }

  sync(): Promise<void> {
    if (this.running) {
      this.again = true
      return this.running
    }
    this.running = this.run().finally(() => {
      this.running = null
      if (this.again) {
        this.again = false
        void this.sync()
      }
    })
    return this.running
  }

  private async run() {
    if (!this.isOnline()) return this.emit({ state: "offline" })
    await this.emit({ state: "syncing" })

    try {
      for (let guard = 0; guard < 1000; guard++) {
        const { changes, revs } = await this.store.pending(MAX_PUSH)
        const response = await this.transport({ since: await this.store.cursor(), changes })
        await this.store.applyServerPage(response.changes, response.cursor, revs, response.rejected)
        if (!response.hasMore && (await this.store.pendingCount()) === 0) break
        if (!response.hasMore && changes.length === 0) break
      }
      this.lastSyncedAt = Date.now()
      await this.emit({ state: "idle" })
    } catch (error) {
      if (error instanceof HttpError) {
        await this.emit({ state: "error", message: error.message })
      } else {
        // Network failures are expected in the field; stay quiet and retry later.
        await this.emit({ state: "offline" })
      }
    }
  }

  private async emit(partial: { state: "idle" | "syncing" | "offline" } | { state: "error"; message: string }) {
    this.status = {
      ...partial,
      lastSyncedAt: this.lastSyncedAt,
      pending: await this.store.pendingCount(),
      rejected: (await this.store.rejected()).length,
    }
    for (const listener of this.listeners) listener(this.status)
  }
}
