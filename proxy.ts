import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getCatalogRedirectByPath } from "@/lib/services/catalog-redirect.service";
import { DEFAULT_LOCALE, LOCALE_COOKIE, LOCALE_HEADER, PATH_HEADER, URL_HEADER } from "@/lib/i18n/registry";
import { isLocaleExcludedPath, localizeHref, splitLocalePath } from "@/lib/i18n/paths";

const MAX_CATALOG_PATH_LENGTH = 8_192;
const CATALOG_PATH_PATTERN =
  /^\/(?:products\/[a-z0-9]+(?:-[a-z0-9]+)*|categories\/[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*)$/;

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

  const clearLanguagePreference = (response: NextResponse) => {
    if (request.cookies.has(LOCALE_COOKIE)) response.cookies.delete(LOCALE_COOKIE);
    return response;
  };
  const redirectTo = (path: string) => {
    const destination = new URL(request.url);
    destination.pathname = path;
    return clearLanguagePreference(NextResponse.redirect(destination, 308));
  };

  // Old bookmarks use the same pages without a language prefix.
  if (explicit) return redirectTo(pathname);

  const renderPage = () => {
    const requestHeaders = new Headers(request.headers);
    // Overwrite untrusted input with the site's fixed language.
    requestHeaders.set(LOCALE_HEADER, DEFAULT_LOCALE);
    requestHeaders.set(PATH_HEADER, pathname);
    requestHeaders.set(URL_HEADER, pathname + request.nextUrl.search);
    return clearLanguagePreference(NextResponse.next({ request: { headers: requestHeaders } }));
  };
  const normalizedPathname = pathname.toLowerCase();

  // Slugs written by catalog mutations are lowercase ASCII with single
  // hyphens. Skip malformed paths before consulting the shared redirect map.
  if (!isCatalogPath(normalizedPathname)) return renderPage();

  const entityType = normalizedPathname.startsWith("/products/")
    ? "PRODUCT"
    : "CATEGORY";

  try {
    const redirect = await getCatalogRedirectByPath(
      normalizedPathname,
      entityType,
    );
    if (redirect) {
      return redirectTo(localizeHref(redirect.destinationPath));
    }
  } catch (error) {
    // Redirect history is an enhancement around otherwise functional pages.
    // Fail open so cached canonical catalog pages remain available during a
    // transient database or cache failure.
    console.error("Catalog redirect lookup failed.", error);
  }

  if (pathname === normalizedPathname) return renderPage();

  return redirectTo(normalizedPathname);
}

export const config = {
  matcher: ["/((?!api(?:/|$)|_next(?:/|$)|.*\\.[^/]+$).*)"],
};
