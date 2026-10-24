"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import { LoaderCircle, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { usePathname, useRouter } from "@/lib/i18n/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

import { ProductGridSkeleton } from "@/components/ui/loading";
import CurrencyAmount from "@/components/currency/CurrencyAmount";
import {
  fetchProductsFromApi,
  type ApiMeta,
  type CatalogFacets,
  type Product,
  type ProductSortOption,
} from "@/features/products/api";
import {
  parseProductsPageQuery,
  PRODUCTS_PAGE_SIZE,
  toProductQueryInput,
} from "@/lib/catalog/products-page-query";
import { cn } from "@/lib/utils";
import PublicContentNotice from "@/components/i18n/PublicContentNotice";

import FilterSidebar, {
  type CatalogFilterState,
} from "./FilterSidebar";
import MobileFilterDrawer from "./MobileFilterDrawer";
import ProductsGrid from "./ProductsGrid";
import ProductToolbar from "./ProductToolbar";

type ViewMode = "grid" | "list";

const EMPTY_FACETS: CatalogFacets = {
  categories: [],
  brands: [],
  manufacturers: [],
  priceBounds: { min: 0, max: 0 },
  availability: { inStock: 0, outOfStock: 0 },
};
const EMPTY_META: ApiMeta = {
  page: 1,
  pageSize: PRODUCTS_PAGE_SIZE,
  total: 0,
  totalPages: 1,
};
type ProductsExplorerProps = {
  initialProducts: Product[];
  initialMeta: ApiMeta;
  initialFacets: CatalogFacets;
};

function mergeUniqueProducts(current: Product[], incoming: Product[]) {
  const seenIds = new Set(current.map((product) => product.id));
  const merged = [...current];
  for (const product of incoming) {
    if (seenIds.has(product.id)) continue;
    seenIds.add(product.id);
    merged.push(product);
  }
  return merged;
}

