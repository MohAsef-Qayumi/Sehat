import { eq } from "drizzle-orm"
import type { Role } from "@/lib/domain"
import type { Db } from "./db"
import { clinics, users } from "./schema"

export class UsernameTakenError extends Error {
  constructor() {
    super("That username is already taken.")
  }
}

export async function createClinic(
  db: Db,
  input: { clinicName: string; name: string; username: string; passwordHash: string },
) {
  return db.transaction(async (tx) => {
    const [taken] = await tx.select({ id: users.id }).from(users).where(eq(users.username, input.username))
    if (taken) throw new UsernameTakenError()

    const [clinic] = await tx.insert(clinics).values({ name: input.clinicName }).returning()
    const [user] = await tx
      .insert(users)
      .values({ clinicId: clinic!.id, name: input.name, username: input.username, passwordHash: input.passwordHash, role: "admin" })
      .returning()
    return { clinic: clinic!, user: user! }
  })
}

export async function addStaff(
  db: Db,
  clinicId: string,
  input: { name: string; username: string; passwordHash: string; role: Role },
) {
  const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.username, input.username))
  if (taken) throw new UsernameTakenError()
  const [user] = await db.insert(users).values({ clinicId, ...input }).returning()
  return user!
}

export async function findLogin(db: Db, username: string) {
  const [row] = await db
    .select({ user: users, clinicName: clinics.name })
    .from(users)
    .innerJoin(clinics, eq(users.clinicId, clinics.id))
    .where(eq(users.username, username))
  return row
}

export async function listStaff(db: Db, clinicId: string) {
  return db
    .select({ id: users.id, name: users.name, username: users.username, role: users.role })
    .from(users)
    .where(eq(users.clinicId, clinicId))
    .orderBy(users.createdAt)
}
