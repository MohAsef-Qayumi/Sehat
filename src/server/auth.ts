import "server-only"
import bcrypt from "bcryptjs"
import { jwtVerify, SignJWT } from "jose"
import { cookies } from "next/headers"
import type { Role } from "@/lib/domain"

export const SESSION_COOKIE = "sehat_session"
// Long-lived on purpose: staff must stay signed in through days without internet.
const SESSION_DAYS = 30

export type Session = {
  userId: string
  clinicId: string
  clinicName: string
  name: string
  role: Role
}

function secret() {
  const value = process.env.AUTH_SECRET
  if (value && value.length >= 32) return new TextEncoder().encode(value)
  if (process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET must be set (32+ characters)")
  return new TextEncoder().encode("sehat-development-secret-do-not-use-in-prod")
}

export const hashPassword = (password: string) => bcrypt.hash(password, 12)
export const verifyPassword = (password: string, hash: string) => bcrypt.compare(password, hash)

export async function startSession(session: Session) {
  const token = await new SignJWT({ ...session })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(session.userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret())

  const jar = await cookies()
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  })
}

export async function endSession() {
  const jar = await cookies()
  jar.delete(SESSION_COOKIE)
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] })
    return {
      userId: String(payload.userId),
      clinicId: String(payload.clinicId),
      clinicName: String(payload.clinicName),
      name: String(payload.name),
      role: payload.role as Role,
    }
  } catch {
    return null
  }
}
