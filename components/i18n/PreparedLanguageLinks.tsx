import "server-only";

import { getPublishedLanguages, getRequestPath } from "@/lib/i18n/server";
import { PREPARED_STATIC_PATHS } from "@/lib/seo/localized-metadata";
import PreparedLanguageLinksClient from "./PreparedLanguageLinksClient";

/** Keep original/incomplete primary-content variants out of alternate navigation. */
export default async function PreparedLanguageLinks({ pathname }: { pathname?: string }) {
  const path = pathname ?? await getRequestPath();
  if (!PREPARED_STATIC_PATHS[path]) return null;
  const languages = (await getPublishedLanguages())
    .filter((language) => language.prepared && language.published)
    .map(({ code, englishName, nativeName, direction }) => ({ code, englishName, nativeName, direction }));
  if (languages.length < 2) return null;
  return <PreparedLanguageLinksClient pathname={path} languages={languages} />;
}
