import { IDBFactory, IDBKeyRange } from "fake-indexeddb"
import { beforeEach, describe, expect, it } from "vitest"
import type { Patient } from "@/lib/domain"
import type { Db } from "@/server/db"
import { sync } from "@/server/sync"
import { createClinic, createTestDb } from "@/server/test-db"
import { LocalDb } from "./db"
import { Store } from "./store"
import { SyncEngine, type Transport } from "./sync-engine"

const patient = (fullName: string): Patient => ({
  fullName,
  fatherName: "",
  sex: "male",
  birthYear: 1990,
  phone: "",
  address: "",
  allergies: "",
  notes: "",
  deleted: false,
})

describe("offline-first clients", () => {
  let server: Db
  let clinicId: string
  let online: boolean

  beforeEach(async () => {
    server = await createTestDb()
    clinicId = (await createClinic(server)).id
    online = true
  })

  async function device(name: string, start: number) {
    let t = start
    const db = new LocalDb(name, { indexedDB: new IDBFactory(), IDBKeyRange })
    const store = await Store.open(db, () => t)
    const transport: Transport = async (req) => {
      if (!online) throw new TypeError("Failed to fetch")
      return sync(server, clinicId, req, Date.now())
    }
    const engine = new SyncEngine(store, transport, () => online)
    return { store, engine, tick: (ms: number) => (t += ms) }
  }

  it("works offline and catches up when the connection returns", async () => {
    const reception = await device("reception", Date.now())
    const doctor = await device("doctor", Date.now())

    online = false
    const created = await reception.store.create("patients", patient("Bibi Gul"))
    await reception.engine.sync()
    expect(reception.engine.status.state).toBe("offline")
    expect(reception.engine.status.pending).toBe(1)

    online = true
    await reception.engine.sync()
    await doctor.engine.sync()

    expect(reception.engine.status).toMatchObject({ state: "idle", pending: 0 })
    expect((await doctor.store.db.patients.get(created.id))?.data.fullName).toBe("Bibi Gul")
  })

  it("keeps both sides' edits after concurrent offline work", async () => {
    const reception = await device("reception", Date.now())
    const doctor = await device("doctor", Date.now())

    const { id } = await reception.store.create("patients", patient("Ahmad"))
    await reception.engine.sync()
    await doctor.engine.sync()

    online = false
    reception.tick(1000)
    doctor.tick(2000)
    await reception.store.write("patients", id, { phone: "0799 123 456" })
    await doctor.store.write("patients", id, { allergies: "Penicillin" })

    online = true
    await doctor.engine.sync()
    await reception.engine.sync()
    await doctor.engine.sync()

    for (const d of [reception, doctor]) {
      const record = await d.store.db.patients.get(id)
      expect(record?.data).toMatchObject({ phone: "0799 123 456", allergies: "Penicillin" })
    }
  })

  it("sets aside a change the server rejects instead of retrying it forever", async () => {
    const reception = await device("reception", Date.now())
    const good = await reception.store.create("patients", patient("Valid"))
    // Simulate a corrupt local record, e.g. written by an older app version.
    await reception.store.write("patients", crypto.randomUUID(), { unknownField: 1 } as never)

    await reception.engine.sync()

    expect(reception.engine.status).toMatchObject({ state: "idle", pending: 0, rejected: 1 })
    const other = await device("other", Date.now())
    await other.engine.sync()
    expect((await other.store.db.patients.get(good.id))?.data.fullName).toBe("Valid")
  })

  it("does not drop an edit made while a sync is in flight", async () => {
    const reception = await device("reception", Date.now())
    const { id } = await reception.store.create("patients", patient("A"))

    const running = reception.engine.sync()
    await reception.store.write("patients", id, { phone: "123" })
    await running
    await reception.engine.sync()

    const fresh = await device("other", Date.now())
    await fresh.engine.sync()
    expect((await fresh.store.db.patients.get(id))?.data.phone).toBe("123")
  })
})