export default function ProductsExplorer({
  initialProducts,
  initialMeta,
  initialFacets,
}: ProductsExplorerProps) {
  const i18n = useInterfaceTranslations("InterfaceProductsComponentsProductsExplorer");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const serializedParams = searchParams.toString();

  const query = useMemo(
    () => parseProductsPageQuery(new URLSearchParams(serializedParams)),
    [serializedParams],
  );

  const filters: CatalogFilterState = {
    categoryPath: query.categoryPath,
    brandSlug: query.brandSlug,
    manufacturerSlug: query.manufacturerSlug,
    minPrice: query.minPrice,
    maxPrice: query.maxPrice,
    minRating: query.minRating,
    stock: query.stock,
  };

  const safeInitialMeta = initialMeta ?? EMPTY_META;
  const facets = initialFacets ?? EMPTY_FACETS;
  const [products, setProducts] = useState(() =>
    mergeUniqueProducts([], initialProducts),
  );
  const [meta, setMeta] = useState(safeInitialMeta);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [endReached, setEndReached] = useState(
    safeInitialMeta.page >= safeInitialMeta.totalPages ||
      initialProducts.length === 0,
  );
  const [isPending, startTransition] = useTransition();
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const currentPageRef = useRef(safeInitialMeta.page);
  const requestedPageRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const hasMore = !endReached && meta.page < meta.totalPages;

  const loadMoreProducts = useCallback(async () => {
    const nextPage = currentPageRef.current + 1;
    if (requestedPageRef.current !== null || nextPage > meta.totalPages) return;

    requestedPageRef.current = nextPage;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsLoadingMore(true);
    setLoadMoreError(null);

    try {
      const result = await fetchProductsFromApi(
        { ...toProductQueryInput(query), page: nextPage },
        { signal: controller.signal },
      );
      if (controller.signal.aborted) return;

      const advanced = result.meta.page > currentPageRef.current;
      currentPageRef.current = result.meta.page;
      setProducts((current) => mergeUniqueProducts(current, result.items));
      setMeta(result.meta);
      setEndReached(
        !advanced ||
          result.items.length === 0 ||
          result.meta.page >= result.meta.totalPages,
      );
    } catch (error) {
      if (controller.signal.aborted) return;
      setLoadMoreError(
        error instanceof Error
          ? error.message
          : "Failed to load more products.",
      );
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
        requestedPageRef.current = null;
        if (!controller.signal.aborted) setIsLoadingMore(false);
      }
    }
  }, [meta.totalPages, query]);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || !hasMore || loadMoreError) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadMoreProducts();
        }
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loadMoreError, loadMoreProducts]);

  useEffect(
    () => () => {
      abortControllerRef.current?.abort();
    },
    [],
  );

  const updateUrl = useCallback(
    (updates: Record<string, string | number | null | undefined>) => {
      const params = new URLSearchParams(serializedParams);
      for (const [key, value] of Object.entries(updates)) {
        if (value == null || value === "" || value === 0) params.delete(key);
        else params.set(key, String(value));
      }
      const next = params.toString();
      startTransition(() => {
        router.push(next ? `${pathname}?${next}` : pathname);
      });
    },
    [pathname, router, serializedParams, startTransition],
  );

  const handleFiltersChange = (next: CatalogFilterState) => {
    setMobileFilterOpen(false);
    updateUrl({
      categoryPath: next.categoryPath,
      brandSlug: next.brandSlug,
      manufacturerSlug: next.manufacturerSlug,
      minPrice: next.minPrice,
      maxPrice: next.maxPrice,
      stock: next.stock,
      minRating: next.minRating,
      page: null,
    });
  };

  const resetFilters = () => {
    setMobileFilterOpen(false);
    updateUrl({
      categoryPath: null,
      brandSlug: null,
      manufacturerSlug: null,
      minPrice: null,
      maxPrice: null,
      stock: null,
      minRating: null,
      page: null,
    });
  };

  const activeFilterCount = [
    filters.categoryPath,
    filters.brandSlug,
    filters.manufacturerSlug,
    filters.minPrice,
    filters.maxPrice,
    filters.stock,
    filters.minRating,
  ].filter((value) => value !== "" && value != null && value !== 0).length;

  return (
    <div className="min-h-screen bg-brand-light-bg">
      <div className="mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-6 lg:px-6">
        <div className="mb-4 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-gray-950 [overflow-wrap:anywhere] sm:text-3xl">
            {query.search ? i18n("Results for “{query}”", { query: query.search }) : i18n("All products")}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {i18n("Browse the catalog with live availability and verified customer ratings.")}</p>
          <ActiveFilterChips
            query={query.search}
            filters={filters}
            facets={facets}
            onRemove={(key) => updateUrl({ [key]: null, page: null })}
          />
        </div>

        <div className="flex gap-5">
          <div
            className={cn(
              "hidden shrink-0 overflow-hidden transition-[width,opacity,margin] duration-300 ease-in-out lg:block",
              sidebarOpen ? "w-64 opacity-100" : "-ms-5 w-0 opacity-0",
            )}
            aria-hidden={!sidebarOpen}
          >
            <div className="w-64">
              <FilterSidebar
                filters={filters}
                onChange={handleFiltersChange}
                onReset={resetFilters}
                facets={facets}
              />
            </div>
          </div>

          <main className="min-w-0 flex-1">
            <PublicContentNotice available={!products.some(product=>product.translationAvailable===false)}/>
            <ProductToolbar
              resultsCount={products.length}
              totalCount={meta.total}
              pageSize={meta.pageSize}
              activeFilterCount={activeFilterCount}
              sort={query.sort}
              onSortChange={(sort: ProductSortOption) =>
                updateUrl({ sort: sort === "popular" ? null : sort, page: null })
              }
              onPageSizeChange={(pageSize) =>
                updateUrl({
                  pageSize: pageSize === PRODUCTS_PAGE_SIZE ? null : pageSize,
                  page: null,
                })
              }
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              onOpenMobileFilter={() => setMobileFilterOpen(true)}
              sidebarOpen={sidebarOpen}
              onToggleSidebar={() => setSidebarOpen((open) => !open)}
            />

            {isPending ? (
              <div aria-busy="true" aria-label={i18n("Loading products")} className="mt-4">
                <ProductGridSkeleton wide={!sidebarOpen} />
              </div>
            ) : (
              <>
                <ProductsGrid
                  products={products}
                  viewMode={viewMode}
                  onClearFilters={resetFilters}
                  wide={!sidebarOpen}
                />
                <div
                  ref={loadMoreRef}
                  className="mt-6 flex min-h-12 items-center justify-center"
                  aria-live="polite"
                >
                  {isLoadingMore ? (
                    <div
                      role="status"
                      className="flex items-center gap-2 text-sm font-medium text-gray-600"
                    >
                      <LoaderCircle
                        className="h-5 w-5 animate-spin text-brand-red"
                        aria-hidden="true"
                      />
                      {i18n("Loading more products…")}</div>
                  ) : loadMoreError ? (
                    <div className="text-center">
                      <p
                        role="alert"
                        className="text-sm text-red-600 [overflow-wrap:anywhere]"
                      >
                        {loadMoreError}
                      </p>
                      <button
                        type="button"
                        onClick={() => void loadMoreProducts()}
                        className="mt-2 rounded-lg border border-brand-red px-3 py-1.5 text-sm font-semibold text-brand-red transition-colors hover:bg-brand-red hover:text-white"
                      >
                        {i18n("Try again")}</button>
                    </div>
                  ) : !hasMore && products.length > 0 ? (
                    <p className="text-sm text-gray-500">
                      {i18n("You’ve reached the end of the products.")}</p>
                  ) : null}
                </div>
              </>
            )}
          </main>
        </div>
      </div>

      <MobileFilterDrawer
        open={mobileFilterOpen}
        onClose={() => setMobileFilterOpen(false)}
        filters={filters}
        onChange={handleFiltersChange}
        onReset={resetFilters}
        facets={facets}
      />
    </div>
  );
}

