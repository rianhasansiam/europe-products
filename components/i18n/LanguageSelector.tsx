"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, Globe, Loader2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { replaceLocaleHref } from "@/lib/i18n/paths";
import type { LocaleDefinition } from "@/lib/i18n/registry";
import { useLanguageSwitch } from "./useLanguageSwitch";

export type SelectableLanguage = Pick<LocaleDefinition, "code" | "englishName" | "nativeName" | "direction">;

export default function LanguageSelector({ languages, mobile = false }: { languages: SelectableLanguage[]; mobile?: boolean }) {
  const locale = useLocale();
  const t = useTranslations("Language");
  const [search, setSearch] = useState("");
  const { busy, error, switchLanguage } = useLanguageSwitch();
  const selected = languages.find((language) => language.code === locale);
  const matches = languages.filter((language) => `${language.nativeName} ${language.englishName} ${language.code}`.toLocaleLowerCase(locale).includes(search.toLocaleLowerCase(locale)));

  return <div className={mobile ? "w-full" : "hidden xl:block"}>
    <DropdownMenu dir={selected?.direction ?? "ltr"} onOpenChange={() => setSearch("")}>
      <DropdownMenuTrigger asChild>
        <button type="button" disabled={busy} aria-label={`${t("choose")}: ${selected?.englishName ?? "English"}`} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-brand-black hover:bg-brand-light-bg focus-visible:outline-2 focus-visible:outline-brand-red disabled:opacity-60">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4 shrink-0" />}
          <span lang={selected?.code}>{selected?.nativeName ?? "English"}</span>
          {mobile && <span className="ms-auto text-xs text-brand-text-muted">{selected?.englishName}</span>}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="z-80 w-72 max-w-[calc(100vw-2rem)]" aria-label={t("choose")}>
        {languages.length > 8 && <div className="p-2"><input autoFocus type="search" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (!["ArrowDown", "ArrowUp", "Escape", "Tab"].includes(event.key)) event.stopPropagation(); }} aria-label={t("search")} placeholder={t("search")} className="w-full rounded-lg border border-brand-border px-3 py-2 text-sm outline-brand-red" /></div>}
        <div className="max-h-72 overflow-y-auto">
          {matches.map((language) => <DropdownMenuItem key={language.code} asChild disabled={busy} onSelect={(event) => { event.preventDefault(); void switchLanguage(language.code); }}>
            <a href={replaceLocaleHref(typeof window === "undefined" ? "/" : window.location.pathname + window.location.search + window.location.hash, language.code)} hrefLang={language.code} aria-current={language.code === locale ? "true" : undefined} className="flex items-center gap-3">
              <span className="min-w-0 flex-1"><span lang={language.code} dir={language.direction} className="block font-semibold">{language.nativeName}</span><span className="block text-xs text-brand-text-muted">{language.englishName}</span></span>
              {language.code === locale && <Check className="h-4 w-4 shrink-0 text-brand-red" aria-label={t("selected")} />}
            </a>
          </DropdownMenuItem>)}
          {!matches.length && <p className="px-3 py-2 text-sm">{t("noResults")}</p>}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
    <span role="status" aria-live="polite" className={error ? "block px-3 text-xs text-red-600" : "sr-only"}>{error || (busy ? t("saving") : "")}</span>
  </div>;
}
