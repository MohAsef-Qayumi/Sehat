import { describe, expect, it } from "vitest"
import { HybridClock } from "./hlc"
import { applyEdit, dominates, merge, type Versioned } from "./merge"

type Patient = { name: string; phone: string; allergies: string }

function device(node: string, start = 1000) {
  let t = start
  const clock = new HybridClock(node, () => t)
  return { clock, advance: (ms: number) => (t += ms) }
}

describe("merge", () => {
  it("keeps concurrent edits to different fields", () => {
    const reception = device("reception")
    const doctor = device("doctor")

    const created = applyEdit<Patient>(undefined, "p1", { name: "Ahmad", phone: "0700", allergies: "" }, reception.clock)

    reception.advance(10)
    doctor.advance(10)
    const fromReception = applyEdit(created, "p1", { phone: "0799" }, reception.clock)
    const fromDoctor = applyEdit(created, "p1", { allergies: "Penicillin" }, doctor.clock)

    const merged = merge(fromReception, fromDoctor)
    expect(merged.data).toEqual({ name: "Ahmad", phone: "0799", allergies: "Penicillin" })
  })

  it("lets the later write win on the same field", () => {
    const a = device("a")
    const b = device("b")
    const base = applyEdit<Patient>(undefined, "p1", { name: "Old" }, a.clock)

    a.advance(5)
    b.advance(20)
    const early = applyEdit(base, "p1", { name: "Early" }, a.clock)
    const late = applyEdit(base, "p1", { name: "Late" }, b.clock)

    expect(merge(early, late).data.name).toBe("Late")
    expect(merge(late, early).data.name).toBe("Late")
  })

  it("does not restamp fields whose value did not change", () => {
    const a = device("a")
    const base = applyEdit<Patient>(undefined, "p1", { name: "Same" }, a.clock)
    a.advance(5)
    const edited = applyEdit(base, "p1", { name: "Same" }, a.clock)
    expect(edited.clocks).toEqual(base.clocks)
  })

  it("detects when one version already contains another", () => {
    const a = device("a")
    const v1 = applyEdit<Patient>(undefined, "p1", { name: "A" }, a.clock)
    const v2 = applyEdit(v1, "p1", { phone: "1" }, a.clock)
    expect(dominates(v2, v1)).toBe(true)
    expect(dominates(v1, v2)).toBe(false)
  })

  it("converges regardless of delivery order (randomised)", () => {
    // Deterministic PRNG so failures are reproducible.
    let seed = 42
    const random = () => ((seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31) / 2 ** 31)
    const fields: (keyof Patient)[] = ["name", "phone", "allergies"]

    for (let round = 0; round < 200; round++) {
      const devices = ["a", "b", "c"].map((n) => device(n, 1000 + Math.floor(random() * 50)))
      const versions: Versioned<Patient>[] = []

      for (const d of devices) {
        let v: Versioned<Patient> | undefined
        for (let i = 0; i < 4; i++) {
          d.advance(Math.floor(random() * 3))
          const field = fields[Math.floor(random() * fields.length)]!
          v = applyEdit(v, "p1", { [field]: `${d.clock.node}-${i}` }, d.clock)
        }
        versions.push(v!)
      }

      const orders = [
        [0, 1, 2],
        [2, 1, 0],
        [1, 0, 2],
      ]
      const results = orders.map((order) =>
        order.reduce<Versioned<Patient> | undefined>((acc, i) => merge(acc, versions[i]!), undefined),
      )

      expect(results[1]).toEqual(results[0])
      expect(results[2]).toEqual(results[0])
      // Idempotent: merging again changes nothing.
      expect(merge(results[0], versions[1]!)).toEqual(results[0])
    }
  })
})
