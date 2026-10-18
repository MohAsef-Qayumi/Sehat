"use client"

import { useState } from "react"
import { Plus, X } from "lucide-react"
import type { Medication, Visit } from "@/lib/domain"
import { useI18n } from "@/lib/i18n"
import { Button, Card, Field, Input, Textarea } from "./ui"

const blankMedication: Medication = { drug: "", dose: "", frequency: "", duration: "" }

export function VisitForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial: Visit
  onSubmit: (visit: Visit) => Promise<void>
  onCancel: () => void
}) {
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)
  const [meds, setMeds] = useState<Medication[]>(initial.prescription.length ? initial.prescription : [blankMedication])

  const updateMed = (index: number, field: keyof Medication, value: string) =>
    setMeds((list) => list.map((m, i) => (i === index ? { ...m, [field]: value } : m)))

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const text = (key: string) => String(f.get(key) ?? "").trim()
    const num = (key: string) => (text(key) === "" ? null : Number(text(key)))
    setBusy(true)
    try {
      await onSubmit({
        ...initial,
        date: text("date"),
        complaint: text("complaint"),
        bloodPressure: text("bloodPressure"),
        pulse: num("pulse"),
        temperature: num("temperature"),
        weight: num("weight"),
        diagnosis: text("diagnosis"),
        notes: text("notes"),
        prescription: meds
          .map((m) => ({ drug: m.drug.trim(), dose: m.dose.trim(), frequency: m.frequency.trim(), duration: m.duration.trim() }))
          .filter((m) => m.drug),
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <Card className="grid gap-4 p-5 sm:grid-cols-[180px_1fr]">
        <Field label={t("date")}>
          <Input name="date" type="date" required defaultValue={initial.date} />
        </Field>
        <Field label={t("complaint")}>
          <Input name="complaint" maxLength={1000} defaultValue={initial.complaint} autoFocus />
        </Field>
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold">{t("vitals")}</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label={t("bloodPressure")}>
            <Input name="bloodPressure" placeholder="120/80" maxLength={15} defaultValue={initial.bloodPressure} dir="ltr" />
          </Field>
          <Field label={t("pulse")}>
            <Input name="pulse" type="number" min={0} max={300} defaultValue={initial.pulse ?? ""} />
          </Field>
          <Field label={t("temperature")}>
            <Input name="temperature" type="number" step="0.1" min={25} max={45} defaultValue={initial.temperature ?? ""} />
          </Field>
          <Field label={t("weight")}>
            <Input name="weight" type="number" step="0.1" min={0} max={400} defaultValue={initial.weight ?? ""} />
          </Field>
        </div>
      </Card>

      <Card className="space-y-4 p-5">
        <Field label={t("diagnosis")}>
          <Input name="diagnosis" maxLength={1000} defaultValue={initial.diagnosis} />
        </Field>
        <Field label={t("notes")}>
          <Textarea name="notes" maxLength={2000} defaultValue={initial.notes} />
        </Field>
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold">{t("prescription")}</h2>
        <div className="space-y-3">
          {meds.map((m, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 sm:grid-cols-[2fr_1fr_1fr_1fr_auto]">
              <Input aria-label={t("drug")} placeholder={t("drug")} value={m.drug} onChange={(e) => updateMed(i, "drug", e.target.value)} className="col-span-2 sm:col-span-1" />
              <Input aria-label={t("dose")} placeholder={t("dose")} value={m.dose} onChange={(e) => updateMed(i, "dose", e.target.value)} />
              <Input aria-label={t("frequency")} placeholder={t("frequency")} value={m.frequency} onChange={(e) => updateMed(i, "frequency", e.target.value)} />
              <Input aria-label={t("duration")} placeholder={t("duration")} value={m.duration} onChange={(e) => updateMed(i, "duration", e.target.value)} />
              <Button type="button" variant="ghost" aria-label={t("remove")} onClick={() => setMeds((list) => list.filter((_, j) => j !== i))}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
        <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={() => setMeds((list) => [...list, blankMedication])}>
          <Plus className="h-4 w-4" /> {t("addMedication")}
        </Button>
      </Card>

      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? t("saving") : t("saveVisit")}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  )
}
