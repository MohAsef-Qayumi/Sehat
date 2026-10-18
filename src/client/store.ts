import { collectionNames, type CollectionData, type CollectionName } from "@/lib/domain"
import { compareHlc, HybridClock, type Hlc } from "@/lib/sync/hlc"
import { applyEdit, latestClock, merge, type Versioned } from "@/lib/sync/merge"
import type { Change } from "@/lib/sync/protocol"
import type { LocalDb, LocalRecord } from "./db"

const NODE_KEY = "node"
const CLOCK_KEY = "lastClock"
const CURSOR_KEY = "cursor"

function randomNode() {
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  return Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("")
}

/**
 * Local-first data access. Every write lands in IndexedDB immediately and is
 * queued in the outbox; the sync engine ships it whenever a connection exists.
 */
export class Store {
  private constructor(
    readonly db: LocalDb,
    readonly clock: HybridClock,
  ) {}

  static async open(db: LocalDb, now?: () => number): Promise<Store> {
    let node = (await db.meta.get(NODE_KEY))?.value as string | undefined
    if (!node) {
      node = randomNode()
      await db.meta.put({ key: NODE_KEY, value: node })
    }
    const clock = new HybridClock(node, now)
    // Never issue timestamps older than ones we already used, even if the
    // device clock was moved backwards since the last session.
    const last = (await db.meta.get(CLOCK_KEY))?.value as Hlc | undefined
    if (last) clock.receive(last)
    return new Store(db, clock)
  }

  async write<C extends CollectionName>(collection: C, id: string, patch: Partial<CollectionData[C]>) {
    const table = this.db.records(collection)
    return this.db.transaction("rw", [table, this.db.outbox, this.db.meta], async () => {
      const current = await table.get(id)
      const next = applyEdit(current as Versioned<Partial<CollectionData[C]>> | undefined, id, patch, this.clock)
      await table.put(next as LocalRecord<C>)

      const key = `${collection}:${id}`
      const queued = await this.db.outbox.get(key)
      await this.db.outbox.put({ key, collection, id, rev: (queued?.rev ?? 0) + 1 })

      const latest = latestClock(next as Versioned)
      if (latest) await this.db.meta.put({ key: CLOCK_KEY, value: latest })
      return next
    })
  }

  create<C extends CollectionName>(collection: C, data: CollectionData[C]) {
    return this.write(collection, crypto.randomUUID(), data)
  }

  async pending(limit: number): Promise<{ changes: Change[]; revs: Map<string, number> }> {
    const entries = await this.db.outbox.limit(limit).toArray()
    const revs = new Map<string, number>()
    const changes: Change[] = []
    for (const entry of entries) {
      const record = await this.db.records(entry.collection).get(entry.id)
      if (!record) continue
      revs.set(entry.key, entry.rev)
      changes.push({ collection: entry.collection, id: entry.id, data: record.data, clocks: record.clocks as Record<string, Hlc> })
    }
    return { changes, revs }
  }

  /** Merge a page from the server and clear outbox entries that were not edited meanwhile. */
  async applyServerPage(changes: Change[], cursor: number, acknowledged: Map<string, number>) {
    const tables = collectionNames.map((c) => this.db.records(c))
    await this.db.transaction("rw", [...tables, this.db.outbox, this.db.meta], async () => {
      let newest: Hlc | undefined
      for (const change of changes) {
        const table = this.db.records(change.collection)
        const incoming = { id: change.id, data: change.data, clocks: change.clocks } as Versioned
        const merged = merge((await table.get(change.id)) as Versioned | undefined, incoming)
        await table.put(merged as LocalRecord)
        const latest = latestClock(incoming)
        if (latest && (!newest || compareHlc(latest, newest) > 0)) newest = latest
      }
      if (newest) {
        this.clock.receive(newest)
        await this.db.meta.put({ key: CLOCK_KEY, value: newest })
      }

      for (const [key, rev] of acknowledged) {
        const entry = await this.db.outbox.get(key)
        if (entry && entry.rev === rev) await this.db.outbox.delete(key)
      }
      await this.db.meta.put({ key: CURSOR_KEY, value: cursor })
    })
  }

  async cursor(): Promise<number> {
    return ((await this.db.meta.get(CURSOR_KEY))?.value as number | undefined) ?? 0
  }

  pendingCount() {
    return this.db.outbox.count()
  }
}
