"use client"

import { useState } from "react"
import type { Patient } from "@/lib/domain"
import { useI18n } from "@/lib/i18n"
import { Button, Field, Input, Select, Textarea } from "./ui"

export const emptyPatient: Patient = {
  fullName: "",
  fatherName: "",
  sex: "female",
  birthYear: null,
  phone: "",
  address: "",
  allergies: "",
  notes: "",
  deleted: false,
}

export function PatientForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: Patient
  submitLabel: string
  onSubmit: (patient: Patient) => Promise<void>
  onCancel: () => void
}) {
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)
  const thisYear = new Date().getFullYear()

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const value = (key: string) => String(f.get(key) ?? "").trim()
    const year = value("birthYear")
    setBusy(true)
    try {
      // Built field by field so nothing outside the schema (like the record id) leaks into the data.
      await onSubmit({
        fullName: value("fullName"),
        fatherName: value("fatherName"),
        sex: value("sex") as Patient["sex"],
        birthYear: year ? Number(year) : null,
        phone: value("phone"),
        address: value("address"),
        allergies: value("allergies"),
        notes: value("notes"),
        deleted: initial.deleted,
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <Field label={t("fullName")}>
        <Input name="fullName" required maxLength={120} defaultValue={initial.fullName} autoFocus />
      </Field>
      <Field label={t("fatherName")}>
        <Input name="fatherName" maxLength={120} defaultValue={initial.fatherName} />
      </Field>
      <Field label={t("sex")}>
        <Select name="sex" defaultValue={initial.sex}>
          <option value="female">{t("female")}</option>
          <option value="male">{t("male")}</option>
          <option value="other">{t("other")}</option>
        </Select>
      </Field>
      <Field label={t("birthYear")}>
        <Input name="birthYear" type="number" inputMode="numeric" min={1900} max={thisYear} defaultValue={initial.birthYear ?? ""} />
      </Field>
      <Field label={t("phone")}>
        <Input name="phone" type="tel" maxLength={30} defaultValue={initial.phone} dir="ltr" />
      </Field>
      <Field label={t("address")}>
        <Input name="address" maxLength={300} defaultValue={initial.address} />
      </Field>
      <Field label={t("allergies")} className="sm:col-span-2">
        <Input name="allergies" maxLength={500} defaultValue={initial.allergies} />
      </Field>
      <Field label={t("notes")} className="sm:col-span-2">
        <Textarea name="notes" maxLength={2000} defaultValue={initial.notes} />
      </Field>
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" disabled={busy}>
          {busy ? t("saving") : submitLabel}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  )
}
