import { getSession } from "@/server/auth"
import { fail, json } from "@/server/http"

export async function GET() {
  const session = await getSession()
  return session ? json(session) : fail("Not signed in.", 401)
}
