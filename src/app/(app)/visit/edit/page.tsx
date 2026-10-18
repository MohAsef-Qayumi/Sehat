"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useApp } from "@/client/app-context"
import { usePatient, useVisit } from "@/client/hooks"
import { Empty, PageHeader } from "@/components/ui"
import { VisitForm } from "@/components/visit-form"
import type { Visit } from "@/lib/domain"
import { useI18n } from "@/lib/i18n"

export default function EditVisitPage() {
  const id = useSearchParams().get("id") ?? ""
  const { t } = useI18n()
  const { write } = useApp()
  const router = useRouter()
  const visit = useVisit(id)
  const patient = usePatient(visit?.patientId ?? "")

  if (visit === undefined) return null
  if (visit === null) return <Empty title={t("visitNotFound")} />

  return (
    <>
      <PageHeader title={`${visit.date} — ${patient?.fullName ?? ""}`} />
      <VisitForm
        initial={{ prescription: [], ...visit } as Visit}
        onCancel={() => router.back()}
        onSubmit={async ({ deleted, ...fields }) => {
          await write("visits", id, fields)
          router.replace(`/patient?id=${visit.patientId}`)
        }}
      />
    </>
  )
}
