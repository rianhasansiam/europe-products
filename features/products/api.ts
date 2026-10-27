import { readApiError } from "@/features/http/api-envelope";
import { addActiveApiLocale } from "@/lib/i18n/api-locale";

export type ProductSortOption =
  | "popular"
  | "price-low"
  | "price-high"
  | "rating"
  | "latest";

export type CategoryBreadcrumbItem = {
  id: string;
  name: string;
  slug: string;
  path: string;
};

export type Product = {
  id: string;
  slug: string;
  productCode: string;
  name: string;
  description: string | null;
  modelNumber: string | null;
  series: string | null;
  specifications: Record<string, string | number | boolean> | null;
  price: number;
  discountPrice: number | null;
  image: string;
  images: string[];
  rating: number;
  reviewCount: number;
  badge: string | null;
  categoryId: string;
  category: string;
  categoryPath: string;
  categoryImage: string | null;
  categoryBreadcrumb: CategoryBreadcrumbItem[];
  stock: number;
  inStock: boolean;
  variantCount: number;
  createdAt: string;
  translationAvailable?: boolean;
  sourceLocale?: string;
  contentLocale?: string;
  fieldLocales?: Record<string,string>;
};

export type ApiProduct = {
  id: string;
  slug: string;
  productCode: string;
  name: string;
  description: string | null;
  price: number;
  discountPrice: number | null;
  image: string | null;
  images: string[];
  rating: number;
  reviewCount: number;
  badge: string | null;
  status: "ACTIVE" | "INACTIVE";
  stock: number;
  createdAt: string;
  categoryId: string;
  category: {
    id: string;
    name: string;
    slug?: string;
    path?: string;
    depth?: number;
    image: string | null;
  };
};

export type ApiMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type ProductListQuery = {
  search?: string;
  categoryPath?: string;
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  stock?: "in-stock" | "out-of-stock";
  minRating?: number;
  sort?: ProductSortOption;
  page?: number;
  pageSize?: number;
};

export type ProductListResult = {
  items: Product[];
  meta: ApiMeta;
};

export type CatalogCategoryFacet = {
  id: string;
  name: string;
  slug: string;
  path: string;
  depth: number;
  position: number;
  directProductCount: number;
  totalProductCount: number;
  children: CatalogCategoryFacet[];
};

export type CatalogFacets = {
  categories: CatalogCategoryFacet[];
  priceBounds: { min: number; max: number };
  availability: { inStock: number; outOfStock: number };
};

export type CatalogCategorySuggestion = {
  id: string;
  name: string;
  slug: string;
  path: string;
  depth: number;
  totalProductCount: number;
  breadcrumb: CategoryBreadcrumbItem[];
};

export type CatalogSearchResult = {
  query: string;
  products: Product[];
  categories: CatalogCategorySuggestion[];
};

type ApiResponse<T> = {
  success: boolean;
  data: T;
  meta?: Partial<ApiMeta>;
};

type UnknownRecord = Record<string, unknown>;

const FALLBACK_PRODUCT_IMAGE =
  "https://images.unsplash.com/photo-1542838132-92c53300491e?w=400";
const API_PAGE_SIZE = 100;

function asRecord(value: unknown): UnknownRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as UnknownRecord;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const output: string[] = [];
  for (const entry of value) {
    const direct = readString(entry);
    if (direct) {
      output.push(direct);
      continue;
    }
    const nested = asRecord(entry);
    const url = nested ? readString(nested.url) : null;
    if (url) output.push(url);
  }
  return output;
}

function readBreadcrumb(value: unknown): CategoryBreadcrumbItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const row = asRecord(item);
    if (!row) return [];
    const id = readString(row.id);
    const name = readString(row.name);
    const slug = readString(row.slug);
    const path = readString(row.path) ?? slug;
    if (!id || !name || !slug || !path) return [];
    return [{ id, name, slug, path }];
  });
}

function readSpecifications(
  value: unknown,
): Record<string, string | number | boolean> | null {
  const row = asRecord(value);
  if (!row) return null;
  const output: Record<string, string | number | boolean> = {};
  for (const [key, entry] of Object.entries(row)) {
    if (
      typeof entry === "string" ||
      typeof entry === "number" ||
      typeof entry === "boolean"
    ) {
      output[key] = entry;
    }
  }
  return Object.keys(output).length > 0 ? output : null;
}

