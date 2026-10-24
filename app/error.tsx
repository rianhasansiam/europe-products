"use client";

import { useTranslations } from "next-intl";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("States");
  return <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
    <h1 className="text-3xl font-bold">{t("errorTitle")}</h1>
    <p className="text-brand-text-muted">{t("errorDescription")}</p>
    <button type="button" onClick={reset} className="rounded-xl bg-brand-red px-5 py-3 font-semibold text-white">{t("retry")}</button>
  </main>;
}
