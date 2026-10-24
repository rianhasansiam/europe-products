import type { ProductQueryInput } from "@/lib/validations/product.validation";

export const PRODUCTS_PAGE_SIZE = 12;
export const MAX_PRODUCTS_PAGE = 10_000;

const SORT_OPTIONS = new Set<ProductQueryInput["sort"]>([
  "popular",
  "price-low",
  "price-high",
  "rating",
  "latest",
]);

export type ProductsPageQuery = Omit<
  ProductQueryInput,
  | "search"
  | "categoryPath"
  | "brandSlug"
  | "manufacturerSlug"
  | "minPrice"
  | "maxPrice"
  | "stock"
  | "minRating"
> & {
  search: string;
  categoryPath: string;
  brandSlug: string;
  manufacturerSlug: string;
  minPrice: number | null;
  maxPrice: number | null;
  stock: "" | "in-stock" | "out-of-stock";
  minRating: number;
};

type SearchParamSource = URLSearchParams | Record<string, string | string[] | undefined>;

function value(source: SearchParamSource, key: string): string | null {
  if (source instanceof URLSearchParams) return source.get(key);
  const candidate = source[key];
  return Array.isArray(candidate) ? (candidate[0] ?? null) : (candidate ?? null);
}

function positiveInteger(
  input: string | null,
  fallback: number,
  max = Number.MAX_SAFE_INTEGER,
): number {
  const parsed = Number(input);
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= max
    ? parsed
    : fallback;
}

function optionalNonNegative(input: string | null): number | null {
  if (input == null || input.trim() === "") return null;
  const parsed = Number(input);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function parseProductsPageQuery(source: SearchParamSource): ProductsPageQuery {
  const rawSort = value(source, "sort") as ProductQueryInput["sort"] | null;
  const rawStock = value(source, "stock");
  const requestedPageSize = positiveInteger(
    value(source, "pageSize"),
    PRODUCTS_PAGE_SIZE,
  );
  const pageSize = [12, 24, 48].includes(requestedPageSize)
    ? requestedPageSize
    : PRODUCTS_PAGE_SIZE;
  const parsedMinPrice = optionalNonNegative(value(source, "minPrice"));
  const parsedMaxPrice = optionalNonNegative(value(source, "maxPrice"));
  const hasContradictoryPriceRange =
    parsedMinPrice != null &&
    parsedMaxPrice != null &&
    parsedMinPrice > parsedMaxPrice;

  return {
    search: (value(source, "search") ?? "").trim().slice(0, 150),
    categoryPath: (value(source, "categoryPath") ?? "").trim().slice(0, 1000),
    brandSlug: (value(source, "brandSlug") ?? "").trim().slice(0, 160),
    manufacturerSlug: (value(source, "manufacturerSlug") ?? "")
      .trim()
      .slice(0, 160),
    minPrice: hasContradictoryPriceRange ? null : parsedMinPrice,
    maxPrice: hasContradictoryPriceRange ? null : parsedMaxPrice,
    stock:
      rawStock === "in-stock" || rawStock === "out-of-stock"
        ? rawStock
        : "",
    minRating: Math.min(5, optionalNonNegative(value(source, "minRating")) ?? 0),
    sort: rawSort && SORT_OPTIONS.has(rawSort) ? rawSort : "popular",
    page: positiveInteger(value(source, "page"), 1, MAX_PRODUCTS_PAGE),
    pageSize,
  };
}

export function toProductQueryInput(query: ProductsPageQuery): ProductQueryInput {
  return {
    page: query.page,
    pageSize: query.pageSize,
    sort: query.sort,
    search: query.search || undefined,
    categoryPath: query.categoryPath || undefined,
    brandSlug: query.brandSlug || undefined,
    manufacturerSlug: query.manufacturerSlug || undefined,
    minPrice: query.minPrice ?? undefined,
    maxPrice: query.maxPrice ?? undefined,
    stock: query.stock || undefined,
    minRating: query.minRating || undefined,
  };
}

const CONTROLLED_KEYS = new Set([
  "page",
  "pageSize",
  "search",
  "categoryPath",
  "brandSlug",
  "manufacturerSlug",
  "minPrice",
  "maxPrice",
  "stock",
  "minRating",
  "sort",
]);

const FILTER_KEYS = new Set([
  "pageSize",
  "search",
  "categoryPath",
  "brandSlug",
  "manufacturerSlug",
  "minPrice",
  "maxPrice",
  "stock",
  "minRating",
  "sort",
]);

export function productsPageIndexingPolicy(
  source: Record<string, string | string[] | undefined>,
): { index: boolean; canonicalPath: string; hasUncontrolledParams: boolean } {
  const keys = Object.keys(source).filter((key) => value(source, key) != null);
  const hasUnknown = keys.some((key) => !CONTROLLED_KEYS.has(key));
  const hasFilter = keys.some((key) => FILTER_KEYS.has(key));
  const pageValue = value(source, "page");
  const page = positiveInteger(pageValue, 1, MAX_PRODUCTS_PAGE);
  const rawPage = source.page;
  const hasRepeatedPage = Array.isArray(rawPage) && rawPage.length !== 1;
  const hasInvalidPage =
    pageValue !== null &&
    (!/^[1-9]\d*$/.test(pageValue) ||
      page > MAX_PRODUCTS_PAGE ||
      String(page) !== pageValue);
  const hasNoisyParams =
    hasUnknown || hasFilter || hasRepeatedPage || hasInvalidPage;
  const paginatedPath = page > 1 ? `/products?page=${page}` : "/products";
  const canonicalPath =
    hasFilter || hasRepeatedPage || hasInvalidPage ? "/products" : paginatedPath;

  return {
    index: !hasNoisyParams,
    // Unknown parameters (including tracking parameters) make the URL
    // non-indexable, but they must not erase a valid pagination signal.
    canonicalPath,
    hasUncontrolledParams: hasNoisyParams,
  };
}

/** Preserve active controls while replacing an out-of-range page value. */
export function productsPagePathForActualPage(
  source: Record<string, string | string[] | undefined>,
  page: number,
): string {
  const params = new URLSearchParams();
  for (const [key, raw] of Object.entries(source)) {
    if (key === "page" || raw == null) continue;
    const first = Array.isArray(raw) ? raw[0] : raw;
    if (first != null) params.set(key, first);
  }
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/products?${query}` : "/products";
}
