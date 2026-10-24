import "server-only";

import { randomUUID } from "crypto";

import { Prisma } from "@/app/generated/prisma/client";

import { prisma } from "@/lib/db/prisma";

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

export type AdminActivityActor = {
  id?: string | null;
  name?: string | null;
  email?: string | null;
};

export type AdminActivityInput = {
  kind: AdminActivityKind;
  action: string;
  target?: string | null;
  targetId?: string | null;
  href?: string | null;
  actor?: AdminActivityActor | null;
  createdAt?: Date;
};

export type SerializedAdminActivity = {
  id: string;
  kind: AdminActivityKind;
  action: string;
  target: string | null;
  targetId: string | null;
  href: string | null;
  actorId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  createdAt: string;
};

type AdminActivityRow = Omit<SerializedAdminActivity, "createdAt"> & {
  createdAt: Date;
};

function cleanText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function logAdminActivity(
  input: AdminActivityInput,
): Promise<void> {
  const kind = normalizeActivityKind(input.kind);

  try {
    await prisma.$executeRaw`
      INSERT INTO "AdminActivityLog" (
        "id",
        "kind",
        "action",
        "target",
        "targetId",
        "href",
        "actorId",
        "actorName",
        "actorEmail",
        "createdAt"
      )
      VALUES (
        ${randomUUID()},
        ${kind},
        ${input.action},
        ${cleanText(input.target)},
        ${cleanText(input.targetId)},
        ${cleanText(input.href)},
        ${cleanText(input.actor?.id)},
        ${cleanText(input.actor?.name)},
        ${cleanText(input.actor?.email)},
        ${input.createdAt ?? new Date()}
      )
    `;
  } catch (error) {
    console.error("[admin.activity] log failed", error);
  }
}

export async function listRecentAdminActivities(
  limit = 20,
): Promise<SerializedAdminActivity[]> {
  const take = Math.min(Math.max(Math.trunc(limit), 1), 100);
  try {
    const rows = await prisma.$queryRaw<AdminActivityRow[]>`
      SELECT
        "id",
        "kind",
        "action",
        "target",
        "targetId",
        "href",
        "actorId",
        "actorName",
        "actorEmail",
        "createdAt"
      FROM "AdminActivityLog"
      ORDER BY "createdAt" DESC
      LIMIT ${take}
    `;

    return rows.map((row) => ({
      ...row,
      kind: normalizeActivityKind(row.kind),
      createdAt: row.createdAt.toISOString(),
    }));
  } catch (error) {
    console.error("[admin.activity] list failed", error);
    return [];
  }
}

export type AdminActivityListParams = {
  page?: number;
  pageSize?: number;
  kind?: AdminActivityKind | null;
  actorId?: string | null;
  search?: string | null;
  from?: Date | null;
  to?: Date | null;
};

