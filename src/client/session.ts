import type { Role } from "@/lib/domain"

export type ClientSession = {
  userId: string
  clinicId: string
  clinicName: string
  name: string
  role: Role
}

const KEY = "sehat.session"
const listeners = new Set<() => void>()
let snapshot: { raw: string | null; value: ClientSession | null } = { raw: null, value: null }

/**
 * The session is mirrored in localStorage so the app can open without a
 * network round trip. The httpOnly cookie remains the source of truth for
 * the server; this copy only decides what to render.
 */
export function cachedSession(): ClientSession | null {
  try {
    const raw = localStorage.getItem(KEY)
    // Return a stable object for unchanged storage so React doesn't re-render.
    if (raw !== snapshot.raw) snapshot = { raw, value: raw ? (JSON.parse(raw) as ClientSession) : null }
    return snapshot.value
  } catch {
    return null
  }
}

/** For useSyncExternalStore: re-render when the session changes in this or another tab. */
export function subscribeSession(listener: () => void) {
  listeners.add(listener)
  window.addEventListener("storage", listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", listener)
  }
}

export function cacheSession(session: ClientSession | null) {
  try {
    if (session) localStorage.setItem(KEY, JSON.stringify(session))
    else localStorage.removeItem(KEY)
  } catch {
    // Storage may be unavailable (private mode); the app still works for this tab.
  }
  for (const listener of listeners) listener()
}

export async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`)
  return data as T
}
