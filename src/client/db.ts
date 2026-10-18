import Dexie, { type DexieOptions, type EntityTable } from "dexie"
import type { CollectionData, CollectionName } from "@/lib/domain"
import type { Versioned } from "@/lib/sync/merge"

export type LocalRecord<C extends CollectionName = CollectionName> = Versioned<Partial<CollectionData[C]>>

export type OutboxEntry = {
  key: string
  collection: CollectionName
  id: string
  /** Bumped on every local edit, so a sync only clears entries it actually sent. */
  rev: number
}

export type MetaEntry = { key: string; value: unknown }

export class LocalDb extends Dexie {
  patients!: EntityTable<LocalRecord<"patients">, "id">
  visits!: EntityTable<LocalRecord<"visits">, "id">
  queue!: EntityTable<LocalRecord<"queue">, "id">
  outbox!: EntityTable<OutboxEntry, "key">
  meta!: EntityTable<MetaEntry, "key">

  constructor(name: string, options?: DexieOptions) {
    super(name, options)
    this.version(1).stores({
      patients: "id, data.fullName",
      visits: "id, data.patientId, data.date",
      queue: "id, data.day",
      outbox: "key",
      meta: "key",
    })
  }

  records<C extends CollectionName>(collection: C) {
    return this[collection] as unknown as EntityTable<LocalRecord<C>, "id">
  }
}

/** One database per signed-in clinic, so switching accounts never mixes records. */
export const databaseName = (clinicId: string) => `sehat-${clinicId}`
