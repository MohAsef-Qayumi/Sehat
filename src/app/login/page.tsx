"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { cachedSession, cacheSession, postJson, type ClientSession } from "@/client/session"
import { LanguageSelect } from "@/components/language-select"
import { Button, Card, ErrorText, Field, Input } from "@/components/ui"
import { useI18n } from "@/lib/i18n"

export default function LoginPage() {
  const { t } = useI18n()
  const router = useRouter()
  const [mode, setMode] = useState<"login" | "register">("login")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (cachedSession()) router.replace("/queue")
  }, [router])

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = Object.fromEntries(new FormData(e.currentTarget))
    setBusy(true)
    setError("")
    try {
      const session = await postJson<ClientSession>(mode === "login" ? "/api/auth/login" : "/api/clinics", form)
      cacheSession(session)
      router.replace("/queue")
    } catch (err) {
      setError(navigator.onLine ? (err as Error).message : t("loginNeedsInternet"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5 py-12">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <p className="text-2xl font-semibold tracking-tight text-brand">{t("appName")}</p>
          <p className="mt-1 text-sm text-muted">{t("tagline")}</p>
        </div>
        <LanguageSelect />
      </div>

      <Card className="p-6">
        <h1 className="mb-1 text-lg font-semibold">{mode === "login" ? t("signIn") : t("registerClinic")}</h1>
        {mode === "register" && <p className="mb-4 text-sm text-muted">{t("registerClinicHint")}</p>}

        <form onSubmit={submit} className="mt-4 space-y-4" key={mode}>
          {mode === "register" && (
            <>
              <Field label={t("clinicName")}>
                <Input name="clinicName" required minLength={2} />
              </Field>
              <Field label={t("yourName")}>
                <Input name="name" required minLength={2} autoComplete="name" />
              </Field>
            </>
          )}
          <Field label={t("username")}>
            <Input name="username" required autoComplete="username" autoCapitalize="none" spellCheck={false} />
          </Field>
          <Field label={t("password")} hint={mode === "register" ? t("minPassword") : undefined}>
            <Input
              name="password"
              type="password"
              required
              minLength={mode === "register" ? 8 : undefined}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </Field>
          <ErrorText>{error}</ErrorText>
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? t("signingIn") : mode === "login" ? t("signIn") : t("createClinic")}
          </Button>
        </form>
      </Card>

      <p className="mt-4 text-center text-sm text-muted">
        {mode === "login" ? t("newHere") : t("haveAccount")}{" "}
        <button type="button" className="font-medium text-brand hover:underline" onClick={() => setMode(mode === "login" ? "register" : "login")}>
          {mode === "login" ? t("registerClinic") : t("signIn")}
        </button>
      </p>
      {mode === "login" && <p className="mt-6 text-center text-xs text-muted">{t("demoHint")}</p>}
    </main>
  )
}
