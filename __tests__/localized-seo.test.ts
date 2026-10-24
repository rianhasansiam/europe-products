import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTranslator } from "next-intl";
import seoMessages from "@/messages/seo-en.json";

import { buildMetadata, noIndexMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd, productJsonLd } from "@/lib/seo/json-ld";
import { categoryFallbackDescription, categoryFallbackTitle } from "@/lib/seo/catalog-metadata";
import { formatMoney } from "@/lib/currency/format-money";
import { absoluteUrl } from "@/lib/seo/site";

const mocks = vi.hoisted(() => ({
  categories: vi.fn(), products: vi.fn(), brands: vi.fn(), locales: vi.fn(),
}));
vi.mock("@/lib/cache/catalog-dependency", () => ({ dependOnCatalogTags: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: {
  category: { findMany: mocks.categories }, product: { findMany: mocks.products }, brand: { findMany: mocks.brands },
} }));
vi.mock("@/lib/i18n/server", () => ({
  getPublishedLanguages: async () => [{ code: "en" }, { code: "bn" }],
  getRequestLocale: async () => "en",
}));
vi.mock("@/lib/translations/service", () => ({ getPublishedEntityLocales: mocks.locales }));

describe("published localized metadata", () => {
  const input = { title: "পণ্য", path: "/products/pump", locale: "bn", preparedLocales: ["en", "bn"], publishedLocales: ["en", "bn"] };
  it("uses the active canonical and reciprocal, ready language variants", () => {
    const result = buildMetadata(input);
    expect(result.alternates).toEqual({ canonical: absoluteUrl("/bn/products/pump"), languages: {
      en: absoluteUrl("/en/products/pump"), bn: absoluteUrl("/bn/products/pump"), "x-default": absoluteUrl("/en/products/pump"),
    } });
    expect(result.robots).toMatchObject({ index: true });
    expect(result.openGraph).toMatchObject({ locale: "bn", url: absoluteUrl("/bn/products/pump") });
  });
  it("noindexes incomplete variants and excludes disabled languages from alternates", () => {
    const result = buildMetadata({ ...input, preparedLocales: ["en", "ar"] });
    expect(result.robots).toMatchObject({ index: false });
    expect(result.alternates?.languages).toEqual({ en: absoluteUrl("/en/products/pump"), "x-default": absoluteUrl("/en/products/pump") });
    expect(buildMetadata({ ...input, preparedLocales: ["bn"] }).alternates?.languages).not.toHaveProperty("en");
    expect(buildMetadata({ ...input, preparedLocales: ["bn"] }).alternates?.languages).not.toHaveProperty("x-default");
    expect(noIndexMetadata("Administration").robots).toEqual({ index: false, follow: false });
  });
  it("uses translated catalog fallback copy and locale digits", () => {
    expect(categoryFallbackTitle({ name: "পাম্প", path: "pumps" }, "bn")).toContain("অনলাইনে কিনুন");
    expect(categoryFallbackDescription({ name: "পাম্প", path: "pumps", totalProductCount: 2 }, "bn")).toContain("২ পণ্য");
    const imported = createTranslator({ locale: "fr", namespace: "Seo", messages: {
      Seo: { ...seoMessages.Seo, categoryTitle: "Achetez {context} en ligne{qualifier}" },
    } });
    expect(categoryFallbackTitle({ name: "Pompes", path: "pompes" }, "fr", imported)).toBe("Achetez Pompes en ligne");
  });
  it("localizes URLs and display without changing structured commerce amounts", () => {
    const schema = productJsonLd({ name: "পাম্প", description: "বিবরণ", path: "/products/pump", locale: "bn", price: 1234.5, currency: "BDT", inStock: true });
    expect(schema.url).toBe(absoluteUrl("/bn/products/pump"));
    expect(schema.offers).toMatchObject({ price: "1234.50", priceCurrency: "BDT" });
    const breadcrumbs = breadcrumbJsonLd([{ name: "পণ্য", path: "/products" }], "bn");
    expect(breadcrumbs.itemListElement).toEqual([{ "@type": "ListItem", position: 1, name: "পণ্য", item: absoluteUrl("/bn/products") }]);
    expect(formatMoney(1234.5, "BDT", { locale: "bn" })).toMatch(/[০-৯]/);
    expect(formatMoney(1234.5, "USD", { locale: "bn" })).toContain("US$");
  });
  it("omits offers until stored prices have been explicitly reviewed as USD", () => {
    const input = { name: "Product", description: "Details", path: "/products/product", price: 1200, inStock: true };
    expect(productJsonLd({ ...input, pricingReady: false })).not.toHaveProperty("offers");
    expect(productJsonLd({ ...input, pricingReady: true }).offers).toMatchObject({ priceCurrency: "USD", price: "1200.00" });
  });
});

describe("localized sitemap coverage", () => {
  beforeEach(() => {
    const updatedAt = new Date("2026-10-12T00:00:00Z");
    mocks.categories.mockResolvedValue([
      { id: "c1", parentId: null, path: "pumps", status: "ACTIVE", updatedAt },
      { id: "hidden", parentId: null, path: "hidden", status: "INACTIVE", updatedAt },
      { id: "child", parentId: "hidden", path: "hidden/child", status: "ACTIVE", updatedAt },
    ]);
    mocks.products.mockResolvedValue([
      { id: "p1", slug: "translated", categoryId: "c1", updatedAt },
      { id: "p2", slug: "english-only", categoryId: "c1", updatedAt },
      { id: "p3", slug: "hidden-product", categoryId: "child", updatedAt },
    ]);
    mocks.brands.mockResolvedValue([{ id: "b1", slug: "brand", updatedAt }]);
    mocks.locales.mockImplementation(async (type: string) => new Map(type === "product"
      ? [["p1", ["en", "bn", "ar"]], ["p2", ["en"]], ["p3", ["en", "bn"]]]
      : type === "category" ? [["c1", ["en", "bn"]]] : [["b1", ["en"]]]));
  });
  it("lists only published prepared pages and preserves hidden category exclusions", async () => {
    const { default: sitemap } = await import("@/app/sitemap");
    const result = await sitemap();
    const urls = result.map((entry) => entry.url);
    expect(urls).toContain(absoluteUrl("/bn/products/translated"));
    expect(urls).not.toContain(absoluteUrl("/bn/products/english-only"));
    expect(urls.some((url) => url.includes("hidden") || url.includes("/ar/"))).toBe(false);
    expect(urls).toContain(absoluteUrl("/bn/contact"));
    expect(urls).not.toContain(absoluteUrl("/bn/privacy-policy"));
    const translated = result.find((entry) => entry.url === absoluteUrl("/bn/products/translated"));
    expect(translated?.alternates?.languages).toEqual({
      en: absoluteUrl("/en/products/translated"), bn: absoluteUrl("/bn/products/translated"), "x-default": absoluteUrl("/en/products/translated"),
    });
    expect(mocks.locales.mock.calls.map(([type]) => type).sort()).toEqual(["brand", "category", "product"]);
  });
});
