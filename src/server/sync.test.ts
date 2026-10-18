import { beforeEach, describe, expect, it } from "vitest"
import { HybridClock } from "@/lib/sync/hlc"
import { applyEdit } from "@/lib/sync/merge"
import type { Change } from "@/lib/sync/protocol"
import type { Db } from "./db"
import { ClockSkewError, sync } from "./sync"
import { createClinic, createTestDb } from "./test-db"

const NOW = 1_750_000_000_000
const P1 = "7c9e6679-7425-40de-944b-e07fc1f90ae7"

function patientChange(clock: HybridClock, patch: Record<string, unknown>, base?: Change): Change {
  const v = applyEdit(base, P1, patch, clock)
  return { collection: "patients", id: P1, data: v.data, clocks: v.clocks as Record<string, string> }
}

describe("server sync", () => {
  let db: Db
  let clinicId: string

  beforeEach(async () => {
    db = await createTestDb()
    clinicId = (await createClinic(db)).id
  })

  it("stores pushed changes and returns them to other devices", async () => {
    const reception = new HybridClock("reception", () => NOW)
    const change = patientChange(reception, { fullName: "Ahmad Khan", phone: "0700" })

    await sync(db, clinicId, { since: 0, changes: [change] }, NOW)
    const pulled = await sync(db, clinicId, { since: 0, changes: [] }, NOW)

    expect(pulled.changes).toHaveLength(1)
    expect(pulled.changes[0]!.data).toEqual({ fullName: "Ahmad Khan", phone: "0700" })
    expect(pulled.cursor).toBeGreaterThan(0)
  })

  it("merges concurrent offline edits field by field", async () => {
    const reception = new HybridClock("reception", () => NOW)
    const doctor = new HybridClock("doctor", () => NOW + 10)
    const created = patientChange(reception, { fullName: "Ahmad", phone: "0700", allergies: "" })
    await sync(db, clinicId, { since: 0, changes: [created] }, NOW)

    const phone = patientChange(reception, { phone: "0799" }, created)
    const allergy = patientChange(doctor, { allergies: "Penicillin" }, created)
    await sync(db, clinicId, { since: 0, changes: [allergy] }, NOW)
    const result = await sync(db, clinicId, { since: 0, changes: [phone] }, NOW)

    expect(result.changes[0]!.data).toEqual({ fullName: "Ahmad", phone: "0799", allergies: "Penicillin" })
  })

  it("does not bump the cursor for changes the server already has", async () => {
    const clock = new HybridClock("a", () => NOW)
    const change = patientChange(clock, { fullName: "A" })
    const first = await sync(db, clinicId, { since: 0, changes: [change] }, NOW)
    const again = await sync(db, clinicId, { since: first.cursor, changes: [change] }, NOW)

    expect(again.changes).toEqual([])
    expect(again.cursor).toBe(first.cursor)
  })

  it("only returns changes after the cursor", async () => {
    const clock = new HybridClock("a", () => NOW)
    const first = await sync(db, clinicId, { since: 0, changes: [patientChange(clock, { fullName: "A" })] }, NOW)
    const second = await sync(db, clinicId, { since: first.cursor, changes: [patientChange(clock, { phone: "1" })] }, NOW)

    expect(second.changes).toHaveLength(1)
    expect(second.changes[0]!.data).toMatchObject({ fullName: "A", phone: "1" })
  })

  it("keeps clinics isolated from each other", async () => {
    const other = await createClinic(db, "Other")
    const clock = new HybridClock("a", () => NOW)
    await sync(db, clinicId, { since: 0, changes: [patientChange(clock, { fullName: "Private" })] }, NOW)

    const pulled = await sync(db, other.id, { since: 0, changes: [] }, NOW)
    expect(pulled.changes).toEqual([])
  })

  it("applies valid changes even when another change in the batch is invalid", async () => {
    const clock = new HybridClock("a", () => NOW)
    const good = patientChange(clock, { fullName: "Good" })
    const bad = { ...patientChange(clock, { fullName: "Bad" }), id: "8d2f6b1e-1111-4a0b-9c3d-000000000001", data: { id: "x" }, clocks: { id: good.clocks.fullName! } }

    const result = await sync(db, clinicId, { since: 0, changes: [bad, good] }, NOW)

    expect(result.changes.map((c) => c.data.fullName)).toEqual(["Good"])
    expect(result.rejected).toEqual([{ collection: "patients", id: bad.id, reason: "clocks.id: Unknown field" }])
  })

  it("rejects writes from a device whose clock is far ahead", async () => {
    const future = new HybridClock("bad", () => NOW + 24 * 60 * 60 * 1000)
    await expect(sync(db, clinicId, { since: 0, changes: [patientChange(future, { fullName: "X" })] }, NOW)).rejects.toBeInstanceOf(
      ClockSkewError,
    )
  })
})
