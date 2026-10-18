"use client"

import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react"
import { useRouter } from "next/navigation"
import type { CollectionData, CollectionName } from "@/lib/domain"
import { databaseName, LocalDb } from "./db"
import { cachedSession, cacheSession, postJson, subscribeSession, type ClientSession } from "./session"
import { Store } from "./store"
import { SyncEngine, type SyncStatus } from "./sync-engine"

const SYNC_INTERVAL_MS = 15_000

type AppContextValue = {
  session: ClientSession
  store: Store
  status: SyncStatus
  syncNow: () => void
  write: <C extends CollectionName>(collection: C, id: string, patch: Partial<CollectionData[C]>) => Promise<void>
  create: <C extends CollectionName>(collection: C, data: CollectionData[C]) => Promise<string>
  logout: () => Promise<void>
}

const AppContext = createContext<AppContextValue | null>(null)

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error("useApp must be used inside <AppProvider>")
  return ctx
}

export function AppProvider({ children, fallback }: { children: React.ReactNode; fallback: React.ReactNode }) {
  const router = useRouter()
  const session = useSyncExternalStore(subscribeSession, cachedSession, () => null)
  const [local, setLocal] = useState<{ store: Store; engine: SyncEngine } | null>(null)
  const [status, setStatus] = useState<SyncStatus>({ state: "idle", lastSyncedAt: null, pending: 0 })

  // The cached session lets the app open offline; confirm it with the server when reachable.
  useEffect(() => {
    if (!cachedSession()) {
      router.replace("/login")
      return
    }
    fetch("/api/auth/me")
      .then((res) => {
        if (res.status === 401) cacheSession(null)
      })
      .catch(() => {
        // Offline: keep working with the cached session.
      })
  }, [router, session])

  const clinicId = session?.clinicId
  useEffect(() => {
    if (!clinicId) return
    let cancelled = false
    const db = new LocalDb(databaseName(clinicId))
    void Store.open(db).then((store) => {
      if (!cancelled) setLocal({ store, engine: new SyncEngine(store) })
    })
    return () => {
      cancelled = true
      db.close()
    }
  }, [clinicId])

  const engine = local?.engine
  useEffect(() => {
    if (!engine) return
    const unsubscribe = engine.subscribe(setStatus)
    const run = () => void engine.sync()
    run()
    const timer = setInterval(run, SYNC_INTERVAL_MS)
    window.addEventListener("online", run)
    window.addEventListener("offline", run)
    return () => {
      unsubscribe()
      clearInterval(timer)
      window.removeEventListener("online", run)
      window.removeEventListener("offline", run)
    }
  }, [engine])

  const value = useMemo<AppContextValue | null>(() => {
    if (!session || !local || local.store.db.name !== databaseName(session.clinicId)) return null
    const { store, engine } = local
    return {
      session,
      store,
      status,
      syncNow: () => void engine.sync(),
      write: async (collection, id, patch) => {
        await store.write(collection, id, patch)
        engine.syncSoon()
      },
      create: async (collection, data) => {
        const record = await store.create(collection, data)
        engine.syncSoon()
        return record.id
      },
      logout: async () => {
        // Push anything pending first so a shared device doesn't lose work.
        await engine.sync()
        await postJson("/api/auth/logout").catch(() => undefined)
        cacheSession(null)
        router.replace("/login")
      },
    }
  }, [session, local, status, router])

  if (!value) return <>{fallback}</>
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
