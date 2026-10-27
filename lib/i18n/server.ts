import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { DEFAULT_LOCALE, getLocaleDefinition, LOCALE_HEADER, normalizeLocale, PATH_HEADER, URL_HEADER, type LocaleDefinition } from "./registry";
import { replaceLocaleHref } from "./paths";
import { redirect } from "next/navigation";

/** The site is English-only; stored translation settings cannot enable switching. */
export const getPublishedLanguages = cache(async (): Promise<LocaleDefinition[]> => {
  return [getLocaleDefinition(DEFAULT_LOCALE)];
});

export const getRequestLocale = cache(async (): Promise<string> => {
  const requestHeaders = await headers();
  const requested = normalizeLocale(requestHeaders.get(LOCALE_HEADER));
  if (requested && requested !== DEFAULT_LOCALE) {
    // Keep old language URLs pointing to their equivalent without a prefix.
    redirect(replaceLocaleHref(requestHeaders.get(URL_HEADER) ?? requestHeaders.get(PATH_HEADER) ?? "/", DEFAULT_LOCALE));
  }
  return DEFAULT_LOCALE;
});

export async function getRequestPath(): Promise<string> {
  return (await headers()).get(PATH_HEADER) ?? "/";
}
