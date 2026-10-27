import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTranslator } from "next-intl";
import seoMessages from "@/messages/seo-en.json";

import { buildMetadata, noIndexMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd, collectionPageJsonLd, productJsonLd, websiteJsonLd } from "@/lib/seo/json-ld";
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
  getPublishedLanguages: async () => [{ code: "en" }],
  getRequestLocale: async () => "en",
}));
vi.mock("@/lib/translations/service", () => ({ getPublishedEntityLocales: mocks.locales }));

describe("prefix-free English metadata", () => {
  const input = { title: "Pump", path: "/products/pump", locale: "en", preparedLocales: ["en"], publishedLocales: ["en"] };
  it.each(["/products/pump", "/en/products/pump", "/bn/products/pump"])("uses one canonical and matching Open Graph URL for %s", (path) => {
    const result = buildMetadata({ ...input, path });
    expect(result.alternates).toEqual({ canonical: absoluteUrl("/products/pump"), languages: {
      en: absoluteUrl("/products/pump"), "x-default": absoluteUrl("/products/pump"),
    } });
    expect(result.robots).toMatchObject({ index: true });
    expect(result.openGraph).toMatchObject({ locale: "en", url: absoluteUrl("/products/pump") });
  });
  it("noindexes incomplete pages and excludes disabled languages from alternates", () => {
    const result = buildMetadata({ ...input, preparedLocales: ["bn"] });
    expect(result.robots).toMatchObject({ index: false });
    expect(result.alternates?.languages).toEqual({});
    expect(buildMetadata({ ...input, preparedLocales: ["en", "bn"] }).alternates?.languages).toEqual({
      en: absoluteUrl("/products/pump"), "x-default": absoluteUrl("/products/pump"),
    });
    expect(buildMetadata({ ...input, publishedLocales: [] }).robots).toMatchObject({ index: false });
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
  it("keeps URLs prefix-free and preserves formatted display and structured commerce amounts", () => {
    const schema = productJsonLd({ name: "পাম্প", description: "বিবরণ", path: "/products/pump", locale: "bn", price: 1234.5, currency: "BDT", inStock: true });
    expect(schema.url).toBe(absoluteUrl("/products/pump"));
    expect(schema.offers).toMatchObject({ price: "1234.50", priceCurrency: "BDT" });
    const breadcrumbs = breadcrumbJsonLd([{ name: "পণ্য", path: "/products" }], "bn");
    expect(breadcrumbs.itemListElement).toEqual([{ "@type": "ListItem", position: 1, name: "পণ্য", item: absoluteUrl("/products") }]);
    expect(formatMoney(1234.5, "BDT", { locale: "bn" })).toMatch(/[০-৯]/);
    expect(formatMoney(1234.5, "USD", { locale: "bn" })).toContain("US$");
  });
  it("uses prefix-free JSON-LD search targets and normalizes legacy content paths without a locale argument", () => {
    expect(websiteJsonLd("en")).toMatchObject({
      url: absoluteUrl("/"),
      potentialAction: { target: { urlTemplate: `${absoluteUrl("/products")}?search={search_term_string}` } },
    });
    expect(collectionPageJsonLd({ name: "Pumps", path: "/en/categories/pumps" }).url).toBe(absoluteUrl("/categories/pumps"));
    expect(breadcrumbJsonLd([{ name: "Products", path: "/en/products" }]).itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Products", item: absoluteUrl("/products") },
    ]);
    expect(productJsonLd({ name: "Pump", description: "Details", path: "/en/products/pump", price: 20, inStock: true })).toMatchObject({
      url: absoluteUrl("/products/pump"), offers: { url: absoluteUrl("/products/pump") },
    });
  });
  it("omits offers only when the caller has no available price", () => {
    const input = { name: "Product", description: "Details", path: "/products/product", price: 1200, inStock: true };
    expect(productJsonLd({ ...input, pricingReady: false })).not.toHaveProperty("offers");
    expect(productJsonLd({ ...input, pricingReady: true }).offers).toMatchObject({ priceCurrency: "USD", price: "1200.00" });
  });
});

describe("prefix-free English sitemap coverage", () => {
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
  it("lists each English page once and preserves hidden category exclusions", async () => {
    const { default: sitemap } = await import("@/app/sitemap");
    const result = await sitemap();
    const urls = result.map((entry) => entry.url);
    expect(urls).toContain(absoluteUrl("/"));
    expect(urls).toContain(absoluteUrl("/products/translated"));
    expect(urls).toContain(absoluteUrl("/products/english-only"));
    expect(urls.some((url) => url.includes("hidden") || /^\/(en|bn|ar)(\/|$)/.test(new URL(url).pathname))).toBe(false);
    expect(urls.some((url) => new URL(url).pathname.startsWith("/brands"))).toBe(false);
    expect(mocks.brands).not.toHaveBeenCalled();
    expect(urls).toContain(absoluteUrl("/contact"));
    expect(urls).toContain(absoluteUrl("/privacy-policy"));
    expect(new Set(urls).size).toBe(urls.length);
    const translated = result.find((entry) => entry.url === absoluteUrl("/products/translated"));
    expect(translated?.alternates?.languages).toEqual({
      en: absoluteUrl("/products/translated"), "x-default": absoluteUrl("/products/translated"),
    });
    expect(result.every((entry) => Object.values(entry.alternates?.languages ?? {}).every((url) => url === entry.url))).toBe(true);
    expect(mocks.locales.mock.calls.map(([type]) => type).sort()).toEqual(["category", "product"]);
  });
});
