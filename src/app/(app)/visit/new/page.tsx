"use client"

import { useParams, useRouter } from "next/navigation"
import { useApp } from "@/client/app-context"
import { today, usePatient, useQueue } from "@/client/hooks"
import { Empty, PageHeader } from "@/components/ui"
import { VisitForm } from "@/components/visit-form"
import { useI18n } from "@/lib/i18n"

export default function NewVisitPage() {
  const { id } = useParams<{ id: string }>()
  const { t } = useI18n()
  const { create, write, session } = useApp()
  const router = useRouter()
  const patient = usePatient(id)
  const queue = useQueue(today())

  if (patient === undefined) return null
  if (patient === null) return <Empty title={t("patientNotFound")} />

  return (
    <>
      <PageHeader title={`${t("newVisit")} — ${patient.fullName}`} />
      {patient.allergies && (
        <p role="alert" className="mb-4 rounded-md border border-danger/30 bg-danger/5 px-4 py-3 text-sm font-medium text-danger">
          {t("allergyWarning", { allergies: patient.allergies })}
        </p>
      )}
      <VisitForm
        initial={{
          patientId: id,
          date: today(),
          complaint: "",
          bloodPressure: "",
          pulse: null,
          temperature: null,
          weight: null,
          diagnosis: "",
          notes: "",
          prescription: [],
          doctorName: session.role === "doctor" ? session.name : "",
          deleted: false,
        }}
        onCancel={() => router.back()}
        onSubmit={async (visit) => {
          await create("visits", visit)
          // Seeing the patient completes their place in today's queue.
          const entry = queue?.find((q) => q.patientId === id && q.status !== "done" && q.status !== "left")
          if (entry) await write("queue", entry.id, { status: "done" })
          router.replace(`/patients/${id}`)
        }}
      />
    </>
  )
}
