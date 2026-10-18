"use client"

import { useRouter } from "next/navigation"
import { useApp } from "@/client/app-context"
import { emptyPatient, PatientForm } from "@/components/patient-form"
import { Card, PageHeader } from "@/components/ui"
import { useI18n } from "@/lib/i18n"

export default function NewPatientPage() {
  const { create } = useApp()
  const { t } = useI18n()
  const router = useRouter()

  return (
    <>
      <PageHeader title={t("newPatient")} />
      <Card className="p-6">
        <PatientForm
          initial={emptyPatient}
          submitLabel={t("save")}
          onCancel={() => router.back()}
          onSubmit={async (patient) => {
            const id = await create("patients", patient)
            router.replace(`/patient?id=${id}`)
          }}
        />
      </Card>
    </>
  )
}