function ActiveFilterChips({
  query,
  filters,
  facets,
  onRemove,
}: {
  query: string;
  filters: CatalogFilterState;
  facets: CatalogFacets;
  onRemove: (key: string) => void;
}) {
  const i18n = useInterfaceTranslations("InterfaceProductsComponentsProductsExplorer");
  const categoryName = (() => {
    const stack = [...facets.categories];
    while (stack.length > 0) {
      const category = stack.shift();
      if (!category) continue;
      if (category.path === filters.categoryPath) return category.name;
      stack.push(...category.children);
    }
    return filters.categoryPath;
  })();
  const chips = [
    query ? { key: "search", label: `Search: ${query}` } : null,
    filters.categoryPath
      ? { key: "categoryPath", label: `Category: ${categoryName}` }
      : null,
    filters.brandSlug
      ? {
          key: "brandSlug",
          label: `Brand: ${facets.brands.find((brand) => brand.slug === filters.brandSlug)?.name ?? filters.brandSlug}`,
        }
      : null,
    filters.manufacturerSlug
      ? {
          key: "manufacturerSlug",
          label: `Manufacturer: ${facets.manufacturers.find((item) => item.slug === filters.manufacturerSlug)?.name ?? filters.manufacturerSlug}`,
        }
      : null,
    filters.minPrice != null
      ? {
          key: "minPrice",
          label: (
            <>
              {i18n("From")}<CurrencyAmount amountUSD={filters.minPrice} />
            </>
          ),
          ariaLabel: i18n("Remove minimum price filter"),
        }
      : null,
    filters.maxPrice != null
      ? {
          key: "maxPrice",
          label: (
            <>
              {i18n("Up to")}<CurrencyAmount amountUSD={filters.maxPrice} />
            </>
          ),
          ariaLabel: i18n("Remove maximum price filter"),
        }
      : null,
    filters.stock ? { key: "stock", label: filters.stock === "in-stock" ? "In stock" : "Out of stock" } : null,
    filters.minRating
      ? { key: "minRating", label: `${filters.minRating}+ stars` }
      : null,
  ].filter((chip): chip is NonNullable<typeof chip> => Boolean(chip));

  if (chips.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2" aria-label={i18n("Active product filters")}>
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={() => onRemove(chip.key)}
          className="inline-flex max-w-full min-w-0 items-center gap-1 rounded-full border border-brand-red/20 bg-white px-2.5 py-1 text-start text-xs font-medium text-gray-700 transition-colors hover:border-brand-red hover:text-brand-red"
          aria-label={
            "ariaLabel" in chip && typeof chip.ariaLabel === "string"
              ? chip.ariaLabel
              : i18n("Remove filter")
          }
        >
          <span className="min-w-0 truncate">{typeof chip.label === "string" ? i18n(chip.label) : chip.label}</span>
          <X className="h-3 w-3 shrink-0" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