export type AdminActivityListResult = {
  items: SerializedAdminActivity[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type AdminActivityActorOption = {
  id: string;
  name: string | null;
  email: string | null;
};

/** Filter-only subset (no pagination) shared by the paginated list and
 *  the windowed reader used by the unified activity feed. */
export type AdminActivityFilter = Pick<
  AdminActivityListParams,
  "kind" | "actorId" | "search" | "from" | "to"
>;

const ACTIVITY_PAGE_SIZE_MAX = 100;
const ACTIVITY_WINDOW_MAX = 1000;

/**
 * Compose the parameterized WHERE clause for the audit-log table.
 * Values stay bound via `Prisma.sql` - no string interpolation, no
 * injection surface.
 */
function buildActivityWhere(params: AdminActivityFilter): Prisma.Sql {
  const conditions: Prisma.Sql[] = [];
  if (params.kind) {
    conditions.push(Prisma.sql`LOWER("kind") = ${params.kind.toLowerCase()}`);
  }
  if (params.actorId) {
    conditions.push(Prisma.sql`"actorId" = ${params.actorId}`);
  }
  if (params.from) {
    conditions.push(Prisma.sql`"createdAt" >= ${params.from}`);
  }
  if (params.to) {
    conditions.push(Prisma.sql`"createdAt" <= ${params.to}`);
  }
  const search = params.search?.trim();
  if (search) {
    const like = `%${search}%`;
    conditions.push(
      Prisma.sql`("action" ILIKE ${like} OR "kind" ILIKE ${like} OR "target" ILIKE ${like} OR "targetId" ILIKE ${like} OR "actorName" ILIKE ${like} OR "actorEmail" ILIKE ${like})`,
    );
  }

  return conditions.length > 0
    ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`
    : Prisma.empty;
}

/**
 * Paginated + filterable read over the admin audit log, newest first.
 *
 * Uses raw SQL to stay consistent with the rest of this service. Filters
 * are composed with `Prisma.sql` so values stay parameterized.
 */
export async function listAdminActivities(
  params: AdminActivityListParams = {},
): Promise<AdminActivityListResult> {
  const page = Math.max(Math.trunc(params.page ?? 1), 1);
  const pageSize = Math.min(
    Math.max(Math.trunc(params.pageSize ?? 20), 1),
    ACTIVITY_PAGE_SIZE_MAX,
  );
  const offset = (page - 1) * pageSize;

  const where = buildActivityWhere(params);

  try {
    const [rows, totals] = await Promise.all([
      prisma.$queryRaw<AdminActivityRow[]>`
        SELECT
          "id",
          "kind",
          "action",
          "target",
          "targetId",
          "href",
          "actorId",
          "actorName",
          "actorEmail",
          "createdAt"
        FROM "AdminActivityLog"
        ${where}
        ORDER BY "createdAt" DESC
        LIMIT ${pageSize} OFFSET ${offset}
      `,
      prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*)::bigint AS count FROM "AdminActivityLog" ${where}
      `,
    ]);

    const total = Number(totals[0]?.count ?? 0);

    return {
      items: rows.map((row) => ({
        ...row,
        kind: normalizeActivityKind(row.kind),
        createdAt: row.createdAt.toISOString(),
      })),
      page,
      pageSize,
      total,
      totalPages: Math.max(Math.ceil(total / pageSize), 1),
    };
  } catch (error) {
    console.error("[admin.activity] paginated list failed", error);
    return { items: [], page, pageSize, total: 0, totalPages: 1 };
  }
}

/**
 * Non-paginated read over the admin audit log, newest first.
 *
 * Used by the unified activity feed, which merges this source with other
 * tables in memory. When `limit` is provided it returns a capped recent
 * window; otherwise it returns all rows matching the same filters as
 * `listAdminActivities`.
 */
export async function listAdminActivityWindow(
  params: AdminActivityFilter,
  limit?: number | null,
): Promise<SerializedAdminActivity[]> {
  const take =
    limit == null
      ? null
      : Math.min(Math.max(Math.trunc(limit), 1), ACTIVITY_WINDOW_MAX);
  const where = buildActivityWhere(params);
  const limitSql = take == null ? Prisma.empty : Prisma.sql`LIMIT ${take}`;

  try {
    const rows = await prisma.$queryRaw<AdminActivityRow[]>`
      SELECT
        "id",
        "kind",
        "action",
        "target",
        "targetId",
        "href",
        "actorId",
        "actorName",
        "actorEmail",
        "createdAt"
      FROM "AdminActivityLog"
      ${where}
      ORDER BY "createdAt" DESC
      ${limitSql}
    `;

    return rows.map((row) => ({
      ...row,
      kind: normalizeActivityKind(row.kind),
      createdAt: row.createdAt.toISOString(),
    }));
  } catch (error) {
    console.error("[admin.activity] window read failed", error);
    throw error;
  }
}

/**
 * Distinct performers that appear in the audit log, for the "by admin"
 * filter dropdown. Returns the most recent identity snapshot per actor.
 */
export async function listAdminActivityActors(): Promise<
  AdminActivityActorOption[]
