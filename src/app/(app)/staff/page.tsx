"use client"

import { useEffect, useState } from "react"
import { useApp } from "@/client/app-context"
import { postJson } from "@/client/session"
import { Badge, Button, Card, Empty, ErrorText, Field, Input, PageHeader, Select } from "@/components/ui"
import type { Role } from "@/lib/domain"
import { useI18n } from "@/lib/i18n"

type StaffMember = { id: string; name: string; username: string; role: Role }

const roleLabel = { admin: "roleAdmin", doctor: "roleDoctor", reception: "roleReception" } as const

export default function StaffPage() {
  const { t } = useI18n()
  const { session } = useApp()
  const [staff, setStaff] = useState<StaffMember[] | null>(null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetch("/api/staff")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then(setStaff)
      .catch(() => setError(t("staffNeedsInternet")))
  }, [t])

  if (session.role !== "admin") return <Empty title={t("staff")} />

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    setBusy(true)
    setError("")
    try {
      const member = await postJson<StaffMember>("/api/staff", Object.fromEntries(new FormData(form)))
      setStaff((list) => [...(list ?? []), member])
      form.reset()
    } catch (err) {
      setError(navigator.onLine ? (err as Error).message : t("staffNeedsInternet"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title={t("staff")} description={t("staffDescription")} />
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card className="h-fit divide-y divide-line">
          {staff?.map((m) => (
            <div key={m.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="font-medium">{m.name}</p>
                <p className="text-sm text-muted" dir="ltr">
                  @{m.username}
                </p>
              </div>
              <Badge tone={m.role === "admin" ? "brand" : "neutral"}>{t(roleLabel[m.role])}</Badge>
            </div>
          ))}
          {!staff && <p className="px-4 py-3 text-sm text-muted">{error || t("loading")}</p>}
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 font-semibold">{t("addStaff")}</h2>
          <form onSubmit={add} className="space-y-3">
            <Field label={t("fullName")}>
              <Input name="name" required minLength={2} />
            </Field>
            <Field label={t("username")}>
              <Input name="username" required pattern="[a-z0-9._\-]{3,40}" autoCapitalize="none" dir="ltr" />
            </Field>
            <Field label={t("password")} hint={t("minPassword")}>
              <Input name="password" type="password" required minLength={8} autoComplete="new-password" />
            </Field>
            <Field label={t("role")}>
              <Select name="role" defaultValue="reception">
                <option value="reception">{t("roleReception")}</option>
                <option value="doctor">{t("roleDoctor")}</option>
                <option value="admin">{t("roleAdmin")}</option>
              </Select>
            </Field>
            <ErrorText>{staff ? error : null}</ErrorText>
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? t("saving") : t("addStaff")}
            </Button>
          </form>
        </Card>
      </div>
    </>
  )
}
