import { compareHlc, type Hlc, type HybridClock } from "./hlc"

/**
 * A record whose every field carries the timestamp of its last write.
 *
 * Merging two versions picks, per field, the value with the newest timestamp
 * (last-writer-wins at field granularity). The operation is commutative,
 * associative and idempotent, so devices converge on the same state no matter
 * the order in which they exchange changes, and concurrent edits to different
 * fields of the same record are both kept.
 */
export type Versioned<T extends object = Record<string, unknown>> = {
  id: string
  data: T
  clocks: Partial<Record<keyof T & string, Hlc>>
}

export function merge<T extends object>(local: Versioned<T> | undefined, remote: Versioned<T>): Versioned<T> {
  if (!local) return remote
  if (local.id !== remote.id) throw new Error(`Cannot merge ${local.id} with ${remote.id}`)

  const data = { ...local.data } as Record<string, unknown>
  const clocks = { ...local.clocks } as Record<string, Hlc>
  const remoteData = remote.data as Record<string, unknown>

  for (const [field, remoteClock] of Object.entries(remote.clocks as Record<string, Hlc>)) {
    const localClock = clocks[field]
    if (localClock === undefined || compareHlc(remoteClock, localClock) > 0) {
      data[field] = remoteData[field]
      clocks[field] = remoteClock
    }
  }

  return { id: local.id, data: data as T, clocks: clocks as Versioned<T>["clocks"] }
}

/** Apply a local edit, stamping every changed field with a fresh timestamp. */
export function applyEdit<T extends object>(
  record: Versioned<T> | undefined,
  id: string,
  patch: Partial<T>,
  clock: HybridClock,
): Versioned<T> {
  const base: Versioned<T> = record ?? { id, data: {} as T, clocks: {} }
  const data = { ...base.data } as Record<string, unknown>
  const clocks = { ...base.clocks } as Record<string, Hlc>

  for (const [field, value] of Object.entries(patch)) {
    if (value === undefined) continue
    if (record && field in data && isEqual(data[field], value)) continue
    data[field] = value
    clocks[field] = clock.tick()
  }

  return { id, data: data as T, clocks: clocks as Versioned<T>["clocks"] }
}

/** True when `a` already contains everything in `b`. */
export function dominates<T extends object>(a: Versioned<T>, b: Versioned<T>): boolean {
  return Object.entries(b.clocks as Record<string, Hlc>).every(([field, clock]) => {
    const own = (a.clocks as Record<string, Hlc>)[field]
    return own !== undefined && compareHlc(own, clock) >= 0
  })
}

/** Newest timestamp across all fields; used for ordering and clock checks. */
export function latestClock(record: Versioned): Hlc | undefined {
  let latest: Hlc | undefined
  for (const clock of Object.values(record.clocks) as Hlc[]) {
    if (latest === undefined || compareHlc(clock, latest) > 0) latest = clock
  }
  return latest
}

function isEqual(a: unknown, b: unknown): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b)
}
