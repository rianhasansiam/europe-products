import { readApiError } from "@/features/http/api-envelope";

/**
 * Client-side types and fetcher for the standalone admin activity page.
 *
 * Mirrors the payload returned by `/api/admin/activities`. Kept in its
 * own feature module so the page and its components can import the
 * shapes without pulling in server-only code.
 */

export type AdminActivityKind =
  | "order"
  | "product"
  | "category"
  | "banner"
  | "message"
  | "review"
  | "testimonial"
  | "settings"
  | "capital"
  | "cost"
  | "user"
  | "courier";

export type AdminActivitySource =
  | "admin"
  | "order"
  | "order-status"
  | "user"
  | "message"
  | "capital-cost";

export type AdminActivityItem = {
  id: string;
  source: AdminActivitySource;
  kind: AdminActivityKind;
  action: string;
  target: string | null;
  targetId: string | null;
  href: string | null;
  actorId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  /** Resolved performer label from the server (name, email, fallback). */
  performedBy: string;
  createdAt: string;
};

export type AdminActivityActorOption = {
  id: string;
  name: string | null;
  email: string | null;
};

export type AdminActivityPage = {
  items: AdminActivityItem[];
  actors: AdminActivityActorOption[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

export type AdminActivityQuery = {
  page?: number;
  limit?: number;
  kind?: AdminActivityKind | "";
  source?: AdminActivitySource | "";
  actorId?: string;
  search?: string;
  from?: string;
  to?: string;
};

/**
 * Resolve the performer label for an activity. Prefers the server-resolved
 * `performedBy` label, then falls back to the raw actor fields for safety
 * (e.g. old payloads), and finally "Unknown".
 */
export function activityPerformer(item: {
  performedBy?: string | null;
  actorName: string | null;
  actorEmail: string | null;
}): string {
  return (
    item.performedBy?.trim() ||
    item.actorName?.trim() ||
    item.actorEmail?.trim() ||
    "Unknown"
  );
}

export async function fetchAdminActivities(
  params: AdminActivityQuery = {},
): Promise<AdminActivityPage> {
  const search = new URLSearchParams();
  if (params.page) search.set("page", String(params.page));
  if (params.limit) search.set("limit", String(params.limit));
  if (params.kind) search.set("kind", params.kind);
  if (params.source) search.set("source", params.source);
  if (params.actorId) search.set("actorId", params.actorId);
  if (params.search?.trim()) search.set("search", params.search.trim());
  if (params.from) search.set("from", params.from);
  if (params.to) search.set("to", params.to);

  const qs = search.toString();
  const response = await fetch(
    `/api/admin/activities${qs ? `?${qs}` : ""}`,
    { method: "GET", cache: "no-store" },
  );

  let payload: unknown;
  try {
    payload = (await response.json()) as unknown;
  } catch {
    throw new Error("Failed to load activity log.");
  }

  const envelope = payload as {
    success?: boolean;
    data?: { items?: AdminActivityItem[]; actors?: AdminActivityActorOption[] };
    meta?: {
      page?: number;
      limit?: number;
      total?: number;
      totalPages?: number;
      hasNextPage?: boolean;
      hasPrevPage?: boolean;
    };
  };

  if (!response.ok || !envelope?.success || !envelope.data) {
    throw new Error(readApiError(payload, "Failed to load activity log."));
  }

  const page = envelope.meta?.page ?? params.page ?? 1;
  const totalPages = envelope.meta?.totalPages ?? 1;

  return {
    items: envelope.data.items ?? [],
    actors: envelope.data.actors ?? [],
    page,
    limit: envelope.meta?.limit ?? params.limit ?? 20,
    total: envelope.meta?.total ?? 0,
    totalPages,
    hasNextPage: envelope.meta?.hasNextPage ?? page < totalPages,
    hasPrevPage: envelope.meta?.hasPrevPage ?? page > 1,
  };
}
