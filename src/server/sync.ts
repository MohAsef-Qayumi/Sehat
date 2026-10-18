import { and, asc, eq, gt, sql } from "drizzle-orm"
import { compareHlc, formatHlc, type Hlc } from "@/lib/sync/hlc"
import { dominates, latestClock, merge, type Versioned } from "@/lib/sync/merge"
import { PULL_PAGE, type Change, type SyncRequest, type SyncResponse } from "@/lib/sync/protocol"
import type { Db } from "./db"
import { changeSeq, records } from "./schema"

/** How far ahead of the server a device clock may run before we refuse its writes. */
export const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000

export class ClockSkewError extends Error {
  constructor(readonly clock: Hlc) {
    super("This device's clock is ahead of the server. Fix the date and time, then sync again.")
  }
}

/**
 * Apply a device's pending changes, then return everything the device has not
 * seen yet.
 *
 * Writes for a clinic are serialised with a transaction-scoped advisory lock.
 * Sequence numbers are therefore committed in order, which guarantees a
 * client reading `seq > cursor` can never skip a change that commits late.
 */
export async function sync(db: Db, clinicId: string, request: SyncRequest, now = Date.now()): Promise<SyncResponse> {
  const limit = formatHlc({ wall: now + MAX_CLOCK_SKEW_MS, counter: 99999, node: "~" })
  for (const change of request.changes) {
    const latest = latestClock(change as Versioned)
    if (latest && compareHlc(latest, limit) > 0) throw new ClockSkewError(latest)
  }

  return db.transaction(async (tx) => {
    if (request.changes.length > 0) {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${clinicId}))`)
      for (const change of request.changes) await apply(tx as unknown as Db, clinicId, change)
    }

    const rows = await tx
      .select()
      .from(records)
      .where(and(eq(records.clinicId, clinicId), gt(records.seq, request.since)))
      .orderBy(asc(records.seq))
      .limit(PULL_PAGE + 1)

    const page = rows.slice(0, PULL_PAGE)
    return {
      changes: page.map((r) => ({ collection: r.collection as Change["collection"], id: r.id, data: r.data, clocks: r.clocks })),
      cursor: page.at(-1)?.seq ?? request.since,
      hasMore: rows.length > PULL_PAGE,
      serverTime: now,
    }
  })
}

async function apply(db: Db, clinicId: string, change: Change) {
  const [existing] = await db
    .select({ data: records.data, clocks: records.clocks })
    .from(records)
    .where(and(eq(records.clinicId, clinicId), eq(records.collection, change.collection), eq(records.id, change.id)))
    .for("update")

  const incoming: Versioned = { id: change.id, data: change.data, clocks: change.clocks }
  const current: Versioned | undefined = existing && { id: change.id, ...existing }
  if (current && dominates(current, incoming)) return

  const merged = merge(current, incoming)
  const seq = sql`nextval(${sql.raw(`'${changeSeq.seqName}'`)})`

  await db
    .insert(records)
    .values({ clinicId, collection: change.collection, id: change.id, data: merged.data, clocks: merged.clocks as Record<string, string>, seq })
    .onConflictDoUpdate({
      target: [records.clinicId, records.collection, records.id],
      set: { data: merged.data, clocks: merged.clocks as Record<string, string>, seq, updatedAt: new Date() },
    })
}
