import "server-only"
import { NextResponse } from "next/server"
import type { z } from "zod"

export const json = <T>(body: T, status = 200) => NextResponse.json(body, { status })
export const fail = (message: string, status: number) => NextResponse.json({ error: message }, { status })

export async function parseBody<S extends z.ZodType>(req: Request, schema: S): Promise<z.infer<S> | Response> {
  const body = await req.json().catch(() => undefined)
  const result = schema.safeParse(body)
  if (!result.success) {
    const issue = result.error.issues[0]
    return fail(issue ? `${issue.path.join(".") || "body"}: ${issue.message}` : "Invalid request", 400)
  }
  return result.data
}