> {
  try {
    const rows = await prisma.$queryRaw<AdminActivityActorOption[]>`
      SELECT DISTINCT ON ("actorId")
        "actorId" AS id,
        "actorName" AS name,
        "actorEmail" AS email
      FROM "AdminActivityLog"
      WHERE "actorId" IS NOT NULL
      ORDER BY "actorId", "createdAt" DESC
    `;
    return rows;
  } catch (error) {
    console.error("[admin.activity] actor list failed", error);
    return [];
  }
}

function normalizeActivityKind(kind: string): AdminActivityKind {
  switch (kind.toLowerCase()) {
    case "order":
      return "order";
    case "product":
      return "product";
    case "category":
      return "category";
    case "banner":
      return "banner";
    case "message":
      return "message";
    case "review":
      return "review";
    case "testimonial":
      return "testimonial";
    case "settings":
      return "settings";
    case "capital":
      return "capital";
    case "cost":
      return "cost";
    case "user":
      return "user";
    case "courier":
      return "courier";
    default:
      return "settings";
  }
}

type RouteActivityDescriptor = {
  kind: AdminActivityKind;
  target: string;
  href: string;
};

const SKIPPED_AUTO_ACTIVITY_SCOPES = new Set([
  "admin.orders/[id].status.PATCH",
]);

const SKIPPED_AUTO_ACTIVITY_PREFIXES = ["admin.capital-costs"];

export async function logAdminRouteActivity(input: {
  scope: string;
  method: string;
  actor: AdminActivityActor;
}): Promise<void> {
  const method = input.method.toUpperCase();
  if (method === "GET" || method === "HEAD") return;
  if (SKIPPED_AUTO_ACTIVITY_SCOPES.has(input.scope)) return;
  if (
    SKIPPED_AUTO_ACTIVITY_PREFIXES.some((prefix) =>
      input.scope.startsWith(prefix),
    )
  ) {
    return;
  }

  const descriptor = describeRouteActivity(input.scope);
  await logAdminActivity({
    kind: descriptor.kind,
    action: actionForMethod(method, input.scope),
    target: descriptor.target,
    href: descriptor.href,
    actor: input.actor,
  });
}

function actionForMethod(method: string, scope: string): string {
  if (scope === "admin.courier.POST") return "checked";
  switch (method) {
    case "POST":
      return "created";
    case "PATCH":
    case "PUT":
      return "updated";
    case "DELETE":
      return "deleted";
    default:
      return "changed";
  }
}

function describeRouteActivity(scope: string): RouteActivityDescriptor {
  if (scope.includes("orders")) {
    return {
      kind: "order",
      target: scope.includes("payment-status")
        ? "order payment status"
        : "order",
      href: "/admin/orders",
    };
  }

  if (scope.includes("users")) {
    return { kind: "user", target: "customer role", href: "/admin/users" };
  }

  if (scope.includes("messages")) {
    return { kind: "message", target: "message", href: "/admin/messages" };
  }

  if (scope.includes("reviews")) {
    return { kind: "review", target: "review", href: "/admin/reviews" };
  }

  if (scope.includes("testimonials")) {
    return {
      kind: "testimonial",
      target: scope.includes("from-review")
        ? "testimonial from review"
        : "testimonial",
      href: "/admin/testimonials",
    };
  }

  if (scope.includes("banners")) {
    return {
      kind: "banner",
      target: bannerTarget(scope),
      href: "/admin/banners",
    };
  }

  if (scope.includes("promo-codes")) {
    return {
      kind: "settings",
      target: "promo code",
      href: "/admin/settings",
    };
  }

  if (scope.includes("settings")) {
    return {
      kind: "settings",
      target: "store settings",
      href: "/admin/settings",
    };
  }

  if (scope.includes("courier")) {
    return {
      kind: "courier",
      target: "courier delivery status",
      href: "/admin/courier",
    };
  }

  return {
    kind: "settings",
    target: "admin panel",
    href: "/admin",
  };
}

function bannerTarget(scope: string): string {
  if (scope.includes("carousel")) return "carousel banner";
  if (scope.includes("category")) return "category banner";
  if (scope.includes("promo")) return "promo banner";
  if (scope.includes("deal")) return "deal banner";
  if (scope.includes("top")) return "top banner";
  return "banner";
}
