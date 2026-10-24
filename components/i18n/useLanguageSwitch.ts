"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { confirm } from "@/lib/feedback";
import { discardPreparedDrafts, prepareLanguageDrafts, type DraftPreparation } from "@/lib/i18n/drafts";
import { replaceLocaleHref } from "@/lib/i18n/paths";

// Desktop, mobile and crawlable links share one explicit switch at a time.
let switchPending = false;

export function useLanguageSwitch() {
  const locale = useLocale();
  const t = useTranslations("Language");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const switchLanguage = async (code: string) => {
    if (switchPending) return;
    switchPending = true;
    let recovery: DraftPreparation | null = null;
    const release = () => { switchPending = false; setBusy(false); };
    try {
      recovery = code === locale ? null : prepareLanguageDrafts();
      if (recovery?.blocked) {
        discardPreparedDrafts(recovery);
        setError(t("waitForSubmission"));
        release();
        return;
      }
      if (recovery && (recovery.failed || recovery.unrecoverable)) {
        const proceed = await confirm({ title: t("draftTitle"), description: t("draftUnavailable"), confirmLabel: t("continue"), cancelLabel: t("stay"), variant: "warning" });
        if (!proceed) { discardPreparedDrafts(recovery); release(); return; }
      }
      setBusy(true);
      setError("");
      const response = await fetch("/api/language", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ locale: code }) });
      if (!response.ok) throw new Error("Preference rejected");
      if (code === locale) { release(); return; }
      // A fresh document renders the active catalog and HTML language together.
      window.location.assign(replaceLocaleHref(window.location.pathname + window.location.search + window.location.hash, code));
    } catch {
      if (recovery) discardPreparedDrafts(recovery);
      release();
      setError(t("saveFailed"));
    }
  };

  return { busy, error, switchLanguage };
}
