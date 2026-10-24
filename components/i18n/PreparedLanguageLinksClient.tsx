"use client";

import { useSyncExternalStore, type MouseEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { replaceLocaleHref } from "@/lib/i18n/paths";
import type { LocaleDefinition } from "@/lib/i18n/registry";
import { useLanguageSwitch } from "./useLanguageSwitch";

type Language = Pick<LocaleDefinition, "code" | "englishName" | "nativeName" | "direction">;

function subscribeToLocation(changed: () => void) {
  window.addEventListener("popstate", changed);
  window.addEventListener("hashchange", changed);
  return () => { window.removeEventListener("popstate", changed); window.removeEventListener("hashchange", changed); };
}

export function usesNativeLanguageLink(event: Pick<MouseEvent<HTMLAnchorElement>, "button" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey" | "defaultPrevented">): boolean {
  return event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

/** Real SSR anchors remain crawlable; ordinary clicks preserve and save the choice. */
export default function PreparedLanguageLinksClient({ pathname, languages }: { pathname: string; languages: Language[] }) {
  const locale = useLocale();
  const t = useTranslations("Language");
  const { busy, error, switchLanguage } = useLanguageSwitch();
  const href = useSyncExternalStore(subscribeToLocation,
    () => window.location.pathname + window.location.search + window.location.hash,
    () => pathname);

  return <nav aria-label={t("choose")} className="rounded-2xl border border-brand-border bg-white p-4 sm:p-5">
    <p className="mb-3 text-sm font-bold text-brand-black">{t("choose")}</p>
    <ul className="flex flex-wrap gap-2">
      {languages.map((language) => <li key={language.code}>
        <a href={replaceLocaleHref(href, language.code)} hrefLang={language.code}
          aria-current={language.code === locale ? "page" : undefined} aria-disabled={busy || undefined}
          onClick={(event) => {
            if (usesNativeLanguageLink(event)) return;
            event.preventDefault();
            void switchLanguage(language.code);
          }}
          className={`inline-flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-brand-red ${language.code === locale ? "border-brand-red bg-brand-light-bg font-bold text-brand-red" : "border-brand-border text-brand-black hover:bg-brand-light-bg"} ${busy ? "opacity-60" : ""}`}>
          <span lang={language.code} dir={language.direction}>{language.nativeName}</span>
          {language.nativeName !== language.englishName && <span lang="en" className="text-xs text-brand-text-muted">{language.englishName}</span>}
        </a>
      </li>)}
    </ul>
    <span role="status" aria-live="polite" className={error ? "mt-2 block text-xs text-red-600" : "sr-only"}>{error || (busy ? t("saving") : "")}</span>
  </nav>;
}
