import { z } from "zod"
import { isHlc } from "./sync/hlc"

const text = (max: number) => z.string().trim().max(max)
const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
const nullableNumber = (min: number, max: number) => z.number().min(min).max(max).nullable()

export const medication = z.object({
  drug: text(120).min(1),
  dose: text(60),
  frequency: text(60),
  duration: text(60),
})

/**
 * Field schemas per synced collection. Each field is validated on its own,
 * because a sync change may carry only the fields that were edited.
 */
export const collections = {
  patients: z.object({
    fullName: text(120).min(1),
    fatherName: text(120),
    sex: z.enum(["male", "female", "other"]),
    birthYear: z.number().int().min(1900).max(2100).nullable(),
    phone: text(30),
    address: text(300),
    allergies: text(500),
    notes: text(2000),
    deleted: z.boolean(),
  }),
  visits: z.object({
    patientId: z.uuid(),
    date: isoDay,
    complaint: text(1000),
    bloodPressure: text(15),
    pulse: nullableNumber(0, 300),
    temperature: nullableNumber(25, 45),
    weight: nullableNumber(0, 400),
    diagnosis: text(1000),
    notes: text(2000),
    prescription: z.array(medication).max(30),
    doctorName: text(120),
    deleted: z.boolean(),
  }),
  queue: z.object({
    patientId: z.uuid(),
    day: isoDay,
    checkedInAt: z.string().refine(isHlc, "Expected an HLC timestamp"),
    status: z.enum(["waiting", "with-doctor", "done", "left"]),
    deleted: z.boolean(),
  }),
} as const

export type CollectionName = keyof typeof collections
export const collectionNames = Object.keys(collections) as CollectionName[]

export type Patient = z.infer<(typeof collections)["patients"]>
export type Visit = z.infer<(typeof collections)["visits"]>
export type QueueEntry = z.infer<(typeof collections)["queue"]>
export type Medication = z.infer<typeof medication>
export type QueueStatus = QueueEntry["status"]

export type CollectionData = {
  patients: Patient
  visits: Visit
  queue: QueueEntry
}

export const roles = ["admin", "doctor", "reception"] as const
export type Role = (typeof roles)[number]
