"use client"

import { useParams, useRouter } from "next/navigation"
import { useApp } from "@/client/app-context"
import { usePatient } from "@/client/hooks"
import { emptyPatient, PatientForm } from "@/components/patient-form"
import { Card, Empty, PageHeader } from "@/components/ui"
import { useI18n } from "@/lib/i18n"

export default function EditPatientPage() {
  const { id } = useParams<{ id: string }>()
  const { write } = useApp()
  const { t } = useI18n()
  const router = useRouter()
  const patient = usePatient(id)

  if (patient === undefined) return null
  if (patient === null) return <Empty title={t("patientNotFound")} />

  return (
    <>
      <PageHeader title={patient.fullName ?? ""} />
      <Card className="p-6">
        <PatientForm
          initial={{ ...emptyPatient, ...patient }}
          submitLabel={t("save")}
          onCancel={() => router.back()}
          onSubmit={async ({ deleted, ...fields }) => {
            // Only changed fields get new timestamps, so concurrent edits elsewhere survive.
            await write("patients", id, fields)
            router.replace(`/patients/${id}`)
          }}
        />
      </Card>
    </>
  )
}
