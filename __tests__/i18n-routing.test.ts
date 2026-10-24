import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { DEFAULT_LOCALE, getLocaleDefinition, LOCALE_COOKIE, normalizeLocale } from "@/lib/i18n/registry";
import { localizeHref, replaceLocaleHref, resolveNavigationLocale, splitLocalePath } from "@/lib/i18n/paths";

const mocks = vi.hoisted(() => ({ published: ["en", "bn", "ar"], profile: vi.fn(), catalogRedirect: vi.fn(), messages: vi.fn() }));
vi.mock("@/lib/i18n/server", () => ({ getPublishedLanguages: async () => mocks.published.map((code) => ({ code })) }));
vi.mock("@/lib/i18n/preferences", () => ({ getProfileLocale: mocks.profile }));
vi.mock("@/lib/i18n/catalogs", () => ({ loadMessages: mocks.messages }));
vi.mock("@/lib/services/catalog-redirect.service", () => ({ getCatalogRedirectByPath: mocks.catalogRedirect }));
import { proxy } from "@/proxy";

beforeEach(() => { mocks.published = ["en", "bn", "ar"]; mocks.profile.mockResolvedValue(null); mocks.catalogRedirect.mockResolvedValue(null); mocks.messages.mockResolvedValue({ Navigation: { title: "Fixture" } }); });

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

describe("server locale routing", () => {
  it("retains the loopback origin so locale rewrites cannot become external self-requests",async()=>{
    vi.stubEnv("__NEXT_NO_MIDDLEWARE_URL_NORMALIZE","1");
    try{
      const response=await proxy(new NextRequest("http://127.0.0.1:3111/en/contact?q=hello"));
      expect(response.headers.get("x-middleware-rewrite")).toBe("http://127.0.0.1:3111/contact?q=hello");
      expect(response.headers.get("location")).toBeNull();
    }finally{vi.unstubAllEnvs();}
  });
  it("Arabic browser and country headers never change the first visit default", async () => {
    const response = await proxy(new NextRequest("https://bangbuy.test/?q=hello", { headers: { "accept-language": "ar", "cf-ipcountry": "SA", "x-bangbuy-locale": "ar" } }));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://bangbuy.test/en?q=hello");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
  it("redirects a returning visitor to the saved language retaining pagination", async () => {
    const response = await proxy(new NextRequest("https://bangbuy.test/products?page=2", { headers: { cookie: `${LOCALE_COOKIE}=bn` } }));
    expect(response.headers.get("location")).toBe("https://bangbuy.test/bn/products?page=2");
    expect(mocks.profile).not.toHaveBeenCalled();
  });
  it("uses the profile preference only if no preference cookie exists", async () => {
    mocks.profile.mockResolvedValue("bn");
    const response = await proxy(new NextRequest("https://bangbuy.test/products"));
    expect(response.headers.get("location")).toBe("https://bangbuy.test/bn/products");
  });
  it.each(["bn", "ar", "en"])("explicit %s URLs override cookies and forged locale headers", async (locale) => {
    const response = await proxy(new NextRequest(`https://bangbuy.test/${locale}/products?page=2`, { headers: { cookie: `${LOCALE_COOKIE}=bn; currency=USD`, "x-bangbuy-locale": "ar" } }));
    expect(response.headers.get("x-middleware-rewrite")).toBe("https://bangbuy.test/products?page=2");
    expect(response.headers.get("x-middleware-request-x-bangbuy-locale")).toBe(locale);
    expect(response.headers.get("x-middleware-request-cookie")).toContain("currency=USD");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(mocks.profile).not.toHaveBeenCalled();
  });
  it("falls back after a saved or explicitly addressed locale is disabled", async () => {
    mocks.published = ["en"];
    const legacy = await proxy(new NextRequest("https://bangbuy.test/cart", { headers: { cookie: `${LOCALE_COOKIE}=bn` } }));
    expect(legacy.headers.get("location")).toBe("https://bangbuy.test/en/cart");
    const explicit = await proxy(new NextRequest("https://bangbuy.test/bn/cart"));
    expect(explicit.headers.get("location")).toBe("https://bangbuy.test/en/cart");
  });
  it("retains locale and queries through historical catalog redirects", async () => {
    mocks.catalogRedirect.mockResolvedValue({ destinationPath: "/products/new-slug" });
    const response = await proxy(new NextRequest("https://bangbuy.test/bn/products/old-slug?q=x"));
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe("https://bangbuy.test/bn/products/new-slug?q=x");
  });
  it("redirects before rendering when an imported published catalog is unavailable", async () => {
    mocks.messages.mockResolvedValue({});
    const response = await proxy(new NextRequest("https://bangbuy.test/ar/products?q=a%2Bb"));
    expect(response.headers.get("location")).toBe("https://bangbuy.test/en/products?q=a%2Bb");
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
  });
  it.each(["/api/auth/callback/google", "/api/payments/sslcommerz/success", "/_next/image", "/uploads/picture.png", "/bn/api/cart"])("does not rewrite excluded %s", async (path) => {
    const response = await proxy(new NextRequest(`https://bangbuy.test${path}`));
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    expect(response.headers.get("location")).toBeNull();
  });
});
