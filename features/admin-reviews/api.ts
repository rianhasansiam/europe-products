import { readApiData, readApiError } from "@/features/http/api-envelope";

export type ReviewSource = "CUSTOMER" | "ADMIN";

export type AdminReviewRow = {
  id: string;
  productId: string;
  userId: string | null;
  authorName: string;
  authorImage: string | null;
  authorPhone: string | null;
  authorEmail: string | null;
  rating: number;
  title: string | null;
  comment: string | null;
  source: ReviewSource;
  verified: boolean;
  createdAt: string;
  updatedAt: string;
  product: { id: string; name: string; slug: string; productCode: string } | null;
};

export type ApiMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  meta?: ApiMeta;
};

export const API_PAGE_SIZE = 100;

export const REVIEW_SOURCE_VALUES: readonly ReviewSource[] = [
  "CUSTOMER",
  "ADMIN",
];

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function parseSource(value: unknown): ReviewSource {
  return value === "ADMIN" ? "ADMIN" : "CUSTOMER";
}

function parseProduct(value: unknown): AdminReviewRow["product"] {
  if (value == null || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  return {
    id: asString(record.id),
    name: asString(record.name),
    slug: asString(record.slug),
    productCode: asString(record.productCode),
  };
}

function parseRow(entry: unknown): AdminReviewRow {
  const item = (entry ?? {}) as Partial<AdminReviewRow> & { product?: unknown };
  return {
    id: asString(item.id),
    productId: asString(item.productId),
    userId: asNullableString(item.userId),
    authorName: asString(item.authorName),
    authorImage: asNullableString(item.authorImage),
    authorPhone: asNullableString(item.authorPhone),
    authorEmail: asNullableString(item.authorEmail),
    rating: Number(item.rating ?? 0),
    title: asNullableString(item.title),
    comment: asNullableString(item.comment),
    source: parseSource(item.source),
    verified: Boolean(item.verified),
    createdAt: asString(item.createdAt),
    updatedAt: asString(item.updatedAt),
    product: parseProduct(item.product),
  };
}

export function parseReviewsPayload(payload: unknown): {
  items: AdminReviewRow[];
  meta: ApiMeta | null;
} {
  const envelope = payload as ApiEnvelope<unknown>;
  if (!envelope?.success || !Array.isArray(envelope.data)) {
    throw new Error("Reviews API returned an invalid response.");
  }

  return {
    items: envelope.data.map(parseRow),
    meta: envelope.meta ?? null,
  };
}

/**
 * Walk every page of `/api/admin/reviews` and return the full list.
 * Same in-memory snapshot trade-off as orders/messages: a few requests
 * up front for instant client-side search and filtering afterwards.
 */
export async function fetchAllAdminReviewsSnapshot(): Promise<AdminReviewRow[]> {
  let page = 1;
  let totalPages = 1;
  const merged: AdminReviewRow[] = [];

  while (page <= totalPages) {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(API_PAGE_SIZE),
    });

    const response = await fetch(`/api/admin/reviews?${params.toString()}`, {
      method: "GET",
      cache: "no-store",
    });

    let payload: unknown;
    try {
      payload = (await response.json()) as unknown;
    } catch {
      throw new Error("Failed to parse reviews response.");
    }

    if (!response.ok) {
      throw new Error(readApiError(payload, "Failed to load reviews."));
    }

    const { items, meta } = parseReviewsPayload(payload);
    merged.push(...items);
    totalPages = meta?.totalPages ?? 1;
    page += 1;
  }

  return merged;
}

export type CreateAdminReviewPayload = {
  productId: string;
  authorName: string;
  rating: number;
  title?: string;
  comment?: string;
};

export async function createAdminReview(
  payload: CreateAdminReviewPayload,
): Promise<AdminReviewRow> {
  const response = await fetch("/api/admin/reviews", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const data = await readApiData<unknown>(
    response,
    "Failed to add the review.",
  );
  return parseRow(data);
}

export async function deleteAdminReview(reviewId: string): Promise<void> {
  const response = await fetch(`/api/admin/reviews/${reviewId}`, {
    method: "DELETE",
    cache: "no-store",
  });

  if (!response.ok) {
    let payload: unknown = null;
    try {
      payload = (await response.json()) as unknown;
    } catch {
      // ignore
    }
    throw new Error(readApiError(payload, "Failed to delete the review."));
  }
}

export function formatDateTime(value: string, locale = "en"): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(locale, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
