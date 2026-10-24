import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { DEFAULT_LOCALE, getLocaleDefinition, getPublishedLocales, LOCALE_HEADER, normalizeLocale, PATH_HEADER, URL_HEADER, type LocaleDefinition } from "./registry";
import { getPublishedLanguageOverrides } from "@/lib/translations/languages";
import { contentHash } from "@/lib/translations/validation";
import { loadBundledMessages, loadMessages } from "./catalogs";
import { replaceLocaleHref } from "./paths";
import { redirect } from "next/navigation";

/** Missing additive migration retains the complete bundled English catalog. */
export const getPublishedLanguages = cache(async (): Promise<LocaleDefinition[]> => {
  const bundled = new Map(getPublishedLocales().map((language) => [language.code, language]));
  let overrides;
  try { overrides = await getPublishedLanguageOverrides(); }
  catch { return [getLocaleDefinition(DEFAULT_LOCALE)]; }
  const sourceHash = overrides?.length ? contentHash(await loadBundledMessages(DEFAULT_LOCALE)) : null;
  for (const row of overrides ?? []) {
    const code = normalizeLocale(row.code);
    if (!code || code === DEFAULT_LOCALE) continue;
    if (bundled.has(code) && !row.publicationOverride) continue;
    if (!row.published || !row.prepared || !row.catalogReviewedAt || !row.hasInterfaceCatalog || row.interfaceSourceHash !== sourceHash) {
      bundled.delete(code);
      continue;
    }
    bundled.set(code, { ...getLocaleDefinition(code), ...row, code, direction: row.direction === "rtl" ? "rtl" : "ltr" });
  }
  return [...bundled.values()];
});

export const getRequestLocale = cache(async (): Promise<string> => {
  const requestHeaders = await headers();
  const requested = normalizeLocale(requestHeaders.get(LOCALE_HEADER));
  // Proxy supplies this from the URL, never from browser/device/location.
  const published = requested && (await getPublishedLanguages()).some((language) => language.code === requested);
  if (requested && requested !== DEFAULT_LOCALE && (!published || !Object.keys(await loadMessages(requested)).length)) {
    // Registry/catalog availability can change between Proxy and the render.
    // Redirect before HTML rather than serving English beneath another locale URL.
    redirect(replaceLocaleHref(requestHeaders.get(URL_HEADER) ?? requestHeaders.get(PATH_HEADER) ?? "/", DEFAULT_LOCALE));
  }
  return published ? requested : DEFAULT_LOCALE;
});

export async function getRequestPath(): Promise<string> {
  return (await headers()).get(PATH_HEADER) ?? "/";
}
