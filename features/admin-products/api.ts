import { readApiError } from "@/features/http/api-envelope";

export type ProductStatus = "ACTIVE" | "INACTIVE";
export type ProductCondition = "NEW" | "REFURBISHED" | "USED";
export type AttributeMap = Record<string, string>;
export type SpecificationMap = Record<string, string | number | boolean>;

export type AdminVariant = {
  id?: string;
  variantKey: string;
  name: string | null;
  size: string | null;
  color: string | null;
  modelNumber: string | null;
  sku: string | null;
  stock: number;
  image: string | null;
  attributes: AttributeMap | null;
  attributeSummary: string | null;
  isActive: boolean;
};

export type AdminCatalogReference = {
  id: string;
  name: string;
  slug: string;
  status: "ACTIVE" | "INACTIVE";
};

export type AdminProduct = {
  id: string;
  productCode: string;
  name: string;
  slug: string;
  description: string | null;
  /** Structured description blocks (JSON). null when using legacy description. */
  descriptionBlocks: unknown | null;
  seoTitle: string | null;
  metaDescription: string | null;
  ogImage: string | null;
  gtin: string | null;
  itemCondition: ProductCondition;
  modelNumber: string | null;
  series: string | null;
  specifications: SpecificationMap | null;
  buyingPrice: number;
  salePrice: number;
  discountPrice: number | null;
  image: string | null;
  primaryImageAlt: string | null;
  images: string[];
  rating: number;
  reviewCount: number;
  status: ProductStatus;
  stock: number;
  variants: AdminVariant[];
  createdAt: string;
  categoryId: string;
  categoryBreadcrumb: CategoryBreadcrumb[];
  category: {
    id: string;
    name: string;
    slug: string;
    path: string;
    depth: number;
    image: string | null;
  };
  brandId: string | null;
  brand: AdminCatalogReference | null;
  manufacturerId: string | null;
  manufacturer: (AdminCatalogReference & { country?: string | null }) | null;
};

export type CategoryBreadcrumb = {
  id: string;
  name: string;
  slug: string;
  path: string;
};

export type CategoryOption = {
  id: string;
  name: string;
  label: string;
  path: string;
  depth: number;
  parentId: string | null;
  status: "ACTIVE" | "INACTIVE";
};

export type KeyValueFormRow = { key: string; value: string };

export type VariantFormRow = {
  id?: string;
  name: string;
  size: string;
  color: string;
  modelNumber: string;
  sku: string;
  stock: string;
  image: string;
  attributes: KeyValueFormRow[];
  isActive: boolean;
};

export type ProductFormState = {
  name: string;
  slug: string;
  description: string;
  seoTitle: string;
  metaDescription: string;
  ogImage: string;
  gtin: string;
  itemCondition: ProductCondition;
  primaryImageAlt: string;
  modelNumber: string;
  series: string;
  buyingPrice: string;
  salePrice: string;
  discountPrice: string;
  image: string;
  images: string;
  status: ProductStatus;
  categoryId: string;
  brandId: string;
  manufacturerId: string;
  specifications: KeyValueFormRow[];
  variants: VariantFormRow[];
  /** Structured block-based description. Serialised as JSON string for the API. */
  descriptionBlocks: unknown[];
};

export type ApiMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  meta?: ApiMeta;
};

type UnknownRecord = Record<string, unknown>;

export const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1542838132-92c53300491e?w=400";
const API_PAGE_SIZE = 100;

export function makeEmptyKeyValue(): KeyValueFormRow {
  return { key: "", value: "" };
}

export function makeEmptyVariant(): VariantFormRow {
  return {
    name: "",
    size: "",
    color: "",
    modelNumber: "",
    sku: "",
    stock: "0",
    image: "",
    attributes: [],
    isActive: true,
  };
}

export const EMPTY_FORM: ProductFormState = {
  name: "",
  slug: "",
  description: "",
  seoTitle: "",
  metaDescription: "",
  ogImage: "",
  gtin: "",
  itemCondition: "NEW",
  primaryImageAlt: "",
  modelNumber: "",
  series: "",
  buyingPrice: "",
  salePrice: "",
  discountPrice: "",
  image: "",
  images: "",
  status: "ACTIVE",
  categoryId: "",
  brandId: "",
  manufacturerId: "",
  specifications: [],
  variants: [makeEmptyVariant()],
  descriptionBlocks: [],
};

function record(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function string(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function number(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const direct = string(entry);
    if (direct) return [direct];
    const row = record(entry);
    const url = string(row?.url);
    return url ? [url] : [];
  });
}

