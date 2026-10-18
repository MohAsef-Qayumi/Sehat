"use client"

import { locales, useI18n, type Locale } from "@/lib/i18n"

export function LanguageSelect({ className }: { className?: string }) {
  const { locale, setLocale, t } = useI18n()
  return (
    <select
      aria-label={t("language")}
      value={locale}
      onChange={(e) => setLocale(e.target.value as Locale)}
      className={`h-8 rounded-md border border-line bg-surface px-2 text-sm ${className ?? ""}`}
    >
      {Object.entries(locales).map(([code, { label }]) => (
        <option key={code} value={code}>
          {label}
        </option>
      ))}
    </select>
  )
}
