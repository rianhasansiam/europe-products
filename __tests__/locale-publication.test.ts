import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ overrides: vi.fn(), messages: vi.fn(), headers: vi.fn() }));
vi.mock("@/lib/translations/languages", () => ({ getPublishedLanguageOverrides: mocks.overrides }));
vi.mock("@/lib/i18n/catalogs", () => ({ loadBundledMessages: mocks.messages, loadMessages: mocks.messages }));
vi.mock("next/headers", () => ({ headers: mocks.headers }));
import { getPublishedLanguages, getRequestLocale } from "@/lib/i18n/server";

beforeEach(() => {
  mocks.overrides.mockResolvedValue([{ code: "bn", prepared: true, published: true, publicationOverride: true }]);
  mocks.headers.mockResolvedValue(new Headers());
});

describe("English-only publication", () => {
  it("publishes only English without loading the old translation registry", async () => {
    expect(await getPublishedLanguages()).toEqual([
      expect.objectContaining({ code: "en", englishName: "English", direction: "ltr", prepared: true, published: true }),
    ]);
    expect(mocks.overrides).not.toHaveBeenCalled();
    expect(mocks.messages).not.toHaveBeenCalled();
  });

  it.each([null, "en", "invalid/locale"])("uses English for the %s request locale", async (locale) => {
    mocks.headers.mockResolvedValue(new Headers(locale ? { "x-bangbuy-locale": locale } : {}));
    expect(await getRequestLocale()).toBe("en");
    expect(mocks.overrides).not.toHaveBeenCalled();
    expect(mocks.messages).not.toHaveBeenCalled();
  });

  it.each(["bn", "ar", "fr"])("redirects an old %s locale to the equivalent English URL", async (locale) => {
    mocks.headers.mockResolvedValue(new Headers({
      "x-bangbuy-locale": locale,
      "x-bangbuy-path": "/products",
      "x-bangbuy-url": `/${locale}/products?q=a%2Bb&page=2`,
    }));
    await expect(getRequestLocale()).rejects.toMatchObject({
      digest: expect.stringContaining("/products?q=a%2Bb&page=2"),
    });
    expect(mocks.overrides).not.toHaveBeenCalled();
    expect(mocks.messages).not.toHaveBeenCalled();
  });

  it("retains the request path when an old locale has no original URL header", async () => {
    mocks.headers.mockResolvedValue(new Headers({ "x-bangbuy-locale": "bn", "x-bangbuy-path": "/checkout" }));
    await expect(getRequestLocale()).rejects.toMatchObject({ digest: expect.stringContaining("/checkout") });
  });
});
