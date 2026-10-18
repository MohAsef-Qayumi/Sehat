import { syncRequestSchema } from "@/lib/sync/protocol"
import { getSession } from "@/server/auth"
import { getDb } from "@/server/db"
import { fail, json, parseBody } from "@/server/http"
import { ClockSkewError, sync } from "@/server/sync"

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return fail("Not signed in.", 401)

  const body = await parseBody(req, syncRequestSchema)
  if (body instanceof Response) return body

  try {
    return json(await sync(await getDb(), session.clinicId, body))
  } catch (error) {
    if (error instanceof ClockSkewError) return fail(error.message, 409)
    throw error
  }
}
