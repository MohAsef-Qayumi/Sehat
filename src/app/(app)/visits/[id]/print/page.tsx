"use client"

import { useParams, useRouter } from "next/navigation"
import { useApp } from "@/client/app-context"
import { ageFrom, usePatient, useVisit } from "@/client/hooks"
import { Button, Empty } from "@/components/ui"
import { useI18n } from "@/lib/i18n"

export default function PrintVisitPage() {
  const { id } = useParams<{ id: string }>()
  const { t } = useI18n()
  const { session } = useApp()
  const router = useRouter()
  const visit = useVisit(id)
  const patient = usePatient(visit?.patientId ?? "")

  if (visit === undefined) return null
  if (visit === null) return <Empty title={t("visitNotFound")} />
  const age = ageFrom(patient?.birthYear)

  return (
    <>
      <div className="no-print mb-6 flex gap-2">
        <Button onClick={() => window.print()}>{t("printPrescription")}</Button>
        <Button variant="secondary" onClick={() => router.back()}>
          {t("cancel")}
        </Button>
      </div>

      <article className="mx-auto max-w-2xl bg-white p-10 shadow-sm print:p-0 print:shadow-none">
        <header className="flex items-start justify-between border-b-2 border-fg pb-4">
          <div>
            <h1 className="text-xl font-bold">{session.clinicName}</h1>
            {visit.doctorName && <p className="text-sm">{visit.doctorName}</p>}
          </div>
          <p className="text-sm">{visit.date}</p>
        </header>

        <section className="grid grid-cols-3 gap-4 border-b border-line py-4 text-sm">
          <div className="col-span-2">
            <p className="text-xs text-muted">{t("fullName")}</p>
            <p className="font-medium">
              {patient?.fullName}
              {patient?.fatherName && ` (${patient.fatherName})`}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted">{t("age")}</p>
            <p className="font-medium">{age ?? "—"}</p>
          </div>
          {visit.diagnosis && (
            <div className="col-span-3">
              <p className="text-xs text-muted">{t("diagnosis")}</p>
              <p className="font-medium">{visit.diagnosis}</p>
            </div>
          )}
          {patient?.allergies && (
            <div className="col-span-3 font-medium text-danger">{t("allergyWarning", { allergies: patient.allergies })}</div>
          )}
        </section>

        <section className="py-6">
          <p className="mb-4 font-serif text-3xl font-bold">℞</p>
          <ol className="space-y-4">
            {visit.prescription?.map((m, i) => (
              <li key={i} className="flex gap-3">
                <span className="text-muted">{i + 1}.</span>
                <div>
                  <p className="font-semibold">{m.drug}</p>
                  <p className="text-sm">{[m.dose, m.frequency, m.duration].filter(Boolean).join(" — ")}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {visit.notes && <p className="border-t border-line pt-4 text-sm whitespace-pre-wrap">{visit.notes}</p>}
        <footer className="mt-16 flex justify-end">
          <div className="w-48 border-t border-fg pt-1 text-center text-xs">{t("doctor")}</div>
        </footer>
      </article>
    </>
  )
}
