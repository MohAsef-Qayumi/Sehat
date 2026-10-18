"use client"

import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useApp } from "@/client/app-context"
import { ageFrom, today, usePatient, useQueue, useVisits } from "@/client/hooks"
import { Badge, Button, Card, Empty, PageHeader } from "@/components/ui"
import { useI18n } from "@/lib/i18n"

export default function PatientPage() {
  const { id } = useParams<{ id: string }>()
  const { t } = useI18n()
  const { create, write, store } = useApp()
  const router = useRouter()
  const patient = usePatient(id)
  const visits = useVisits(id)
  const queue = useQueue(today())

  if (patient === undefined) return null
  if (patient === null)
    return (
      <Empty title={t("patientNotFound")}>
        <Link href="/patients" className="text-brand hover:underline">
          {t("backToPatients")}
        </Link>
      </Empty>
    )

  const age = ageFrom(patient.birthYear)
  const queued = queue?.find((q) => q.patientId === id && (q.status === "waiting" || q.status === "with-doctor"))

  async function addToQueue() {
    await create("queue", { patientId: id, day: today(), checkedInAt: store.clock.tick(), status: "waiting", deleted: false })
  }

  async function remove() {
    if (!confirm(t("confirmDeletePatient"))) return
    await write("patients", id, { deleted: true })
    router.replace("/patients")
  }

  return (
    <>
      <Link href="/patients" className="mb-4 inline-block text-sm text-muted hover:text-fg">
        ← {t("backToPatients")}
      </Link>
      <PageHeader
        title={patient.fullName ?? ""}
        description={[patient.fatherName, age !== null && t("ageYears", { age }), patient.sex && t(patient.sex)]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <>
            {queued ? (
              <Badge tone="brand">
                {t("inQueue")} #{queued.number}
              </Badge>
            ) : (
              <Button variant="secondary" onClick={() => void addToQueue()}>
                {t("addToQueue")}
              </Button>
            )}
            <Link href={`/patients/${id}/visits/new`}>
              <Button>{t("newVisit")}</Button>
            </Link>
          </>
        }
      />

      {patient.allergies && (
        <div role="alert" className="mb-6 rounded-md border border-danger/30 bg-danger/5 px-4 py-3 text-sm font-medium text-danger">
          {t("allergyWarning", { allergies: patient.allergies })}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        <Card className="h-fit p-5">
          <dl className="space-y-3 text-sm">
            {(
              [
                ["phone", patient.phone],
                ["address", patient.address],
                ["birthYear", patient.birthYear],
                ["notes", patient.notes],
              ] as const
            ).map(([key, value]) =>
              value ? (
                <div key={key}>
                  <dt className="text-xs text-muted">{t(key)}</dt>
                  <dd className="whitespace-pre-wrap" dir={key === "phone" ? "ltr" : undefined}>
                    {value}
                  </dd>
                </div>
              ) : null,
            )}
          </dl>
          <div className="mt-5 flex gap-2 border-t border-line pt-4">
            <Link href={`/patients/${id}/edit`}>
              <Button variant="secondary" size="sm">
                {t("edit")}
              </Button>
            </Link>
            <Button variant="danger" size="sm" onClick={() => void remove()}>
              {t("delete")}
            </Button>
          </div>
        </Card>

        <section>
          <h2 className="mb-3 font-semibold">{t("visits")}</h2>
          {visits?.length === 0 && <Empty title={t("noVisits")} />}
          <div className="space-y-3">
            {visits?.map((v) => (
              <Card key={v.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium">{v.diagnosis || v.complaint || "—"}</p>
                    <p className="text-sm text-muted">
                      {v.date}
                      {v.doctorName && ` · ${v.doctorName}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Link href={`/visits/${v.id}/edit`}>
                      <Button variant="ghost" size="sm">
                        {t("edit")}
                      </Button>
                    </Link>
                    <Link href={`/visits/${v.id}/print`}>
                      <Button variant="ghost" size="sm">
                        {t("print")}
                      </Button>
                    </Link>
                  </div>
                </div>
                {v.complaint && v.diagnosis && <p className="mt-2 text-sm text-muted">{v.complaint}</p>}
                {!!v.prescription?.length && (
                  <ul className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
                    {v.prescription.map((m, i) => (
                      <li key={i}>
                        <span className="font-medium">{m.drug}</span>{" "}
                        <span className="text-muted">{[m.dose, m.frequency, m.duration].filter(Boolean).join(" · ")}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            ))}
          </div>
        </section>
      </div>
    </>
  )
}
