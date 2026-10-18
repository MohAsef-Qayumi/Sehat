import { describe, expect, it } from "vitest"
import { HybridClock, compareHlc, formatHlc, parseHlc } from "./hlc"

const fixedTime = (start: number) => {
  let t = start
  return { now: () => t, set: (v: number) => (t = v) }
}

describe("HybridClock", () => {
  it("round-trips through format and parse", () => {
    const parts = { wall: 1_700_000_000_000, counter: 42, node: "dev1" }
    expect(parseHlc(formatHlc(parts))).toEqual(parts)
  })

  it("is strictly increasing even when wall time stands still", () => {
    const time = fixedTime(1000)
    const clock = new HybridClock("a", time.now)
    const stamps = Array.from({ length: 5 }, () => clock.tick())
    expect([...stamps].sort(compareHlc)).toEqual(stamps)
    expect(new Set(stamps).size).toBe(5)
  })

  it("stays monotonic when the wall clock goes backwards", () => {
    const time = fixedTime(5000)
    const clock = new HybridClock("a", time.now)
    const before = clock.tick()
    time.set(1000)
    expect(compareHlc(clock.tick(), before)).toBe(1)
  })

  it("orders local events after anything it has received", () => {
    const time = fixedTime(1000)
    const behind = new HybridClock("a", time.now)
    const ahead = new HybridClock("b", () => 9000)

    const remote = ahead.tick()
    behind.receive(remote)
    expect(compareHlc(behind.tick(), remote)).toBe(1)
  })

  it("breaks ties between nodes deterministically", () => {
    const a = new HybridClock("a", () => 1000).tick()
    const b = new HybridClock("b", () => 1000).tick()
    expect(compareHlc(a, b)).toBe(-1)
  })

  it("compares as plain strings across digit boundaries", () => {
    const small = formatHlc({ wall: 999, counter: 0, node: "z" })
    const large = formatHlc({ wall: 1000, counter: 0, node: "a" })
    expect(compareHlc(small, large)).toBe(-1)
  })

  it("rejects node ids that would break parsing", () => {
    expect(() => new HybridClock("a-b")).toThrow()
  })
})