export function mapApiProduct(item: unknown): Product {
  const row = asRecord(item);
  if (!row) throw new Error("Products API returned an invalid product row.");

  const categoryRecord = asRecord(row.category);
  const categoryId =
    readString(row.categoryId) ?? readString(categoryRecord?.id) ?? "";
  const categoryName =
    readString(categoryRecord?.name) ?? readString(row.category) ?? "Uncategorized";
  const categoryPath =
    readString(categoryRecord?.path) ?? readString(row.categoryPath) ?? "";
  const categoryImage = readString(categoryRecord?.image);
  const categoryBreadcrumb = readBreadcrumb(
    row.categoryBreadcrumb ?? row.breadcrumb,
  );
  const images = readStringArray(row.images);
  const image = readString(row.image) ?? images[0] ?? FALLBACK_PRODUCT_IMAGE;
  const status = row.status === "INACTIVE" ? "INACTIVE" : "ACTIVE";
  const price = readNumber(row.price ?? row.salePrice) ?? 0;
  const discountPrice = readNumber(row.discountPrice);
  const stock = readNumber(row.stock) ?? 0;
  const variantCount = Array.isArray(row.variants)
    ? row.variants.length
    : readNumber(row.variantCount) ?? 1;

  return {
    id: readString(row.id) ?? "",
    slug: readString(row.slug) ?? "",
    productCode: readString(row.productCode) ?? "",
    name: readString(row.name) ?? "Untitled Product",
    description: readString(row.description),
    modelNumber: readString(row.modelNumber),
    series: readString(row.series),
    specifications: readSpecifications(row.specifications),
    price,
    discountPrice,
    image,
    images,
    rating: readNumber(row.rating) ?? 0,
    reviewCount: readNumber(row.reviewCount) ?? 0,
    badge: readString(row.badge),
    categoryId,
    category: categoryName,
    categoryPath,
    categoryImage,
    categoryBreadcrumb,
    stock,
    inStock: stock > 0 && status === "ACTIVE",
    variantCount,
    createdAt: readString(row.createdAt) ?? new Date(0).toISOString(),
    translationAvailable: typeof row.translationAvailable === "boolean" ? row.translationAvailable : undefined,
    sourceLocale: readString(row.sourceLocale) ?? undefined,
    contentLocale: readString(row.contentLocale) ?? undefined,
    fieldLocales: asRecord(row.fieldLocales) as Record<string,string> | undefined,
  };
}

async function readResponse<T>(
  response: Response,
  fallback: string,
): Promise<ApiResponse<T>> {
  let payload: unknown;
  try {
    payload = (await response.json()) as unknown;
  } catch {
    throw new Error(fallback);
  }
  if (!response.ok) throw new Error(readApiError(payload, fallback));
  const envelope = payload as ApiResponse<T>;
  if (!envelope.success) throw new Error(fallback);
  return envelope;
}

function addQueryValue(
  params: URLSearchParams,
  key: string,
  value: string | number | undefined,
) {
  if (value === undefined || value === "") return;
  params.set(key, String(value));
}

export async function fetchProductsFromApi(
  query: ProductListQuery = {},
  options?: { signal?: AbortSignal },
): Promise<ProductListResult> {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 12;
  const params = new URLSearchParams({
    status: "ACTIVE",
    page: String(page),
    pageSize: String(pageSize),
    sort: query.sort ?? "popular",
  });
  addQueryValue(params, "search", query.search?.trim());
  addQueryValue(params, "categoryPath", query.categoryPath);
  addQueryValue(params, "categoryId", query.categoryId);
  addQueryValue(params, "minPrice", query.minPrice);
  addQueryValue(params, "maxPrice", query.maxPrice);
  addQueryValue(params, "stock", query.stock);
  addQueryValue(params, "minRating", query.minRating);

  const response = await fetch(`/api/products?${addActiveApiLocale(params).toString()}`, {
    signal: options?.signal,
  });
  const envelope = await readResponse<unknown>(response, "Failed to fetch products.");
  if (!Array.isArray(envelope.data)) {
    throw new Error("Products API returned an unexpected response.");
  }

  const items = envelope.data.map(mapApiProduct);
  const total = Number(envelope.meta?.total ?? items.length);
  return {
    items,
    meta: {
      page: Number(envelope.meta?.page ?? page),
      pageSize: Number(envelope.meta?.pageSize ?? pageSize),
      total,
      totalPages: Number(
        envelope.meta?.totalPages ?? Math.max(1, Math.ceil(total / pageSize)),
      ),
    },
  };
}

