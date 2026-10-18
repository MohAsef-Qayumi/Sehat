/**
 * Hybrid Logical Clock.
 *
 * Timestamps combine wall-clock time with a logical counter and the id of the
 * node that produced them, so every event gets a unique, totally ordered stamp
 * even when device clocks are slightly out of sync or two edits happen in the
 * same millisecond.
 *
 * Serialized as `<wall:15>-<counter:5>-<node>` with zero padding, so plain
 * string comparison gives the correct order.
 */
export type Hlc = string

const WALL_DIGITS = 15
const COUNTER_DIGITS = 5
const MAX_COUNTER = 10 ** COUNTER_DIGITS - 1

export type HlcParts = { wall: number; counter: number; node: string }

export function formatHlc({ wall, counter, node }: HlcParts): Hlc {
  return `${String(wall).padStart(WALL_DIGITS, "0")}-${String(counter).padStart(COUNTER_DIGITS, "0")}-${node}`
}

export function parseHlc(hlc: Hlc): HlcParts {
  const match = /^(\d{15})-(\d{5})-(.+)$/.exec(hlc)
  if (!match) throw new Error(`Invalid HLC: ${hlc}`)
  return { wall: Number(match[1]), counter: Number(match[2]), node: match[3]! }
}

export function isHlc(value: unknown): value is Hlc {
  return typeof value === "string" && /^\d{15}-\d{5}-.+$/.test(value)
}

export function compareHlc(a: Hlc, b: Hlc): number {
  return a < b ? -1 : a > b ? 1 : 0
}

export class HybridClock {
  private wall = 0
  private counter = 0

  constructor(
    readonly node: string,
    private readonly now: () => number = Date.now,
  ) {
    if (!/^[A-Za-z0-9_]+$/.test(node)) throw new Error("Node id must be alphanumeric")
  }

  /** Stamp a local event. */
  tick(): Hlc {
    const physical = this.now()
    if (physical > this.wall) {
      this.wall = physical
      this.counter = 0
    } else {
      this.counter++
    }
    this.guardCounter()
    return formatHlc({ wall: this.wall, counter: this.counter, node: this.node })
  }

  /** Advance past a timestamp received from another node. */
  receive(remote: Hlc): void {
    const { wall: remoteWall, counter: remoteCounter } = parseHlc(remote)
    const physical = this.now()
    const nextWall = Math.max(this.wall, remoteWall, physical)

    if (nextWall === this.wall && nextWall === remoteWall) {
      this.counter = Math.max(this.counter, remoteCounter) + 1
    } else if (nextWall === this.wall) {
      this.counter++
    } else if (nextWall === remoteWall) {
      this.counter = remoteCounter + 1
    } else {
      this.counter = 0
    }
    this.wall = nextWall
    this.guardCounter()
  }

  private guardCounter() {
    if (this.counter > MAX_COUNTER) throw new Error("HLC counter overflow")
  }
}
