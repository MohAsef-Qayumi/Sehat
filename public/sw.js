/* Sehat service worker: makes the app shell available offline.
 *
 * - Hashed build assets (/_next/static) are immutable: cache-first.
 * - Pages: network-first so updates arrive when online, cached copy offline.
 * - API calls are never cached; offline data lives in IndexedDB.
 */
const CACHE = "sehat-v1"
const PAGES = [
  "/queue",
  "/patients",
  "/patients/new",
  "/patient",
  "/patient/edit",
  "/visit/new",
  "/visit/edit",
  "/visit/print",
  "/staff",
  "/login",
]

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE)
      const assets = new Set()
      for (const page of PAGES) {
        const res = await fetch(page, { credentials: "same-origin" })
        if (!res.ok) continue
        const html = await res.clone().text()
        await cache.put(page, res)
        for (const match of html.matchAll(/\/_next\/static\/[^"'\s)\\]+/g)) assets.add(match[0])
      }
      await Promise.all([...assets].map((url) => cache.add(url).catch(() => undefined)))
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key)
      await self.clients.claim()
    })(),
  )
})

self.addEventListener("fetch", (event) => {
  const { request } = event
  const url = new URL(request.url)
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request))
  } else if (request.mode === "navigate") {
    event.respondWith(page(request, url))
  }
  // Router data requests fall through: when they fail offline, Next.js
  // falls back to a full navigation, which the handler above serves.
})

async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  const res = await fetch(request)
  if (res.ok) (await caches.open(CACHE)).put(request, res.clone())
  return res
}

async function page(request, url) {
  try {
    const res = await fetch(request)
    if (res.ok && !res.redirected) (await caches.open(CACHE)).put(url.pathname, res.clone())
    return res
  } catch {
    // Pages read their ids from the query string, so the path alone identifies the cached shell.
    return (await caches.match(url.pathname)) ?? (await caches.match("/queue")) ?? Response.error()
  }
}
