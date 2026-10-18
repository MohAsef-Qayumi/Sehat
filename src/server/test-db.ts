import { PGlite } from "@electric-sql/pglite"
import { drizzle } from "drizzle-orm/pglite"
import { migrate } from "drizzle-orm/pglite/migrator"
import type { Db } from "./db"
import * as schema from "./schema"

/** Fresh in-memory Postgres with migrations applied. For tests only. */
export async function createTestDb(): Promise<Db> {
  const db = drizzle(new PGlite(), { schema })
  await migrate(db, { migrationsFolder: "./drizzle" })
  return db as unknown as Db
}

export async function createClinic(db: Db, name = "Test Clinic") {
  const [clinic] = await db.insert(schema.clinics).values({ name }).returning()
  return clinic!
}
