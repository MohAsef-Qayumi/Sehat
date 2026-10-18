"use client"

import { useLiveQuery } from "dexie-react-hooks"
import type { Patient, QueueEntry, Visit } from "@/lib/domain"
import { compareHlc } from "@/lib/sync/hlc"
import { useApp } from "./app-context"

export type WithId<T> = Partial<T> & { id: string }

const flatten = <T>(r: { id: string; data: Partial<T> }): WithId<T> => ({ ...r.data, id: r.id })

/** Local calendar day, which is what a clinic means by "today". */
export function today(date = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function usePatients(search: string) {
  const { store } = useApp()
  return useLiveQuery(async () => {
    const term = search.trim().toLowerCase()
    const digits = term.replace(/\D/g, "")
    const rows = await store.db.patients.toArray()
    return rows
      .map(flatten<Patient>)
      .filter((p) => !p.deleted)
      .filter(
        (p) =>
          !term ||
          p.fullName?.toLowerCase().includes(term) ||
          p.fatherName?.toLowerCase().includes(term) ||
          (digits.length > 2 && p.phone?.replace(/\D/g, "").includes(digits)),
      )
      .sort((a, b) => (a.fullName ?? "").localeCompare(b.fullName ?? ""))
  }, [store, search])
}

export function usePatient(id: string) {
  const { store } = useApp()
  // `null` = loaded but missing; `undefined` = still loading.
  return useLiveQuery(async () => {
    const row = await store.db.patients.get(id)
    return row && !row.data.deleted ? flatten<Patient>(row) : null
  }, [store, id])
}

export function useVisits(patientId: string) {
  const { store } = useApp()
  return useLiveQuery(async () => {
    const rows = await store.db.visits.where("data.patientId").equals(patientId).toArray()
    return rows
      .map(flatten<Visit>)
      .filter((v) => !v.deleted)
      .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
  }, [store, patientId])
}

export function useVisit(id: string) {
  const { store } = useApp()
  return useLiveQuery(async () => {
    const row = await store.db.visits.get(id)
    return row && !row.data.deleted ? flatten<Visit>(row) : null
  }, [store, id])
}

export type QueueRow = WithId<QueueEntry> & { number: number; patient?: WithId<Patient> }

/** Queue numbers follow check-in order, so every device shows the same numbering. */
export function useQueue(day: string) {
  const { store } = useApp()
  return useLiveQuery(async () => {
    const rows = (await store.db.queue.where("data.day").equals(day).toArray())
      .map(flatten<QueueEntry>)
      .filter((q) => !q.deleted && q.checkedInAt)
      .sort((a, b) => compareHlc(a.checkedInAt!, b.checkedInAt!))

    const patients = await store.db.patients.bulkGet(rows.map((r) => r.patientId!))
    return rows.map<QueueRow>((row, i) => {
      const p = patients[i]
      return { ...row, number: i + 1, patient: p ? flatten<Patient>(p) : undefined }
    })
  }, [store, day])
}

export function ageFrom(birthYear: number | null | undefined) {
  return birthYear ? new Date().getFullYear() - birthYear : null
}
