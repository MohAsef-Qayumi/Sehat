"use client"

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from "react"
import { en, type MessageKey, type Messages } from "./en"
import { fa } from "./fa"
import { ps } from "./ps"

export const locales = {
  en: { label: "English", dir: "ltr", messages: en },
  fa: { label: "دری", dir: "rtl", messages: fa },
  ps: { label: "پښتو", dir: "rtl", messages: ps },
} as const satisfies Record<string, { label: string; dir: "ltr" | "rtl"; messages: Messages }>

export type Locale = keyof typeof locales

const STORAGE_KEY = "sehat.locale"
const listeners = new Set<() => void>()

function readLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && saved in locales) return saved as Locale
  } catch {
    // Ignore unavailable storage.
  }
  return "en"
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function setLocale(next: Locale) {
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // Ignore unavailable storage.
  }
  for (const listener of listeners) listener()
}

type I18n = {
  locale: Locale
  dir: "ltr" | "rtl"
  setLocale: (locale: Locale) => void
  t: (key: MessageKey, vars?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18n | null>(null)

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const locale = useSyncExternalStore(subscribe, readLocale, () => "en" as Locale)

  useEffect(() => {
    document.documentElement.lang = locale
    document.documentElement.dir = locales[locale].dir
  }, [locale])

  const value = useMemo<I18n>(() => {
    const messages: Messages = locales[locale].messages
    return {
      locale,
      dir: locales[locale].dir,
      setLocale,
      t: (key, vars) => {
        let text: string = messages[key] ?? en[key]
        if (vars) for (const [name, v] of Object.entries(vars)) text = text.replaceAll(`{${name}}`, String(v))
        return text
      },
    }
  }, [locale])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>")
  return ctx
}
