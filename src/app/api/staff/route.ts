import { z } from "zod"
import { roles } from "@/lib/domain"
import { addStaff, listStaff, UsernameTakenError } from "@/server/accounts"
import { getSession, hashPassword } from "@/server/auth"
import { getDb } from "@/server/db"
import { fail, json, parseBody } from "@/server/http"

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,40}$/, "3-40 letters, numbers, dots or dashes"),
  password: z.string().min(8).max(200),
  role: z.enum(roles),
})

export async function GET() {
  const session = await getSession()
  if (!session) return fail("Not signed in.", 401)
  return json(await listStaff(await getDb(), session.clinicId))
}

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return fail("Not signed in.", 401)
  if (session.role !== "admin") return fail("Only admins can add staff.", 403)

  const body = await parseBody(req, schema)
  if (body instanceof Response) return body

  try {
    const user = await addStaff(await getDb(), session.clinicId, {
      name: body.name,
      username: body.username,
      role: body.role,
      passwordHash: await hashPassword(body.password),
    })
    return json({ id: user.id, name: user.name, username: user.username, role: user.role }, 201)
  } catch (error) {
    if (error instanceof UsernameTakenError) return fail(error.message, 409)
    throw error
  }
}
