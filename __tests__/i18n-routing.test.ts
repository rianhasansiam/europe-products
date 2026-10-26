import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { DEFAULT_LOCALE, getLocaleDefinition, LOCALE_COOKIE, normalizeLocale } from "@/lib/i18n/registry";
import { localizeHref, replaceLocaleHref, resolveNavigationLocale, splitLocalePath } from "@/lib/i18n/paths";

const mocks = vi.hoisted(() => ({ published: vi.fn(), profile: vi.fn(), catalogRedirect: vi.fn(), messages: vi.fn() }));
vi.mock("@/lib/i18n/server", () => ({ getPublishedLanguages: mocks.published }));
vi.mock("@/lib/i18n/preferences", () => ({ getProfileLocale: mocks.profile }));
vi.mock("@/lib/i18n/catalogs", () => ({ loadMessages: mocks.messages }));
vi.mock("@/lib/services/catalog-redirect.service", () => ({ getCatalogRedirectByPath: mocks.catalogRedirect }));
import { proxy } from "@/proxy";

beforeEach(() => { mocks.published.mockResolvedValue([{ code: "en" }, { code: "bn" }]); mocks.profile.mockResolvedValue("bn"); mocks.catalogRedirect.mockResolvedValue(null); });

describe("locale normalization and navigation", () => {
  it("defaults to English with no inferred language input", () => {
    expect(DEFAULT_LOCALE).toBe("en");
    expect(resolveNavigationLocale(null, null, ["en", "bn"])).toBe("en");
    expect(resolveNavigationLocale("ar", "bn", ["en", "bn", "ar"])).toBe("ar");
    expect(resolveNavigationLocale(null, "disabled", ["en", "bn"])).toBe("en");
  });
  it("keeps distinct Chinese scripts and validates identifiers", () => {
    expect(normalizeLocale("zh-CN")).toBe("zh-Hans");
    expect(normalizeLocale("zh-TW")).toBe("zh-Hant");
    expect(normalizeLocale("../ar")).toBeNull();
    expect(getLocaleDefinition("ar").direction).toBe("rtl");
    expect(getLocaleDefinition("ar-Latn").direction).toBe("ltr");
  });
  it("switches equivalent routes without changing query encoding or fragments", () => {
    expect(replaceLocaleHref("/bn/products?q=a%2Bb&page=3#details", "en")).toBe("/en/products?q=a%2Bb&page=3#details");
    expect(localizeHref("/ar/products?q=x", "bn")).toBe("/ar/products?q=x");
    expect(localizeHref("/products", "bn")).toBe("/bn/products");
    expect(localizeHref("/", "en")).toBe("/en");
  });
  it.each(["/api/auth/callback/google", "/api/payments/airwallex/webhook", "/uploads/image.jpg", "/_next/static/chunk.js", "https://example.test/products", "//example.test/path", "#gallery"])("excludes %s", (href) => expect(localizeHref(href, "bn")).toBe(href));
  it("strips only locale segments, retaining business routes", () => {
    expect(splitLocalePath("/bn/checkout")).toEqual({ locale: "bn", pathname: "/checkout" });
    expect(splitLocalePath("/products/sample")).toEqual({ locale: null, pathname: "/products/sample" });
  });
});

