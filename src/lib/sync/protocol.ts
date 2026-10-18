import { z } from "zod"
import { collections, collectionNames, type CollectionName } from "../domain"
import { isHlc } from "./hlc"

export const MAX_PUSH = 500
export const PULL_PAGE = 500

export const changeSchema = z
  .object({
    collection: z.enum(collectionNames as [CollectionName, ...CollectionName[]]),
    id: z.uuid(),
    data: z.record(z.string(), z.unknown()),
    clocks: z.record(z.string(), z.string().refine(isHlc, "Invalid clock")),
  })
  .superRefine((change, ctx) => {
    const shape = collections[change.collection].shape as Record<string, z.ZodType>
    for (const field of Object.keys(change.clocks)) {
      const fieldSchema = shape[field]
      if (!fieldSchema) {
        ctx.addIssue({ code: "custom", path: ["clocks", field], message: "Unknown field" })
        continue
      }
      const result = fieldSchema.safeParse(change.data[field])
      if (!result.success) {
        ctx.addIssue({ code: "custom", path: ["data", field], message: result.error.issues[0]?.message ?? "Invalid" })
      }
    }
    for (const field of Object.keys(change.data)) {
      if (!(field in change.clocks)) {
        ctx.addIssue({ code: "custom", path: ["data", field], message: "Field has no clock" })
      }
    }
  })

/**
 * Changes are validated one by one (see the sync service) rather than as a
 * batch, so a single bad record can't block the rest of a device's outbox.
 */
export const syncRequestSchema = z.object({
  since: z.number().int().min(0),
  changes: z.array(z.unknown()).max(MAX_PUSH),
})

export type Change = z.infer<typeof changeSchema>
export type SyncRequest = { since: number; changes: Change[] }

export type Rejection = { collection: string; id: string; reason: string }

export type SyncResponse = {
  changes: Change[]
  rejected: Rejection[]
  cursor: number
  hasMore: boolean
  serverTime: number
}
