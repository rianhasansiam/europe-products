import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { cache, Suspense } from "react";

import { ProductGridSkeleton } from "@/components/ui/loading";
import type { CatalogFacets } from "@/features/products/api";
import {
  parseProductsPageQuery,
  productsPagePathForActualPage,
  productsPageIndexingPolicy,
  toProductQueryInput,
} from "@/lib/catalog/products-page-query";
import { buildLocalizedMetadata } from "@/lib/seo/localized-metadata";
import { getTranslations } from "next-intl/server";
import { siteConfig } from "@/lib/seo/site";
import {
  getPublicCatalogFacets,
  getPublicCatalogPage,
} from "@/lib/services/public-catalog-cache.service";

import ProductsExplorer from "./components/ProductsExplorer";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
type Props = { searchParams: Promise<SearchParams> };

const EMPTY_FACETS: CatalogFacets = {
  categories: [],
  brands: [],
  manufacturers: [],
  priceBounds: { min: 0, max: 0 },
  availability: { inStock: 0, outOfStock: 0 },
};

const getProductsPageDataByKey = cache(async (queryKey: string) =>
  getPublicCatalogPage(JSON.parse(queryKey)),
);

function productsPageDataKey(query: ReturnType<typeof parseProductsPageQuery>) {
  return JSON.stringify(toProductQueryInput(query));
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const translate = await getTranslations("Seo");
  const raw = await searchParams;
  const query = parseProductsPageQuery(raw);
  const { meta } = await getProductsPageDataByKey(productsPageDataKey(query));
  if (meta.page !== query.page) {
    redirect(productsPagePathForActualPage(raw, meta.page));
  }
  const policy = productsPageIndexingPolicy(raw);
  const title = query.search
    ? translate("searchTitle", { search: query.search })
    : policy.hasUncontrolledParams
      ? translate("filteredProducts")
      : query.page > 1
        ? translate("productsPageTitle", { page: query.page })
        : translate("allProducts");
  const description = query.search
    ? translate("searchDescription", { brand: siteConfig.name, search: query.search })
    : query.page > 1 && policy.index
      ? translate("productsPageDescription", { brand: siteConfig.name, page: query.page })
      : translate("productsDescription");

  return buildLocalizedMetadata({
    title,
    description,
    path: policy.canonicalPath,
    index: policy.index,
    keywords: policy.index
      ? ["all products", "online catalog", "shop online", ...siteConfig.keywords]
      : undefined,
  }, "InterfaceProductsPage");
}

export default async function ProductsPage({ searchParams }: Props) {
  const raw = await searchParams;
  const initialQuery = parseProductsPageQuery(raw);
  const [{ items: initialProducts, meta }, facets] = await Promise.all([
    getProductsPageDataByKey(productsPageDataKey(initialQuery)),
    getPublicCatalogFacets().catch((error: unknown) => {
      console.error("products page: failed to load facets", error);
      return EMPTY_FACETS;
    }),
  ]);
  if (meta.page !== initialQuery.page) {
    redirect(productsPagePathForActualPage(raw, meta.page));
  }
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background">
          <div className="mx-auto max-w-7xl px-3 py-6 sm:px-4 lg:px-6">
            <ProductGridSkeleton wide />
          </div>
        </div>
      }
    >
      <ProductsExplorer
        key={productsPageDataKey(initialQuery)}
        initialProducts={initialProducts}
        initialMeta={meta}
        initialFacets={facets}
      />
    </Suspense>
  );
}
