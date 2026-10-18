import type { Db } from "../src/server/db"
import * as schema from "../src/server/schema"

/** Script-side twin of src/server/db.ts (which is server-only). */
export async function connect(): Promise<{ db: Db; close: () => Promise<void>; migrate: () => Promise<void> }> {
  const url = process.env.DATABASE_URL
  if (url) {
    const { Pool } = await import("pg")
    const { drizzle } = await import("drizzle-orm/node-postgres")
    const { migrate } = await import("drizzle-orm/node-postgres/migrator")
    const pool = new Pool({ connectionString: url })
    const db = drizzle(pool, { schema })
    return {
      db: db as unknown as Db,
      close: () => pool.end(),
      migrate: () => migrate(db, { migrationsFolder: "./drizzle" }),
    }
  }

  const { PGlite } = await import("@electric-sql/pglite")
  const dir = process.env.PGLITE_DIR ?? "./.data/pglite"
  const { mkdirSync } = await import("node:fs")
  mkdirSync(dir, { recursive: true })
  const { drizzle } = await import("drizzle-orm/pglite")
  const { migrate } = await import("drizzle-orm/pglite/migrator")
  const client = new PGlite(dir)
  const db = drizzle(client, { schema })
  return {
    db: db as unknown as Db,
    close: () => client.close(),
    migrate: () => migrate(db, { migrationsFolder: "./drizzle" }),
  }
}
