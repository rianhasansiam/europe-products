import { DEFAULT_LOCALE, normalizeLocale } from "./registry";

/** Public API reads use the authoritative current URL locale, never device settings. */
export function addActiveApiLocale(params: URLSearchParams): URLSearchParams {
  const locale=typeof window==="undefined"?DEFAULT_LOCALE:normalizeLocale(window.location.pathname.split("/")[1])??DEFAULT_LOCALE;
  params.set("locale",locale);return params;
}