export async function fetchCatalogFacets(
  signal?: AbortSignal,
): Promise<CatalogFacets> {
  const response = await fetch(`/api/catalog/facets?${addActiveApiLocale(new URLSearchParams())}`, { signal });
  const envelope = await readResponse<unknown>(
    response,
    "Failed to load catalog filters.",
  );
  const row = asRecord(envelope.data);
  if (!row) throw new Error("Catalog filters returned an unexpected response.");

  const parseCategory = (value: unknown): CatalogCategoryFacet => {
    const category = asRecord(value) ?? {};
    return {
      id: readString(category.id) ?? "",
      name: readString(category.name) ?? "Category",
      slug: readString(category.slug) ?? "",
      path: readString(category.path) ?? readString(category.slug) ?? "",
      depth: readNumber(category.depth) ?? 0,
      position: readNumber(category.position) ?? 0,
      directProductCount: readNumber(category.directProductCount) ?? 0,
      totalProductCount: readNumber(category.totalProductCount) ?? 0,
      children: Array.isArray(category.children)
        ? category.children.map(parseCategory)
        : [],
    };
  };

  const priceBounds = asRecord(row.priceBounds);
  const availability = asRecord(row.availability);
  return {
    categories: Array.isArray(row.categories)
      ? row.categories.map(parseCategory)
      : [],
    priceBounds: {
      min: readNumber(priceBounds?.min) ?? 0,
      max: readNumber(priceBounds?.max) ?? 0,
    },
    availability: {
      inStock: readNumber(availability?.inStock) ?? 0,
      outOfStock: readNumber(availability?.outOfStock) ?? 0,
    },
  };
}

export async function searchCatalogFromApi(
  query: string,
  options?: {
    productLimit?: number;
    categoryLimit?: number;
    signal?: AbortSignal;
  },
): Promise<CatalogSearchResult> {
  const trimmed = query.trim();
  if (!trimmed) return { query: "", products: [], categories: [] };
  const params = new URLSearchParams({
    q: trimmed,
    productLimit: String(options?.productLimit ?? 6),
    categoryLimit: String(options?.categoryLimit ?? 5),
  });
  const response = await fetch(`/api/catalog/search?${addActiveApiLocale(params).toString()}`, {
    signal: options?.signal,
  });
  const envelope = await readResponse<unknown>(response, "Failed to search catalog.");
  const row = asRecord(envelope.data);
  if (!row) throw new Error("Catalog search returned an unexpected response.");

  const categories = Array.isArray(row.categories)
    ? row.categories.flatMap((item): CatalogCategorySuggestion[] => {
        const category = asRecord(item);
        if (!category) return [];
        const id = readString(category.id);
        const name = readString(category.name);
        const slug = readString(category.slug);
        const path = readString(category.path);
        if (!id || !name || !slug || !path) return [];
        return [{
          id,
          name,
          slug,
          path,
          depth: readNumber(category.depth) ?? 0,
          totalProductCount: readNumber(category.totalProductCount) ?? 0,
          breadcrumb: readBreadcrumb(category.breadcrumb),
        }];
      })
    : [];

  return {
    query: readString(row.query) ?? trimmed,
    products: Array.isArray(row.products) ? row.products.map(mapApiProduct) : [],
    categories,
  };
}

/** Backward-compatible product-only search helper. */
export async function searchProductsFromApi(
  query: string,
  options?: { limit?: number; signal?: AbortSignal },
): Promise<Product[]> {
  const result = await searchCatalogFromApi(query, {
    productLimit: options?.limit,
    categoryLimit: 1,
    signal: options?.signal,
  });
  return result.products;
}

/** Admin review picker compatibility; storefront listing does not use this. */
export async function fetchAllActiveProductsFromApi(): Promise<Product[]> {
  let page = 1;
  let totalPages = 1;
  const merged: Product[] = [];
  while (page <= totalPages) {
    const result = await fetchProductsFromApi({
      page,
      pageSize: API_PAGE_SIZE,
      sort: "latest",
    });
    merged.push(...result.items);
    totalPages = result.meta.totalPages;
    page += 1;
  }
  return merged;
}