describe("English-only server routing", () => {
  it("retains the loopback origin for internal English rewrites", async () => {
    vi.stubEnv("__NEXT_NO_MIDDLEWARE_URL_NORMALIZE", "1");
    try {
      const response = await proxy(new NextRequest("http://127.0.0.1:3111/en/contact?q=hello"));
      expect(response.headers.get("x-middleware-rewrite")).toBe("http://127.0.0.1:3111/contact?q=hello");
      expect(response.headers.get("location")).toBeNull();
    } finally { vi.unstubAllEnvs(); }
  });

  it("uses English despite browser, country, and forged locale headers", async () => {
    const response = await proxy(new NextRequest("https://bangbuy.test/?q=hello", {
      headers: { "accept-language": "ar", "cf-ipcountry": "SA", "x-bangbuy-locale": "ar" },
    }));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://bangbuy.test/en?q=hello");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.published).not.toHaveBeenCalled();
    expect(mocks.profile).not.toHaveBeenCalled();
    expect(mocks.messages).not.toHaveBeenCalled();
  });

  it("ignores and clears a previous language cookie while retaining query encoding", async () => {
    const response = await proxy(new NextRequest("https://bangbuy.test/products?q=a%2Bb&page=2", {
      headers: { cookie: `${LOCALE_COOKIE}=bn; currency=USD` },
    }));
    expect(response.headers.get("location")).toBe("https://bangbuy.test/en/products?q=a%2Bb&page=2");
    expect(response.cookies.get(LOCALE_COOKIE)?.value).toBe("");
    expect(response.headers.get("set-cookie")).toContain("Expires=Thu, 01 Jan 1970");
    expect(mocks.profile).not.toHaveBeenCalled();
  });

  it("never consults an authenticated user's old profile preference", async () => {
    const response = await proxy(new NextRequest("https://bangbuy.test/checkout"));
    expect(response.headers.get("location")).toBe("https://bangbuy.test/en/checkout");
    expect(mocks.profile).not.toHaveBeenCalled();
    expect(mocks.published).not.toHaveBeenCalled();
  });

  it.each(["bn", "ar", "fr", "en-GB"])("redirects an explicit %s URL to English preserving queries", async (locale) => {
    const response = await proxy(new NextRequest(`https://bangbuy.test/${locale}/products?q=a%2Bb&page=2`));
    expect(response.headers.get("location")).toBe("https://bangbuy.test/en/products?q=a%2Bb&page=2");
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
  });

  it("overwrites forged rendering headers and clears language preferences on English rewrites", async () => {
    const response = await proxy(new NextRequest("https://bangbuy.test/en/products?page=2", {
      headers: {
        cookie: `${LOCALE_COOKIE}=bn; currency=USD`,
        "x-bangbuy-locale": "ar", "x-bangbuy-path": "/forged", "x-bangbuy-url": "/ar/forged",
      },
    }));
    expect(response.headers.get("x-middleware-rewrite")).toBe("https://bangbuy.test/products?page=2");
    expect(response.headers.get("x-middleware-request-x-bangbuy-locale")).toBe("en");
    expect(response.headers.get("x-middleware-request-x-bangbuy-path")).toBe("/products");
    expect(response.headers.get("x-middleware-request-x-bangbuy-url")).toBe("/en/products?page=2");
    expect(response.headers.get("x-middleware-request-cookie")).toContain("currency=USD");
    expect(response.cookies.get(LOCALE_COOKIE)?.value).toBe("");
    expect(mocks.profile).not.toHaveBeenCalled();
  });

  it("does not set a language cookie for an ordinary English request", async () => {
    const response = await proxy(new NextRequest("https://bangbuy.test/en/products"));
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("location")).toBeNull();
  });

  it("retains historical catalog redirects and queries in English", async () => {
    mocks.catalogRedirect.mockResolvedValue({ destinationPath: "/products/new-slug" });
    const response = await proxy(new NextRequest("https://bangbuy.test/en/products/old-slug?q=a%2Bb"));
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe("https://bangbuy.test/en/products/new-slug?q=a%2Bb");
    expect(mocks.catalogRedirect).toHaveBeenCalledWith("/products/old-slug", "PRODUCT");
  });

  it("normalizes catalog slug casing without changing query strings", async () => {
    const response = await proxy(new NextRequest("https://bangbuy.test/en/products/Example-Slug?q=a%2Bb"));
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe("https://bangbuy.test/en/products/example-slug?q=a%2Bb");
    expect(mocks.catalogRedirect).toHaveBeenCalledWith("/products/example-slug", "PRODUCT");
  });

  it.each(["/api/auth/callback/google", "/api/payments/sslcommerz/success", "/_next/image", "/uploads/picture.png", "/bn/api/cart"])("does not rewrite excluded %s", async (path) => {
    const response = await proxy(new NextRequest(`https://bangbuy.test${path}`));
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    expect(response.headers.get("location")).toBeNull();
    expect(mocks.catalogRedirect).not.toHaveBeenCalled();
  });
});
