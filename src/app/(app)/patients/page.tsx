"use client"

import Link from "next/link"
import { useState } from "react"
import { ageFrom, usePatients } from "@/client/hooks"
import { Badge, Button, Card, Empty, Input, PageHeader } from "@/components/ui"
import { useI18n } from "@/lib/i18n"

export default function PatientsPage() {
  const { t } = useI18n()
  const [search, setSearch] = useState("")
  const patients = usePatients(search)

  return (
    <>
      <PageHeader
        title={t("patients")}
        actions={
          <Link href="/patients/new">
            <Button>{t("newPatient")}</Button>
          </Link>
        }
      />
      <Input
        type="search"
        placeholder={t("searchPatients")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4"
        autoFocus
      />

      {patients === undefined ? null : patients.length === 0 ? (
        <Empty title={search ? t("noMatches") : t("noPatients")} />
      ) : (
        <Card className="divide-y divide-line">
          {patients.map((p) => {
            const age = ageFrom(p.birthYear)
            return (
              <Link key={p.id} href={`/patient?id=${p.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-bg">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.fullName}</p>
                  <p className="truncate text-sm text-muted">
                    {[p.fatherName, age !== null && t("ageYears", { age }), p.sex && t(p.sex)].filter(Boolean).join(" · ")}
                  </p>
                </div>
                {p.allergies && <Badge tone="danger">{t("allergies")}</Badge>}
                <span className="text-sm text-muted" dir="ltr">
                  {p.phone}
                </span>
              </Link>
            )
          })}
        </Card>
      )}
    </>
  )
}
