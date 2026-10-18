import { z } from "zod"
import { createClinic, UsernameTakenError } from "@/server/accounts"
import { hashPassword, startSession } from "@/server/auth"
import { getDb } from "@/server/db"
import { fail, json, parseBody } from "@/server/http"

const schema = z.object({
  clinicName: z.string().trim().min(2).max(120),
  name: z.string().trim().min(2).max(120),
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,40}$/, "3-40 letters, numbers, dots or dashes"),
  password: z.string().min(8).max(200),
})

export async function POST(req: Request) {
  const body = await parseBody(req, schema)
  if (body instanceof Response) return body

  try {
    const { clinic, user } = await createClinic(await getDb(), {
      clinicName: body.clinicName,
      name: body.name,
      username: body.username,
      passwordHash: await hashPassword(body.password),
    })
    const session = { userId: user.id, clinicId: clinic.id, clinicName: clinic.name, name: user.name, role: user.role }
    await startSession(session)
    return json(session, 201)
  } catch (error) {
    if (error instanceof UsernameTakenError) return fail(error.message, 409)
    throw error
  }
}
