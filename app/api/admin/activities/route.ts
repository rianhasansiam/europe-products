import { z } from "zod";

import { adminRoute } from "@/lib/api/handlers";
import {
  getActivityFeed,
  listActivityFeedActors,
  type ActivityFeedKind,
  type ActivityFeedSource,
} from "@/lib/services/activity-feed.service";

/**
 * GET /api/admin/activities
 *
 * Admin only. Paginated, filterable read over the UNIFIED activity feed
 * for the standalone `/admin/activities` page. The feed merges several
 * sources at read time (admin audit log, order placement + status
 * history, registrations, contact messages, capital/cost edits) without
 * writing any merged records to the database. Newest first, with optional
 * filters by module (kind), source, performer, free-text search, and a
 * created-at date range.
 */

const ACTIVITY_KINDS = [
  "order",
  "product",
  "category",
  "banner",
  "message",
  "review",
  "testimonial",
  "settings",
  "capital",
  "cost",
  "user",
  "courier",
] as const satisfies readonly ActivityFeedKind[];

const ACTIVITY_SOURCES = [
  "admin",
  "order",
  "order-status",
  "user",
  "message",
  "capital-cost",
] as const satisfies readonly ActivityFeedSource[];

function normalizeOptionalFilter(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  return normalized || undefined;
}

function normalizeSourceFilter(value: unknown): string | undefined {
  const normalized = normalizeOptionalFilter(value);
  switch (normalized) {
    case "admin-activity":
    case "admin-activity-log":
    case "adminactivitylog":
      return "admin";
    case "orderstatus":
      return "order-status";
    case "capitalcost":
      return "capital-cost";
    default:
      return normalized;
  }
}

const querySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  // `limit` is the canonical page-size param; `pageSize` is accepted as an
  // alias so older callers keep working.
  limit: z.coerce.number().int().min(1).max(100).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  kind: z.preprocess(
    normalizeOptionalFilter,
    z.enum(ACTIVITY_KINDS).optional(),
  ),
  source: z.preprocess(
    normalizeSourceFilter,
    z.enum(ACTIVITY_SOURCES).optional(),
  ),
  actorId: z.string().trim().min(1).optional(),
  search: z.string().trim().min(1).max(120).optional(),
  from: z.string().trim().min(1).optional(),
  to: z.string().trim().min(1).optional(),
});

type ActivityQuery = z.infer<typeof querySchema>;

/** Parse a YYYY-MM-DD (or ISO) string into a Date, or null when invalid. */
function parseDate(value: string | undefined, endOfDay = false): Date | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    date.setHours(23, 59, 59, 999);
  }
  return date;
}

export const GET = adminRoute({
  scope: "admin.activities.GET",
  querySchema,
  handler: async ({ query }) => {
    const q = (query ?? {}) as ActivityQuery;

    const [result, actors] = await Promise.all([
      getActivityFeed({
        page: q.page,
        limit: q.limit ?? q.pageSize,
        kind: q.kind ?? null,
        source: q.source ?? null,
        actorId: q.actorId ?? null,
        search: q.search ?? null,
        from: parseDate(q.from),
        to: parseDate(q.to, true),
      }),
      listActivityFeedActors(),
    ]);

    return {
      data: { items: result.items, actors },
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
        hasNextPage: result.hasNextPage,
        hasPrevPage: result.hasPrevPage,
      },
    };
  },
});
