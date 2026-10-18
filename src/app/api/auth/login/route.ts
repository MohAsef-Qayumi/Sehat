import { z } from "zod"
import { findLogin } from "@/server/accounts"
import { startSession, verifyPassword } from "@/server/auth"
import { getDb } from "@/server/db"
import { fail, json, parseBody } from "@/server/http"

const schema = z.object({ username: z.string().trim().toLowerCase().min(1), password: z.string().min(1) })

// Compared against when the user doesn't exist, so response time doesn't reveal valid usernames.
const DUMMY_HASH = "$2b$12$PS3tEtTd0euB0F.OlR0p2uBpS/wpWQ2DdxdyuEBHjbSVOdUdnP8sa"

export async function POST(req: Request) {
  const body = await parseBody(req, schema)
  if (body instanceof Response) return body

  const row = await findLogin(await getDb(), body.username)
  const valid = await verifyPassword(body.password, row?.user.passwordHash ?? DUMMY_HASH)
  if (!row || !valid) return fail("Incorrect username or password.", 401)

  const session = {
    userId: row.user.id,
    clinicId: row.user.clinicId,
    clinicName: row.clinicName,
    name: row.user.name,
    role: row.user.role,
  }
  await startSession(session)
  return json(session)
}
