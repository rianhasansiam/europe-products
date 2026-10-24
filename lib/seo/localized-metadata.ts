import "server-only";

import type { Metadata } from "next";
import { getInterfaceTranslations } from "@/components/i18n/server";
import { getPublishedLanguages, getRequestLocale } from "@/lib/i18n/server";
import { DEFAULT_LOCALE } from "@/lib/i18n/registry";
import { buildMetadata, type PageMetadataInput } from "./metadata";

/** Static primary-content coverage. Legal variants require a separate review. */
export const PREPARED_STATIC_PATHS: Record<string, true> = {
  "/contact": true,
};

/** Server-render translated metadata alongside the active request catalog. */
export async function buildLocalizedMetadata(
  input: PageMetadataInput,
  namespace: string,
): Promise<Metadata> {
  const [locale, languages, translate] = await Promise.all([
    getRequestLocale(),
    getPublishedLanguages(),
    getInterfaceTranslations(namespace),
  ]);
  return buildMetadata({
    ...input,
    title: translate(input.title),
    description: translate(input.description),
    locale,
    publishedLocales: languages.map((language) => language.code),
    // A catalog alone cannot establish the readiness of CMS/catalog content.
    preparedLocales: input.preparedLocales ?? (PREPARED_STATIC_PATHS[input.path ?? "/"]
      ? languages.map((language) => language.code)
      : [DEFAULT_LOCALE]),
  });
}
