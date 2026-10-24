import { beforeEach, describe, expect, it, vi } from "vitest";
import { contentHash } from "@/lib/translations/validation";
const source = { Navigation: { title: "English" } };
const mocks = vi.hoisted(() => ({ overrides: vi.fn(), messages: vi.fn(), headers: vi.fn() }));
vi.mock("@/lib/translations/languages", () => ({ getPublishedLanguageOverrides: mocks.overrides }));
vi.mock("@/lib/i18n/catalogs", () => ({ loadBundledMessages: async () => ({ Navigation: { title: "English" } }), loadMessages: mocks.messages }));
vi.mock("next/headers", () => ({ headers: mocks.headers }));
import { getPublishedLanguages, getRequestLocale } from "@/lib/i18n/server";

function row(code: string, overrides: Record<string, unknown> = {}) {
  return { code, englishName: code, nativeName: code, direction: "ltr", fallbackLocale: null, providerCode: code, available: true, prepared: true, published: true, publicationOverride: true, hasInterfaceCatalog: true, catalogReviewedAt: new Date(), interfaceSourceHash: contentHash(source), ...overrides };
}
beforeEach(() => { mocks.overrides.mockResolvedValue(null); mocks.messages.mockResolvedValue({ Navigation: { title: "Translated" } }); mocks.headers.mockResolvedValue(new Headers()); });

describe("publication readiness and outage fallback", () => {
  it("keeps bundled Bengali published after provider discovery without an explicit override", async () => {
    mocks.overrides.mockResolvedValue([row("bn", { publicationOverride: false, prepared: false, published: false, catalogReviewedAt: null, interfaceSourceHash: null, hasInterfaceCatalog: false })]);
    expect((await getPublishedLanguages()).map((language) => language.code)).toEqual(["en", "bn"]);
  });
  it("honors an explicit disabled bundled language", async () => {
    mocks.overrides.mockResolvedValue([row("bn", { published: false })]);
    expect((await getPublishedLanguages()).map((language) => language.code)).toEqual(["en"]);
  });
  it("excludes stale or unreviewed imported catalogs", async () => {
    mocks.overrides.mockResolvedValue([row("ar", { interfaceSourceHash: "obsolete" }), row("fr", { catalogReviewedAt: null }), row("de", { hasInterfaceCatalog: false })]);
    expect((await getPublishedLanguages()).map((language) => language.code)).toEqual(["en", "bn"]);
  });
  it("supports a complete current manually imported language", async () => {
    mocks.overrides.mockResolvedValue([row("ar")]);
    expect((await getPublishedLanguages()).map((language) => language.code)).toContain("ar");
  });
  it("uses English only when publication availability cannot be determined", async () => {
    mocks.overrides.mockRejectedValue(new Error("Registry temporarily unavailable"));
    expect((await getPublishedLanguages()).map((language) => language.code)).toEqual(["en"]);
  });
  it("redirects instead of rendering English beneath an unavailable language URL", async () => {
    mocks.overrides.mockResolvedValue([row("ar")]);
    mocks.messages.mockResolvedValue({});
    mocks.headers.mockResolvedValue(new Headers({ "x-bangbuy-locale": "ar", "x-bangbuy-path": "/products", "x-bangbuy-url": "/ar/products?q=a%2Bb" }));
    await expect(getRequestLocale()).rejects.toMatchObject({ digest: expect.stringContaining("/en/products?q=a%2Bb") });
  });
});
