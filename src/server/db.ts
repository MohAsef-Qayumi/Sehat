import "server-only"
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core"
import * as schema from "./schema"

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>

const MIGRATIONS = "./drizzle"

let instance: Promise<Db> | undefined

/**
 * Uses Postgres when DATABASE_URL is set, otherwise an embedded PGlite
 * database on disk so the app runs locally with zero setup.
 */
export function getDb(): Promise<Db> {
  instance ??= connect()
  return instance
}

async function connect(): Promise<Db> {
  const url = process.env.DATABASE_URL
  if (url) {
    const { Pool } = await import("pg")
    const { drizzle } = await import("drizzle-orm/node-postgres")
    return drizzle(new Pool({ connectionString: url, max: 5 }), { schema }) as unknown as Db
  }

  const { PGlite } = await import("@electric-sql/pglite")
  const { drizzle } = await import("drizzle-orm/pglite")
  const { migrate } = await import("drizzle-orm/pglite/migrator")
  const db = drizzle(new PGlite(process.env.PGLITE_DIR ?? "./.data/pglite"), { schema })
  await migrate(db, { migrationsFolder: MIGRATIONS })
  return db as unknown as Db
}
