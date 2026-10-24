import { readApiError } from "@/features/http/api-envelope";

export type CategoryStatus = "ACTIVE" | "INACTIVE";

export type CategoryBreadcrumb = {
  id: string;
  name: string;
  path: string;
};

export type AdminCategoryRow = {
  id: string;
  name: string;
  slug: string;
  path: string;
  description: string | null;
  image: string | null;
  seoTitle: string | null;
  metaDescription: string | null;
  ogImage: string | null;
  status: CategoryStatus;
  effectiveActive: boolean;
  parentId: string | null;
  depth: number;
  position: number;
  breadcrumb: CategoryBreadcrumb[];
  childCount: number;
  directProductCount: number;
  totalProductCount: number;
  /** Compatibility alias used by older admin widgets. */
  productCount: number;
  createdAt: string;
  updatedAt: string;
};

export type AdminCategoryTreeNode = AdminCategoryRow & {
  children: AdminCategoryTreeNode[];
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

export const API_PAGE_SIZE = 100;
export const STATUS_VALUES: readonly CategoryStatus[] = ["ACTIVE", "INACTIVE"];

export type CategoryFormState = {
  name: string;
  description: string;
  image: string;
  seoTitle: string;
  metaDescription: string;
  ogImage: string;
  status: CategoryStatus;
  parentId: string;
  position: string;
};

export const EMPTY_FORM: CategoryFormState = {
  name: "",
  description: "",
  image: "",
  seoTitle: "",
  metaDescription: "",
  ogImage: "",
  status: "ACTIVE",
  parentId: "",
  position: "0",
};

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as UnknownRecord;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseStatus(value: unknown): CategoryStatus {
  return value === "INACTIVE" ? "INACTIVE" : "ACTIVE";
}

function parseBreadcrumb(value: unknown): CategoryBreadcrumb[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const row = asRecord(entry);
    if (!row) return [];
    return [{ id: asString(row.id), name: asString(row.name), path: asString(row.path) }];
  });
}

function parseRow(entry: unknown): AdminCategoryRow {
  const item = asRecord(entry) ?? {};
  const status = parseStatus(item.status);
  const directProductCount = asNumber(
    item.directProductCount ?? item.productCount,
  );

  return {
    id: asString(item.id),
    name: asString(item.name),
    slug: asString(item.slug),
    path: asString(item.path) || asString(item.slug),
    description: asNullableString(item.description),
    image: asNullableString(item.image),
    seoTitle: asNullableString(item.seoTitle),
    metaDescription: asNullableString(item.metaDescription),
    ogImage: asNullableString(item.ogImage),
    status,
    effectiveActive:
      typeof item.effectiveActive === "boolean"
        ? item.effectiveActive
        : status === "ACTIVE",
    parentId: asNullableString(item.parentId),
    depth: asNumber(item.depth),
    position: asNumber(item.position),
    breadcrumb: parseBreadcrumb(item.breadcrumb ?? item.ancestors),
    childCount: asNumber(item.childCount),
    directProductCount,
    totalProductCount: asNumber(item.totalProductCount ?? directProductCount),
    productCount: directProductCount,
    createdAt: asString(item.createdAt),
    updatedAt: asString(item.updatedAt),
  };
}

export function parseCategoriesPayload(payload: unknown): {
  items: AdminCategoryRow[];
  meta: ApiMeta | null;
} {
  const envelope = payload as ApiEnvelope<unknown>;
  if (!envelope?.success || !Array.isArray(envelope.data)) {
    throw new Error("Categories API returned an invalid response.");
  }

  return {
    items: envelope.data.map(parseRow),
    meta: envelope.meta ?? null,
  };
}

export async function fetchAllAdminCategoriesSnapshot(): Promise<AdminCategoryRow[]> {
  let page = 1;
  let totalPages = 1;
  const merged: AdminCategoryRow[] = [];

  while (page <= totalPages) {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(API_PAGE_SIZE),
      view: "flat",
      withCounts: "true",
      withProductCount: "true",
    });

    const response = await fetch(`/api/categories?${params.toString()}`, {
      cache: "no-store",
    });
    const payload = await readPayload(response, "Failed to parse categories response.");
    if (!response.ok) {
      throw new Error(readApiError(payload, "Failed to load categories."));
    }

    const { items, meta } = parseCategoriesPayload(payload);
    merged.push(...items);
    totalPages = meta?.totalPages ?? 1;
    page += 1;
  }

  return merged.sort(compareCategories);
}

