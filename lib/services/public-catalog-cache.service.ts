import "server-only";

import { unstable_cache } from "next/cache";

import { mapApiProduct, type Product } from "@/features/products/api";
import { catalogCacheTags } from "@/lib/cache/catalog-tags";
import { getCatalogFacets } from "@/lib/services/catalog-discovery.service";
import {
  listProducts,
  serializeProduct,
} from "@/lib/services/product.service";
import type { ProductQueryInput } from "@/lib/validations/product.validation";
import { getRequestLocale } from "@/lib/i18n/server";
import { localizeCategorySnapshots, localizeProductSnapshots } from "@/lib/translations/public";

const getCachedPublicCatalogPage = unstable_cache(
  async (query: ProductQueryInput) => {
    const { items, meta } = await listProducts(query, { publicOnly: true });
    return {
      items: items.map((product): Product =>
        mapApiProduct(serializeProduct(product)),
      ),
      meta,
    };
  },
  ["public-catalog-page-v1"],
  {
    revalidate: 900,
    tags: [catalogCacheTags.catalog, catalogCacheTags.listings],
  },
);

const getCachedCatalogFacets = unstable_cache(
  getCatalogFacets,
  ["public-catalog-facets-v1"],
  {
    revalidate: 1800,
    tags: [
      catalogCacheTags.catalog,
      catalogCacheTags.facets,
      catalogCacheTags.categoryTree,
    ],
  },
);

export function isCacheablePublicCatalogQuery(query: ProductQueryInput): boolean {
  return (
    query.page <= 20 &&
    query.pageSize === 12 &&
    query.sort === "popular" &&
    !query.search &&
    !query.categoryPath &&
    !query.brandSlug &&
    !query.manufacturerSlug &&
    query.minPrice == null &&
    query.maxPrice == null &&
    !query.stock &&
    !query.minRating
  );
}

export async function getPublicCatalogPage(query: ProductQueryInput) {
  const locale=await getRequestLocale();
  if (isCacheablePublicCatalogQuery(query)) {
    const result=await getCachedPublicCatalogPage(query);
    return {...result,items:await localizeProductSnapshots(result.items,locale)};
  }

  const { items, meta } = await listProducts(query, { publicOnly: true });
  return {
    items: await localizeProductSnapshots(items.map((product): Product => mapApiProduct(serializeProduct(product))),locale),
    meta,
  };
}

export async function getPublicCatalogFacets(requestedLocale?:string) {
  const [facets,locale]=await Promise.all([getCachedCatalogFacets(),requestedLocale?Promise.resolve(requestedLocale):getRequestLocale()]);
  return {...facets,categories:await localizeCategorySnapshots(facets.categories,locale)};
}
