import { bigint, index, jsonb, pgSequence, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core"
import type { Role } from "@/lib/domain"

export const clinics = pgTable("clinics", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  clinicId: uuid("clinic_id")
    .notNull()
    .references(() => clinics.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").$type<Role>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

/** Global, monotonically increasing change counter used as the pull cursor. */
export const changeSeq = pgSequence("change_seq")

/**
 * Every synced document, regardless of collection. Field values and their
 * clocks are stored as JSON so the server can merge without knowing the
 * shape of each collection; validation happens at the API boundary.
 */
export const records = pgTable(
  "records",
  {
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id, { onDelete: "cascade" }),
    collection: text("collection").notNull(),
    id: uuid("id").notNull(),
    data: jsonb("data").$type<Record<string, unknown>>().notNull(),
    clocks: jsonb("clocks").$type<Record<string, string>>().notNull(),
    seq: bigint("seq", { mode: "number" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.clinicId, t.collection, t.id] }), index("records_clinic_seq_idx").on(t.clinicId, t.seq)],
)
