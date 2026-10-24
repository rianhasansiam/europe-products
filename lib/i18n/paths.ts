import { DEFAULT_LOCALE, normalizeLocale } from "./registry";

const EXCLUDED = /^\/(?:api|_next|uploads?|files|images|logo|fonts|\.well-known)(?:\/|$)|\.[^/]+$/i;

export function isLocaleExcludedPath(pathname: string): boolean {
  return EXCLUDED.test(pathname);
}

export function splitLocalePath(pathname: string): { locale: string | null; pathname: string } {
  const segment = pathname.split("/")[1] ?? "";
  const locale = normalizeLocale(segment);
  if (!locale || isLocaleExcludedPath(pathname)) return { locale: null, pathname };
  return { locale, pathname: pathname.slice(segment.length + 1) || "/" };
}

export function stripLocalePrefix(pathname: string): string {
  return splitLocalePath(pathname).pathname;
}

/** Equivalent route, retaining the exact query string and hash. */
export function replaceLocaleHref(href: string, locale: string): string {
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  const separator = href.search(/[?#]/);
  const pathname = separator < 0 ? href : href.slice(0, separator);
  const suffix = separator < 0 ? "" : href.slice(separator);
  if (isLocaleExcludedPath(pathname)) return href;
  const original = stripLocalePrefix(pathname);
  if (isLocaleExcludedPath(original)) return original + suffix;
  const canonical = normalizeLocale(locale) ?? DEFAULT_LOCALE;
  return `/${canonical}${original === "/" ? "" : original}${suffix}`;
}

/** Preserve an explicit language URL; localize only unprefixed internal links. */
export function localizeHref(href: string, locale: string): string {
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  const pathname = href.split(/[?#]/, 1)[0];
  if (splitLocalePath(pathname).locale) return href;
  return replaceLocaleHref(href, locale);
}

/** Preference is considered only for legacy, unprefixed URLs. */
export function resolveNavigationLocale(explicit: unknown, saved: unknown, published: readonly string[]): string {
  const urlLocale = normalizeLocale(explicit);
  if (urlLocale) return published.includes(urlLocale) ? urlLocale : DEFAULT_LOCALE;
  const savedLocale = normalizeLocale(saved);
  return savedLocale && published.includes(savedLocale) ? savedLocale : DEFAULT_LOCALE;
}
