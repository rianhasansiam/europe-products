import type { MetadataRoute } from "next";

import { dependOnCatalogTags } from "@/lib/cache/catalog-dependency";
import { catalogCacheTags } from "@/lib/cache/catalog-tags";
import { prisma } from "@/lib/db/prisma";
import { absoluteUrl } from "@/lib/seo/site";
import { getPublishedLanguages } from "@/lib/i18n/server";
import { DEFAULT_LOCALE } from "@/lib/i18n/registry";
import { localizeHref } from "@/lib/i18n/paths";
import { localizedAlternates } from "@/lib/seo/metadata";
import { PREPARED_STATIC_PATHS } from "@/lib/seo/localized-metadata";
import { getPublishedEntityLocales } from "@/lib/translations/service";

/**
 * Dynamic sitemap for SexToy.
 *
 * Lists the static public pages plus every ACTIVE category, brand, and
 * product. Inactive/soft-deleted rows and private routes are excluded.
 * A catalog read failure is allowed to fail regeneration so Next retains
 * the last complete ISR result instead of caching a partial sitemap.
 */
export const revalidate = 3600;

const STATIC_CONTENT_LAST_MODIFIED = new Date("2026-07-22T00:00:00.000Z");

const STATIC_ROUTES: {
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}[] = [
  { path: "/", changeFrequency: "daily", priority: 1 },
  { path: "/products", changeFrequency: "daily", priority: 0.9 },
  { path: "/categories", changeFrequency: "weekly", priority: 0.8 },
  { path: "/brands", changeFrequency: "weekly", priority: 0.75 },
  { path: "/about", changeFrequency: "monthly", priority: 0.5 },
  { path: "/contact", changeFrequency: "monthly", priority: 0.5 },
  { path: "/privacy-policy", changeFrequency: "yearly", priority: 0.3 },
  { path: "/return-policy", changeFrequency: "yearly", priority: 0.3 },
  { path: "/terms-and-conditions", changeFrequency: "yearly", priority: 0.3 },
];

type ProductSitemapRow = {
  id: string;
  slug: string;
  updatedAt: Date;
  categoryId: string;
};

type CategorySitemapRow = {
  id: string;
  parentId: string | null;
  path: string;
  status: "ACTIVE" | "INACTIVE";
  updatedAt: Date;
};

type BrandSitemapRow = {
  id: string;
  slug: string;
  updatedAt: Date;
};

function effectiveActiveCategoryIds(categories: CategorySitemapRow[]) {
  const categoriesById = new Map(
    categories.map((category) => [category.id, category]),
  );
  const activeMemo = new Map<string, boolean>();

  const isEffectivelyActive = (category: CategorySitemapRow): boolean => {
    const memoized = activeMemo.get(category.id);
    if (memoized !== undefined) return memoized;

    const visited = new Set<string>();
    let current: CategorySitemapRow | undefined = category;
    while (current) {
      if (visited.has(current.id) || current.status !== "ACTIVE") {
        activeMemo.set(category.id, false);
        return false;
      }
      visited.add(current.id);
      if (!current.parentId) break;
      const parent = categoriesById.get(current.parentId);
      if (!parent) {
        activeMemo.set(category.id, false);
        return false;
      }
      current = parent;
    }

    activeMemo.set(category.id, true);
    return true;
  };

  return new Set(
    categories.filter(isEffectivelyActive).map((category) => category.id),
  );
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await dependOnCatalogTags([catalogCacheTags.sitemap]);
  const publishedLocales = (await getPublishedLanguages()).map((language) => language.code);
  const entriesFor = (
    path: string,
    locales: readonly string[],
    input: Omit<MetadataRoute.Sitemap[number], "url" | "alternates">,
  ): MetadataRoute.Sitemap => {
    const ready = locales.filter((locale) => publishedLocales.includes(locale));
    return ready.map((locale) => ({
      ...input,
      url: absoluteUrl(localizeHref(path, locale)),
      alternates: { languages: localizedAlternates(path, ready, publishedLocales) },
    }));
  };
  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.flatMap((route) =>
    entriesFor(route.path, PREPARED_STATIC_PATHS[route.path] ? publishedLocales : [DEFAULT_LOCALE], {
      lastModified: STATIC_CONTENT_LAST_MODIFIED,
      changeFrequency: route.changeFrequency,
      priority: route.priority,
    }),
  );

  let categories: CategorySitemapRow[];
  try {
    categories = await prisma.category.findMany({
      select: {
        id: true,
        parentId: true,
        path: true,
        status: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
    });
  } catch (error) {
    console.error("sitemap: failed to load categories", error);
    throw error;
  }

  const activeCategoryIds = effectiveActiveCategoryIds(categories);
  const categoryLocales = await getPublishedEntityLocales("category", [...activeCategoryIds], ["name", "description", "seoTitle", "metaDescription"]);
  const categoryEntries: MetadataRoute.Sitemap = categories
    .filter((category) => activeCategoryIds.has(category.id))
    .flatMap((category) => entriesFor(`/categories/${category.path}`, categoryLocales.get(category.id) ?? [], {
        lastModified: category.updatedAt,
        changeFrequency: "weekly",
        priority: category.parentId ? 0.65 : 0.7,
      }));

  try {
    const [products, brands]: [ProductSitemapRow[], BrandSitemapRow[]] =
      await Promise.all([
        prisma.product.findMany({
          where: { status: "ACTIVE" },
          select: { id: true, slug: true, updatedAt: true, categoryId: true },
          orderBy: { updatedAt: "desc" },
        }),
        prisma.brand.findMany({
          where: { status: "ACTIVE" },
          select: { id: true, slug: true, updatedAt: true },
          orderBy: { updatedAt: "desc" },
        }),
      ]);

    const [productLocales, brandLocales] = await Promise.all([
      getPublishedEntityLocales("product", products.map((product) => product.id), ["name", "description", "descriptionBlocks", "seoTitle", "metaDescription"]),
      getPublishedEntityLocales("brand", brands.map((brand) => brand.id), ["description", "seoTitle", "metaDescription"]),
    ]);
    const productEntries: MetadataRoute.Sitemap = products
      .filter((product) => activeCategoryIds.has(product.categoryId))
      .flatMap((product) => entriesFor(`/products/${product.slug}`, productLocales.get(product.id) ?? [], {
          lastModified: product.updatedAt,
          changeFrequency: "weekly",
          priority: 0.8,
        }));
    const brandEntries: MetadataRoute.Sitemap = brands.flatMap((brand) =>
      entriesFor(`/brands/${brand.slug}`, brandLocales.get(brand.id) ?? [], {
        lastModified: brand.updatedAt,
        changeFrequency: "weekly",
        priority: 0.7,
      }));

    return [
      ...staticEntries,
      ...categoryEntries,
      ...brandEntries,
      ...productEntries,
    ];
  } catch (error) {
    console.error("sitemap: failed to load products or brands", error);
    throw error;
  }
}