function stringMap(value: unknown): AttributeMap | null {
  const row = record(value);
  if (!row) return null;
  const entries = Object.entries(row).flatMap(([key, item]) => {
    const parsed = string(item);
    return key.trim() && parsed ? [[key, parsed] as const] : [];
  });
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

function specificationMap(value: unknown): SpecificationMap | null {
  const row = record(value);
  if (!row) return null;
  const entries = Object.entries(row).filter(
    (entry): entry is [string, string | number | boolean] =>
      entry[0].trim().length > 0 &&
      (typeof entry[1] === "string" ||
        typeof entry[1] === "number" ||
        typeof entry[1] === "boolean"),
  );
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

function breadcrumb(value: unknown): CategoryBreadcrumb[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const row = record(entry);
    const id = string(row?.id);
    const name = string(row?.name);
    const slug = string(row?.slug);
    const path = string(row?.path);
    return id && name && slug && path ? [{ id, name, slug, path }] : [];
  });
}

function catalogReference(value: unknown): AdminCatalogReference | null {
  const row = record(value);
  const id = string(row?.id);
  const name = string(row?.name);
  const slug = string(row?.slug);
  if (!id || !name || !slug) return null;
  return {
    id,
    name,
    slug,
    status: row?.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
  };
}

function variants(value: unknown): AdminVariant[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const row = record(entry);
    if (!row) return [];
    return [{
      id: string(row.id) ?? undefined,
      variantKey: string(row.variantKey) ?? "default",
      name: string(row.name),
      size: string(row.size),
      color: string(row.color),
      modelNumber: string(row.modelNumber),
      sku: string(row.sku),
      stock: number(row.stock) ?? 0,
      image: string(row.image),
      attributes: stringMap(row.attributes),
      attributeSummary: string(row.attributeSummary),
      isActive: row.isActive !== false,
    }];
  });
}

export function parseProductsPayload(payload: unknown): AdminProduct[] {
  const envelope = payload as ApiEnvelope<unknown>;
  if (!envelope?.success || !Array.isArray(envelope.data)) {
    throw new Error("Products API returned an invalid response.");
  }

  return envelope.data.map((entry) => {
    const row = record(entry);
    if (!row) throw new Error("Products API returned an invalid product row.");
    const category = record(row.category) ?? {};
    const categoryId = string(row.categoryId) ?? string(category.id) ?? "";
    const images = stringArray(row.images);
    const categoryBreadcrumb = breadcrumb(row.categoryBreadcrumb);
    const brand = catalogReference(row.brand);
    const baseManufacturer = catalogReference(row.manufacturer);
    const manufacturerRecord = record(row.manufacturer);
    const manufacturer = baseManufacturer
      ? { ...baseManufacturer, country: string(manufacturerRecord?.country) }
      : null;

    return {
      id: string(row.id) ?? "",
      productCode: string(row.productCode) ?? "",
      name: string(row.name) ?? "Untitled Product",
      slug: string(row.slug) ?? "",
      description: string(row.description),
      descriptionBlocks: Array.isArray(row.descriptionBlocks) ? row.descriptionBlocks : null,
      seoTitle: string(row.seoTitle),
      metaDescription: string(row.metaDescription),
      ogImage: string(row.ogImage),
      gtin: string(row.gtin),
      itemCondition:
        row.itemCondition === "REFURBISHED" || row.itemCondition === "USED"
          ? row.itemCondition
          : "NEW",
      modelNumber: string(row.modelNumber),
      series: string(row.series),
      specifications: specificationMap(row.specifications),
      buyingPrice: number(row.buyingPrice) ?? 0,
      salePrice: number(row.salePrice ?? row.price) ?? 0,
      discountPrice: number(row.discountPrice),
      image: string(row.image) ?? images[0] ?? null,
      primaryImageAlt: string(row.imageAlt),
      images,
      rating: number(row.rating) ?? 0,
      reviewCount: number(row.reviewCount) ?? 0,
      status: row.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
      stock: number(row.stock) ?? 0,
      variants: variants(row.variants),
      createdAt: string(row.createdAt) ?? new Date(0).toISOString(),
      categoryId,
      categoryBreadcrumb,
      category: {
        id: categoryId,
        name: string(category.name) ?? "Uncategorized",
        slug: string(category.slug) ?? "",
        path: string(category.path) ?? string(category.slug) ?? "",
        depth: number(category.depth) ?? 0,
        image: string(category.image),
      },
      brandId: string(row.brandId) ?? brand?.id ?? null,
      brand,
      manufacturerId:
        string(row.manufacturerId) ?? manufacturer?.id ?? null,
      manufacturer,
    };
  });
}

