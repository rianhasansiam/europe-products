import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getCatalogRedirectByPath } from "@/lib/services/catalog-redirect.service";
import { getPublishedLanguages } from "@/lib/i18n/server";
import { getProfileLocale } from "@/lib/i18n/preferences";
import { DEFAULT_LOCALE, LOCALE_COOKIE, LOCALE_HEADER, PATH_HEADER, URL_HEADER } from "@/lib/i18n/registry";
import { loadMessages } from "@/lib/i18n/catalogs";
import { isLocaleExcludedPath, replaceLocaleHref, resolveNavigationLocale, splitLocalePath } from "@/lib/i18n/paths";

const MAX_CATALOG_PATH_LENGTH = 8_192;
const CATALOG_PATH_PATTERN =
  /^\/(?:products\/[a-z0-9]+(?:-[a-z0-9]+)*|brands\/[a-z0-9]+(?:-[a-z0-9]+)*|categories\/[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*)$/;

function isCatalogPath(pathname: string): boolean {
  return (
    pathname.length <= MAX_CATALOG_PATH_LENGTH &&
    CATALOG_PATH_PATTERN.test(pathname)
  );
}

/**
 * Normalize catalog URLs and resolve persisted slug history before React can
 * start streaming. This guarantees a real permanent HTTP redirect rather
 * than a 200 response containing a client-side meta refresh.
 */
export async function proxy(request: NextRequest) {
  const incomingPath = request.nextUrl.pathname;
  if (isLocaleExcludedPath(incomingPath)) return NextResponse.next();
  const { locale: explicit, pathname } = splitLocalePath(incomingPath);
  // A locale must never turn an API, upload, callback or static asset into a page.
  if (isLocaleExcludedPath(pathname)) return NextResponse.next();
  const published = (await getPublishedLanguages()).map((language) => language.code);
  const saved = explicit ? null : request.cookies.get(LOCALE_COOKIE)?.value ?? await getProfileLocale(request);
  let locale = resolveNavigationLocale(explicit, saved, published);
  if (locale !== DEFAULT_LOCALE && !Object.keys(await loadMessages(locale)).length) locale = DEFAULT_LOCALE;
  const canonicalPath = replaceLocaleHref(pathname, locale);
  if (!explicit || explicit !== locale || incomingPath !== canonicalPath) {
    const destination = new URL(request.url);
    destination.pathname = canonicalPath;
    const response = NextResponse.redirect(destination, explicit && explicit === locale ? 308 : 307);
    // Preference redirects are private; no visitor's language can leak via CDN caching.
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Vary", "Cookie");
    if (saved && locale === DEFAULT_LOCALE && !published.includes(saved)) response.cookies.delete(LOCALE_COOKIE);
    return response;
  }

  const renderPage = () => {
    const requestHeaders = new Headers(request.headers);
    // Overwrite untrusted input; the URL is the sole locale authority for rendering.
    requestHeaders.set(LOCALE_HEADER, locale);
    requestHeaders.set(PATH_HEADER, pathname);
    requestHeaders.set(URL_HEADER, incomingPath + request.nextUrl.search);
    const destination = new URL(request.url);
    destination.pathname = pathname;
    return NextResponse.rewrite(destination, { request: { headers: requestHeaders } });
  };
  const normalizedPathname = pathname.toLowerCase();

  // Slugs written by catalog mutations are lowercase ASCII with single
  // hyphens. Skip malformed paths before consulting the shared redirect map.
  if (!isCatalogPath(normalizedPathname)) return renderPage();

  const entityType = normalizedPathname.startsWith("/products/")
    ? "PRODUCT"
    : normalizedPathname.startsWith("/brands/")
      ? "BRAND"
      : "CATEGORY";

  try {
    const redirect = await getCatalogRedirectByPath(
      normalizedPathname,
      entityType,
    );
    if (redirect) {
      const destination = new URL(request.url);
      destination.pathname = replaceLocaleHref(redirect.destinationPath, locale);
      return NextResponse.redirect(destination, 308);
    }
  } catch (error) {
    // Redirect history is an enhancement around otherwise functional pages.
    // Fail open so cached canonical catalog pages remain available during a
    // transient database or cache failure.
    console.error("Catalog redirect lookup failed.", error);
  }

  if (pathname === normalizedPathname) return renderPage();

  const destination = new URL(request.url);
  destination.pathname = replaceLocaleHref(normalizedPathname, locale);
  return NextResponse.redirect(destination, 308);
}

export const config = {
  matcher: ["/((?!api(?:/|$)|_next(?:/|$)|.*\\.[^/]+$).*)"],
};
