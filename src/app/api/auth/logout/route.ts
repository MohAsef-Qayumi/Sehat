import { endSession } from "@/server/auth"
import { json } from "@/server/http"

export async function POST() {
  await endSession()
  return json({ ok: true })
}