async function readPayload(response: Response, fallback: string): Promise<unknown> {
  try {
    return (await response.json()) as unknown;
  } catch {
    throw new Error(fallback);
  }
}

type CategoryMutationBody = {
  name: string;
  description: string | null;
  image: string | null;
  seoTitle: string | null;
  metaDescription: string | null;
  ogImage: string | null;
  status: CategoryStatus;
  parentId: string | null;
  position: number;
};

async function categoryMutation(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: Partial<CategoryMutationBody>,
): Promise<AdminCategoryRow> {
  const response = await fetch(url, {
    method,
    ...(body
      ? {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
    cache: "no-store",
  });
  const payload = await readPayload(response, "Failed to parse category response.");
  if (!response.ok) {
    throw new Error(readApiError(payload, `Failed to ${method.toLowerCase()} category.`));
  }
  const envelope = payload as ApiEnvelope<unknown>;
  if (!envelope?.success) {
    throw new Error(readApiError(payload, "Category request failed."));
  }
  return parseRow(envelope.data);
}

export function createCategory(body: CategoryMutationBody) {
  return categoryMutation("/api/categories", "POST", body);
}

export function updateCategory(
  categoryId: string,
  body: Partial<CategoryMutationBody>,
) {
  return categoryMutation(`/api/categories/${categoryId}`, "PATCH", body);
}

export function deleteCategory(categoryId: string) {
  return categoryMutation(`/api/categories/${categoryId}`, "DELETE");
}

export async function reorderCategories(
  parentId: string | null,
  orderedIds: string[],
): Promise<void> {
  const response = await fetch("/api/categories/reorder", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ parentId, orderedIds }),
    cache: "no-store",
  });
  const payload = await readPayload(response, "Failed to parse reorder response.");
  if (!response.ok) {
    throw new Error(readApiError(payload, "Failed to reorder categories."));
  }
}

export function buildFormFromCategory(category: AdminCategoryRow): CategoryFormState {
  return {
    name: category.name,
    description: category.description ?? "",
    image: category.image ?? "",
    seoTitle: category.seoTitle ?? "",
    metaDescription: category.metaDescription ?? "",
    ogImage: category.ogImage ?? "",
    status: category.status,
    parentId: category.parentId ?? "",
    position: String(category.position),
  };
}

export function compareCategories(a: AdminCategoryRow, b: AdminCategoryRow): number {
  if (a.parentId === b.parentId) {
    return a.position - b.position || a.name.localeCompare(b.name);
  }
  return a.path.localeCompare(b.path);
}

export function buildCategoryTree(categories: AdminCategoryRow[]): AdminCategoryTreeNode[] {
  const nodes = new Map<string, AdminCategoryTreeNode>();
  for (const category of categories) nodes.set(category.id, { ...category, children: [] });

  const roots: AdminCategoryTreeNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : null;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  const sortNodes = (items: AdminCategoryTreeNode[]) => {
    items.sort(compareCategories);
    for (const item of items) sortNodes(item.children);
  };
  sortNodes(roots);
  return roots;
}

export function getDescendantIds(
  categories: AdminCategoryRow[],
  categoryId: string,
): Set<string> {
  const descendants = new Set<string>();
  const pending = [categoryId];
  while (pending.length > 0) {
    const parentId = pending.pop();
    for (const category of categories) {
      if (category.parentId === parentId && !descendants.has(category.id)) {
        descendants.add(category.id);
        pending.push(category.id);
      }
    }
  }
  return descendants;
}

export function categoryLabel(category: AdminCategoryRow): string {
  const names = category.breadcrumb.map((item) => item.name);
  if (names[names.length - 1] !== category.name) names.push(category.name);
  return names.length > 1 ? names.join(" › ") : category.name;
}

export function formatDate(value: string | null | undefined, locale = "en"): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}