export function parseCategoriesPayload(payload: unknown): CategoryOption[] {
  const envelope = payload as ApiEnvelope<unknown>;
  if (!envelope?.success || !Array.isArray(envelope.data)) {
    throw new Error("Categories API returned an invalid response.");
  }

  return envelope.data.flatMap((entry) => {
    const row = record(entry);
    const id = string(row?.id);
    const name = string(row?.name);
    const path = string(row?.path);
    if (!id || !name || !path || row?.effectiveActive === false) return [];
    const ancestors = breadcrumb(row?.breadcrumb).map((item) => item.name);
    return [{
      id,
      name,
      label: [...ancestors, name].join(" › "),
      path,
      depth: number(row?.depth) ?? 0,
      parentId: string(row?.parentId),
      status: row?.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
    }];
  });
}

async function json(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

export async function fetchAllProductsSnapshot(): Promise<AdminProduct[]> {
  const merged: AdminProduct[] = [];
  let page = 1;
  let totalPages = 1;
  while (page <= totalPages) {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(API_PAGE_SIZE),
      sort: "latest",
    });
    const response = await fetch(`/api/products?${params}`, { cache: "no-store" });
    const payload = await json(response);
    if (!response.ok) throw new Error(readApiError(payload, "Failed to load products."));
    const rows = parseProductsPayload(payload);
    merged.push(...rows);
    totalPages = (payload as ApiEnvelope<unknown>)?.meta?.totalPages ?? 1;
    page += 1;
  }
  return merged;
}

export async function fetchActiveCategories(): Promise<CategoryOption[]> {
  const params = new URLSearchParams({
    status: "ACTIVE",
    view: "flat",
    withCounts: "true",
    page: "1",
    pageSize: "500",
    sort: "position",
  });
  const response = await fetch(`/api/categories?${params}`, { cache: "no-store" });
  const payload = await json(response);
  if (!response.ok) throw new Error(readApiError(payload, "Failed to load categories."));
  return parseCategoriesPayload(payload).filter((category) => category.status === "ACTIVE");
}

export function normalizeImagesInput(input: string): string[] {
  return Array.from(new Set(input.split(/[\n,]+/).map((item) => item.trim()).filter(Boolean)));
}

export function rowsToStringMap(rows: KeyValueFormRow[]): AttributeMap | null {
  const result: AttributeMap = {};
  for (const row of rows) {
    const key = row.key.trim();
    const value = row.value.trim();
    if (key && value) result[key] = value;
  }
  return Object.keys(result).length > 0 ? result : null;
}

function mapToRows(value: Record<string, unknown> | null): KeyValueFormRow[] {
  return value
    ? Object.entries(value).map(([key, item]) => ({ key, value: String(item) }))
    : [];
}

export function buildFormFromProduct(product: AdminProduct): ProductFormState {
  return {
    name: product.name,
    slug: product.slug,
    description: product.description ?? "",
    seoTitle: product.seoTitle ?? "",
    metaDescription: product.metaDescription ?? "",
    ogImage: product.ogImage ?? "",
    gtin: product.gtin ?? "",
    itemCondition: product.itemCondition,
    primaryImageAlt: product.primaryImageAlt ?? "",
    modelNumber: product.modelNumber ?? "",
    series: product.series ?? "",
    buyingPrice: String(product.buyingPrice),
    salePrice: String(product.salePrice),
    discountPrice: product.discountPrice === null ? "" : String(product.discountPrice),
    image: product.image ?? "",
    images: product.images.join("\n"),
    status: product.status,
    categoryId: product.categoryId,
    brandId: product.brandId ?? "",
    manufacturerId: product.manufacturerId ?? "",
    specifications: mapToRows(product.specifications),
    variants: product.variants.length > 0
      ? product.variants.map((variant) => ({
          id: variant.id,
          name: variant.name ?? "",
          size: variant.size ?? "",
          color: variant.color ?? "",
          modelNumber: variant.modelNumber ?? "",
          sku: variant.sku ?? "",
          stock: String(variant.stock),
          image: variant.image ?? "",
          attributes: mapToRows(variant.attributes),
          isActive: variant.isActive,
        }))
      : [makeEmptyVariant()],
    descriptionBlocks: Array.isArray(product.descriptionBlocks) ? (product.descriptionBlocks as unknown[]) : [],
  };
}

export function parseNumericField(raw: string, field: string): number {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error(`${field} is required.`);
  const value = Number(trimmed);
  if (!Number.isFinite(value)) throw new Error(`${field} must be a valid number.`);
  return value;
}

export function categoryLabel(product: AdminProduct): string {
  return product.categoryBreadcrumb.length > 0
    ? product.categoryBreadcrumb.map((item) => item.name).join(" › ")
    : product.category.name;
}
