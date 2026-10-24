import { readApiError } from "@/features/http/api-envelope";

export type CatalogEntityKind = "brand" | "manufacturer";
export type CatalogEntityStatus = "ACTIVE" | "INACTIVE";

export type AdminCatalogEntityRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  seoTitle: string | null;
  metaDescription: string | null;
  ogImage: string | null;
  logo: string | null;
  website: string | null;
  country: string | null;
  status: CatalogEntityStatus;
  productCount: number;
  createdAt: string;
  updatedAt: string;
};

export type CatalogEntityFormState = {
  name: string;
  slug: string;
  description: string;
  seoTitle: string;
  metaDescription: string;
  ogImage: string;
  logo: string;
  website: string;
  country: string;
  status: CatalogEntityStatus;
};

export const EMPTY_CATALOG_ENTITY_FORM: CatalogEntityFormState = {
  name: "",
  slug: "",
  description: "",
  seoTitle: "",
  metaDescription: "",
  ogImage: "",
  logo: "",
  website: "",
  country: "",
  status: "ACTIVE",
};

export const CATALOG_ENTITY_STATUS_VALUES = [
  "ACTIVE",
  "INACTIVE",
] as const satisfies readonly CatalogEntityStatus[];

type ApiMeta = {
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

function endpoint(kind: CatalogEntityKind): string {
  return kind === "brand" ? "/api/brands" : "/api/manufacturers";
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function parseStatus(value: unknown): CatalogEntityStatus {
  return value === "INACTIVE" ? "INACTIVE" : "ACTIVE";
}

export function parseCatalogEntityRow(
  entry: unknown,
): AdminCatalogEntityRow {
  const item = (entry ?? {}) as Partial<AdminCatalogEntityRow>;
  return {
    id: asString(item.id),
    name: asString(item.name),
    slug: asString(item.slug),
    description: asNullableString(item.description),
    seoTitle: asNullableString(item.seoTitle),
    metaDescription: asNullableString(item.metaDescription),
    ogImage: asNullableString(item.ogImage),
    logo: asNullableString(item.logo),
    website: asNullableString(item.website),
    country: asNullableString(item.country),
    status: parseStatus(item.status),
    productCount: Math.max(0, Number(item.productCount ?? 0) || 0),
    createdAt: asString(item.createdAt),
    updatedAt: asString(item.updatedAt),
  };
}

function parseListPayload(payload: unknown): {
  items: AdminCatalogEntityRow[];
  meta: ApiMeta | null;
} {
  const envelope = payload as ApiEnvelope<unknown>;
  if (!envelope?.success || !Array.isArray(envelope.data)) {
    throw new Error("Catalog API returned an invalid response.");
  }
  return {
    items: envelope.data.map(parseCatalogEntityRow),
    meta: envelope.meta ?? null,
  };
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

export async function fetchAllCatalogEntities(
  kind: CatalogEntityKind,
): Promise<AdminCatalogEntityRow[]> {
  return fetchCatalogEntitiesSnapshot(kind);
}

async function fetchCatalogEntitiesSnapshot(
  kind: CatalogEntityKind,
  status?: CatalogEntityStatus,
): Promise<AdminCatalogEntityRow[]> {
  const merged: AdminCatalogEntityRow[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: "100",
      sort: "name",
    });
    if (status) params.set("status", status);
    const response = await fetch(`${endpoint(kind)}?${params.toString()}`, {
      method: "GET",
      cache: "no-store",
    });
    const payload = await readJson(response);
    if (!response.ok) {
      throw new Error(
        readApiError(payload, `Failed to load ${kind === "brand" ? "brands" : "manufacturers"}.`),
      );
    }
    const parsed = parseListPayload(payload);
    merged.push(...parsed.items);
    totalPages = parsed.meta?.totalPages ?? 1;
    page += 1;
  }

  return merged;
}

export type CatalogEntityOption = {
  value: string;
  label: string;
  slug: string;
};

/** Active options for product forms and public catalog filters. */
export async function fetchActiveCatalogEntityOptions(
  kind: CatalogEntityKind,
): Promise<CatalogEntityOption[]> {
  const rows = await fetchCatalogEntitiesSnapshot(kind, "ACTIVE");
  return rows.map((row) => ({
    value: row.id,
    label: row.name,
    slug: row.slug,
  }));
}

export function fetchActiveBrandOptions() {
  return fetchActiveCatalogEntityOptions("brand");
}

export function fetchActiveManufacturerOptions() {
  return fetchActiveCatalogEntityOptions("manufacturer");
}

export type CatalogEntityWriteBody = {
  name: string;
  slug?: string;
  description: string | null;
  seoTitle?: string | null;
  metaDescription?: string | null;
  ogImage?: string | null;
  logo: string | null;
  website: string | null;
  country?: string | null;
  status: CatalogEntityStatus;
};

async function writeCatalogEntity(
  kind: CatalogEntityKind,
  method: "POST" | "PATCH",
  body: CatalogEntityWriteBody | Partial<CatalogEntityWriteBody>,
  id?: string,
): Promise<AdminCatalogEntityRow> {
  const response = await fetch(`${endpoint(kind)}${id ? `/${id}` : ""}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const payload = await readJson(response);
  const fallback = `Failed to ${method === "POST" ? "create" : "update"} ${kind}.`;
  if (!response.ok) throw new Error(readApiError(payload, fallback));

  const envelope = payload as ApiEnvelope<unknown>;
  if (!envelope?.success) throw new Error(readApiError(payload, fallback));
  return parseCatalogEntityRow(envelope.data);
}

export function createCatalogEntity(
  kind: CatalogEntityKind,
  body: CatalogEntityWriteBody,
) {
  return writeCatalogEntity(kind, "POST", body);
}

export function updateCatalogEntity(
  kind: CatalogEntityKind,
  id: string,
  body: Partial<CatalogEntityWriteBody>,
) {
  return writeCatalogEntity(kind, "PATCH", body, id);
}

export async function deleteCatalogEntity(
  kind: CatalogEntityKind,
  id: string,
): Promise<void> {
  const response = await fetch(`${endpoint(kind)}/${id}`, {
    method: "DELETE",
    cache: "no-store",
  });
  if (!response.ok) {
    const payload = await readJson(response);
    throw new Error(readApiError(payload, `Failed to delete ${kind}.`));
  }
}

export function buildCatalogEntityForm(
  row: AdminCatalogEntityRow,
): CatalogEntityFormState {
  return {
    name: row.name,
    slug: row.slug,
    description: row.description ?? "",
    seoTitle: row.seoTitle ?? "",
    metaDescription: row.metaDescription ?? "",
    ogImage: row.ogImage ?? "",
    logo: row.logo ?? "",
    website: row.website ?? "",
    country: row.country ?? "",
    status: row.status,
  };
}

export function formatCatalogEntityDate(value: string, locale = "en"): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}
