import "server-only";

import type { Prisma } from "@/app/generated/prisma/client";

import { prisma } from "@/lib/db/prisma";
import { ORDER_STATUS_META, type OrderStatus } from "@/lib/orders/status";
import {
  listAdminActivityActors,
  listAdminActivityWindow,
  type AdminActivityActorOption,
  type AdminActivityKind,
} from "@/lib/services/admin-activity.service";
import { getCategoryBreadcrumbsByIds } from "@/lib/services/category.service";

/**
 * Unified, READ-ONLY activity feed.
 *
 * Several tables record admin/customer activity independently:
 *   - `AdminActivityLog`        admin panel CRUD (products, banners, ...)
 *   - `OrderStatusHistory`      order status transitions
 *   - `Order`                   customer order placement
 *   - `User`                    account registrations
 *   - `ContactMessage`          contact-form submissions
 *   - `AdminCapitalCostActivity` capital & cost edits
 *
 * This service MERGES those sources at read time into one chronological
 * feed. Nothing is written: there is no materialized "feed" table, so no
 * records are duplicated in the database. The standalone audit-log page
 * reads all rows matching the requested filters, merges, sorts, and then
 * paginates in memory. The dashboard recent widget passes an explicit
 * per-source cap to keep that small card bounded. The sources are
 * duplicate-free by design: each row represents a distinct event (e.g.
 * order placement vs order status change vs admin payment-status edit are
 * different rows in different tables), and `AdminActivityLog` intentionally
 * skips the events that already live in `OrderStatusHistory` /
 * `AdminCapitalCostActivity`.
 */

export type ActivityFeedKind = AdminActivityKind;

export type ActivityFeedSource =
  | "admin"
  | "order"
  | "order-status"
  | "user"
  | "message"
  | "capital-cost";

export type ActivityFeedItem = {
  id: string;
  source: ActivityFeedSource;
  kind: ActivityFeedKind;
  action: string;
  target: string | null;
  targetId: string | null;
  href: string | null;
  actorId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  /** Resolved display label: real name, then email, then fallback. */
  performedBy: string;
  createdAt: string;
};

export type ActivityFeedFilters = {
  kind?: ActivityFeedKind | null;
  source?: ActivityFeedSource | null;
  actorId?: string | null;
  search?: string | null;
  from?: Date | null;
  to?: Date | null;
};

export type ActivityFeedParams = ActivityFeedFilters & {
  page?: number;
  limit?: number;
};

export type ActivityFeedResult = {
  items: ActivityFeedItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function normalizeKindFilter(
  kind?: ActivityFeedKind | string | null,
): ActivityFeedKind | null {
  if (!kind) return null;
  const normalized = kind.trim().toLowerCase();
  switch (normalized) {
    case "order":
    case "product":
    case "category":
    case "banner":
    case "message":
    case "review":
    case "testimonial":
    case "settings":
    case "capital":
    case "cost":
    case "user":
    case "courier":
      return normalized;
    default:
      return null;
  }
}

function normalizeSourceFilter(
  source?: ActivityFeedSource | string | null,
): ActivityFeedSource | null {
  if (!source) return null;
  const normalized = source.trim().toLowerCase();
  switch (normalized) {
    case "admin":
    case "admin-activity":
    case "admin-activity-log":
    case "adminactivitylog":
      return "admin";
    case "order":
      return "order";
    case "order-status":
    case "orderstatus":
      return "order-status";
    case "user":
      return "user";
    case "message":
      return "message";
    case "capital-cost":
    case "capitalcost":
      return "capital-cost";
    default:
      return null;
  }
}

function personLabel(
  person: { name?: string | null; email?: string | null } | null | undefined,
  fallback: string,
): string {
  const name = person?.name?.trim();
  const email = person?.email?.trim();
  return name || email || fallback;
}

function dateRange(
  from?: Date | null,
  to?: Date | null,
): Prisma.DateTimeFilter | undefined {
  if (!from && !to) return undefined;
  return {
    ...(from ? { gte: from } : {}),
    ...(to ? { lte: to } : {}),
  };
}

const SOURCE_SEARCH_LABELS: Record<ActivityFeedSource, string> = {
  admin: "admin activity log admin audit adminactivitylog",
  order: "order placement",
  "order-status": "order status",
  user: "customer account",
  message: "contact message",
  "capital-cost": "capital cost",
};

/* -------------------------------------------------------------------------- */
/*  Source selection                                                          */
/* -------------------------------------------------------------------------- */

type SourceFlags = {
  admin: boolean;
  order: boolean;
  orderStatus: boolean;
  user: boolean;
  message: boolean;
  capitalCost: boolean;
};

const SOURCE_FLAGS: Record<ActivityFeedSource, SourceFlags> = {
  admin: {
    admin: true,
    order: false,
    orderStatus: false,
    user: false,
    message: false,
    capitalCost: false,
  },
  order: {
    admin: false,
    order: true,
    orderStatus: false,
    user: false,
    message: false,
    capitalCost: false,
  },
  "order-status": {
    admin: false,
    order: false,
    orderStatus: true,
    user: false,
    message: false,
    capitalCost: false,
  },
  user: {
    admin: false,
    order: false,
    orderStatus: false,
    user: true,
    message: false,
    capitalCost: false,
  },
  message: {
    admin: false,
    order: false,
    orderStatus: false,
    user: false,
    message: true,
    capitalCost: false,
  },
  "capital-cost": {
    admin: false,
    order: false,
    orderStatus: false,
    user: false,
    message: false,
    capitalCost: true,
  },
};

/**
 * Decide which sources to query for the given filters. Structural filters
 * are still applied by each collector and again after merge so source/kind
 * combinations cannot leak unrelated rows.
 */
function resolveSources(filters: ActivityFeedFilters): SourceFlags {
  const source = normalizeSourceFilter(filters.source);
  if (source) return SOURCE_FLAGS[source];

  const kind = normalizeKindFilter(filters.kind);

  if (!kind) {
    return {
      admin: true,
      order: true,
      orderStatus: true,
      user: true,
      message: !filters.actorId,
      capitalCost: true,
    };
  }

  switch (kind) {
    case "order":
      return {
        admin: true,
        order: true,
        orderStatus: true,
        user: false,
        message: false,
        capitalCost: false,
      };
    case "user":
      return {
        admin: true,
        order: false,
        orderStatus: false,
        user: true,
        message: false,
        capitalCost: false,
      };
    case "message":
      return {
        admin: true,
        order: false,
        orderStatus: false,
        user: false,
        message: !filters.actorId,
        capitalCost: false,
      };
    case "capital":
    case "cost":
      return {
        admin: false,
        order: false,
        orderStatus: false,
        user: false,
        message: false,
        capitalCost: true,
      };
    default:
      // product, category, banner, review, testimonial, settings, courier
      return {
        admin: true,
        order: false,
        orderStatus: false,
        user: false,
        message: false,
        capitalCost: false,
      };
  }
}

/* -------------------------------------------------------------------------- */
/*  Per-source collectors (each best-effort: a failing source is skipped)     */
/* -------------------------------------------------------------------------- */

async function collectAdmin(
  filters: ActivityFeedFilters,
  limit?: number | null,
): Promise<ActivityFeedItem[]> {
  // Search is applied uniformly in memory across the merged feed, so the
  // window query only carries the structural filters.
  const rows = await listAdminActivityWindow(
    {
      kind: filters.kind ?? null,
      actorId: filters.actorId ?? null,
      from: filters.from ?? null,
      to: filters.to ?? null,
      search: null,
    },
    limit ?? null,
  );

  const categoryTargetIds = rows.flatMap((row) =>
    row.kind === "category" && row.targetId ? [row.targetId] : [],
  );
  const categoryBreadcrumbs: Map<string, Array<{ name: string }>> =
    categoryTargetIds.length > 0
      ? await getCategoryBreadcrumbsByIds(categoryTargetIds)
      : new Map<string, Array<{ name: string }>>();

  return rows.map((row) => {
    const breadcrumb = row.targetId
      ? (categoryBreadcrumbs.get(row.targetId) ?? [])
          .map((crumb) => crumb.name)
          .join(" / ")
      : "";
    const target =
      row.kind === "category" && breadcrumb
        ? row.action.toLocaleLowerCase().includes("reorder")
          ? `${row.target ?? "Subcategories"} · ${breadcrumb}`
          : breadcrumb
        : row.target;

    return {
      id: `admin-${row.id}`,
      source: "admin" as const,
      kind: row.kind,
      action: row.action,
      target,
      targetId: row.targetId,
      href: row.href,
      actorId: row.actorId,
      actorName: row.actorName,
      actorEmail: row.actorEmail,
      performedBy: personLabel(
        { name: row.actorName, email: row.actorEmail },
        "Unknown",
      ),
      createdAt: row.createdAt,
    };
  });
}

async function collectCapitalCost(
  filters: ActivityFeedFilters,
  limit?: number | null,
): Promise<ActivityFeedItem[]> {
  const createdAt = dateRange(filters.from, filters.to);
  const rows = await prisma.adminCapitalCostActivity.findMany({
    where: {
      ...(filters.actorId ? { actorId: filters.actorId } : {}),
      ...(createdAt ? { createdAt } : {}),
    },
    orderBy: { createdAt: "desc" },
    ...(limit ? { take: limit } : {}),
    select: {
      id: true,
      type: true,
      description: true,
      entityId: true,
      actorId: true,
      actorName: true,
      actorEmail: true,
      createdAt: true,
    },
  });

  return rows
    .map((row) => {
      const kind: ActivityFeedKind = row.type.startsWith("CAPITAL")
        ? "capital"
        : "cost";
      return {
        id: `capital-cost-${row.id}`,
        source: "capital-cost" as const,
        kind,
        action: "recorded",
        target: row.description,
        targetId: row.entityId,
        href: "/admin/capital-costs",
        actorId: row.actorId,
        actorName: row.actorName,
        actorEmail: row.actorEmail,
        performedBy: personLabel(
          { name: row.actorName, email: row.actorEmail },
          "Unknown",
        ),
        createdAt: row.createdAt.toISOString(),
      };
    })
    // When a specific capital/cost kind is requested, keep only that half.
    .filter((item) =>
      filters.kind === "capital" || filters.kind === "cost"
        ? item.kind === filters.kind
        : true,
    );
}

async function collectOrders(
  filters: ActivityFeedFilters,
  limit?: number | null,
): Promise<ActivityFeedItem[]> {
  const createdAt = dateRange(filters.from, filters.to);
  const orders = await prisma.order.findMany({
    where: {
      ...(filters.actorId ? { userId: filters.actorId } : {}),
      ...(createdAt ? { createdAt } : {}),
    },
    orderBy: { createdAt: "desc" },
    ...(limit ? { take: limit } : {}),
    select: {
      id: true,
      orderNumber: true,
      customerName: true,
      customerEmail: true,
      userId: true,
      createdAt: true,
      user: { select: { name: true, email: true } },
    },
  });

  return orders.map((order) => ({
    id: `order-${order.id}`,
    source: "order" as const,
    kind: "order" as const,
    action: "placed an order",
    target: `#${order.orderNumber}`,
    targetId: order.id,
    href: "/admin/orders",
    actorId: order.userId ?? null,
    actorName: order.customerName || order.user?.name || null,
    actorEmail: order.customerEmail || order.user?.email || null,
    performedBy: personLabel(
      {
        name: order.customerName,
        email: order.customerEmail ?? order.user?.email,
      },
      "Unknown",
    ),
    createdAt: order.createdAt.toISOString(),
  }));
}

async function collectUsers(
  filters: ActivityFeedFilters,
  limit?: number | null,
): Promise<ActivityFeedItem[]> {
  const createdAt = dateRange(filters.from, filters.to);
  const users = await prisma.user.findMany({
    where: {
      ...(filters.actorId ? { id: filters.actorId } : {}),
      ...(createdAt ? { createdAt } : {}),
    },
    orderBy: { createdAt: "desc" },
    ...(limit ? { take: limit } : {}),
    select: {
      id: true,
      name: true,
      email: true,
      provider: true,
      createdAt: true,
    },
  });

  return users.map((user) => ({
    id: `user-${user.id}`,
    source: "user" as const,
    kind: "user" as const,
    action:
      user.provider === "GOOGLE"
        ? "signed up with Google"
        : "registered an account",
    target: null,
    targetId: user.id,
    href: "/admin/users",
    actorId: user.id,
    actorName: user.name,
    actorEmail: user.email,
    performedBy: personLabel(user, "Unknown"),
    createdAt: user.createdAt.toISOString(),
  }));
}

async function collectMessages(
  filters: ActivityFeedFilters,
  limit?: number | null,
): Promise<ActivityFeedItem[]> {
  if (filters.actorId) return [];

  const createdAt = dateRange(filters.from, filters.to);
  const messages = await prisma.contactMessage.findMany({
    where: { ...(createdAt ? { createdAt } : {}) },
    orderBy: { createdAt: "desc" },
    ...(limit ? { take: limit } : {}),
    select: {
      id: true,
      name: true,
      email: true,
      subject: true,
      createdAt: true,
    },
  });

  return messages.map((message) => ({
    id: `message-${message.id}`,
    source: "message" as const,
    kind: "message" as const,
    action: "sent a message",
    target: message.subject,
    targetId: message.id,
    href: "/admin/messages",
    actorId: null,
    actorName: message.name,
    actorEmail: message.email,
    performedBy: personLabel(message, "Unknown"),
    createdAt: message.createdAt.toISOString(),
  }));
}

async function collectOrderStatus(
  filters: ActivityFeedFilters,
  limit?: number | null,
): Promise<ActivityFeedItem[]> {
  const createdAt = dateRange(filters.from, filters.to);
  const changes = await prisma.orderStatusHistory.findMany({
    where: {
      ...(filters.actorId ? { updatedBy: filters.actorId } : {}),
      ...(createdAt ? { createdAt } : {}),
    },
    orderBy: { createdAt: "desc" },
    ...(limit ? { take: limit } : {}),
    select: {
      id: true,
      orderId: true,
      status: true,
      updatedBy: true,
      createdAt: true,
      order: { select: { orderNumber: true } },
    },
  });

  const performerIds = Array.from(
    new Set(
      changes
        .map((change) => change.updatedBy)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const performers = performerIds.length
    ? await prisma.user.findMany({
        where: { id: { in: performerIds } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const performerById = new Map(performers.map((user) => [user.id, user]));

  return changes.map((change) => {
    const performer = change.updatedBy
      ? performerById.get(change.updatedBy)
      : null;
    const statusLabel =
      ORDER_STATUS_META[change.status as OrderStatus]?.label ?? change.status;
    return {
      id: `order-status-${change.id}`,
      source: "order-status" as const,
      kind: "order" as const,
      action: "updated order status for",
      target: `#${change.order.orderNumber} to ${statusLabel}`,
      targetId: change.orderId,
      href: "/admin/orders",
      actorId: change.updatedBy ?? null,
      actorName: performer?.name ?? null,
      actorEmail: performer?.email ?? null,
      performedBy: change.updatedBy
        ? personLabel(performer, "Unknown")
        : "System",
      createdAt: change.createdAt.toISOString(),
    };
  });
}

/* -------------------------------------------------------------------------- */
/*  Merge + filter                                                            */
/* -------------------------------------------------------------------------- */

function matchesSearch(item: ActivityFeedItem, query: string): boolean {
  const haystack = [
    item.action,
    item.kind,
    item.source,
    SOURCE_SEARCH_LABELS[item.source],
    item.target,
    item.targetId,
    item.actorName,
    item.actorEmail,
    item.performedBy,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

async function collectFeedItems(
  filters: ActivityFeedFilters,
  perSourceLimit?: number | null,
): Promise<ActivityFeedItem[]> {
  const flags = resolveSources(filters);

  const tasks: {
    source: ActivityFeedSource;
    task: Promise<ActivityFeedItem[]>;
  }[] = [];
  if (flags.admin) {
    tasks.push({ source: "admin", task: collectAdmin(filters, perSourceLimit) });
  }
  if (flags.capitalCost) {
    tasks.push({
      source: "capital-cost",
      task: collectCapitalCost(filters, perSourceLimit),
    });
  }
  if (flags.order) {
    tasks.push({ source: "order", task: collectOrders(filters, perSourceLimit) });
  }
  if (flags.user) {
    tasks.push({ source: "user", task: collectUsers(filters, perSourceLimit) });
  }
  if (flags.message) {
    tasks.push({
      source: "message",
      task: collectMessages(filters, perSourceLimit),
    });
  }
  if (flags.orderStatus) {
    tasks.push({
      source: "order-status",
      task: collectOrderStatus(filters, perSourceLimit),
    });
  }

  // A failing source must not take down the whole feed.
  const settled = await Promise.allSettled(tasks.map(({ task }) => task));
  const merged: ActivityFeedItem[] = [];
  for (const [index, result] of settled.entries()) {
    if (result.status === "fulfilled") {
      merged.push(...result.value);
    } else {
      console.error(
        `[activity.feed] ${tasks[index]?.source ?? "unknown"} source failed`,
        result.reason,
      );
    }
  }

  const query = filters.search?.trim().toLowerCase();
  const kind = normalizeKindFilter(filters.kind);
  const source = normalizeSourceFilter(filters.source);
  const filtered = merged.filter((item) => {
    if (kind && item.kind.toLowerCase() !== kind) return false;
    if (source && item.source.toLowerCase() !== source) return false;
    if (query && !matchesSearch(item, query)) return false;
    return true;
  });

  return filtered.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

/* -------------------------------------------------------------------------- */
/*  Public API                                                                */
/* -------------------------------------------------------------------------- */

/** Paginated unified feed for the `/admin/activities` page. */
export async function getActivityFeed(
  params: ActivityFeedParams = {},
): Promise<ActivityFeedResult> {
  const page = Math.max(Math.trunc(params.page ?? 1), 1);
  const limit = Math.min(
    Math.max(Math.trunc(params.limit ?? DEFAULT_LIMIT), 1),
    MAX_LIMIT,
  );

  const merged = await collectFeedItems(
    {
      kind: normalizeKindFilter(params.kind),
      source: normalizeSourceFilter(params.source),
      actorId: params.actorId ?? null,
      search: params.search ?? null,
      from: params.from ?? null,
      to: params.to ?? null,
    },
    null,
  );

  const total = merged.length;
  const totalPages = Math.max(Math.ceil(total / limit), 1);
  const start = (page - 1) * limit;
  const items = merged.slice(start, start + limit);

  return {
    items,
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}

/** Latest few merged events for the dashboard's Recent Activity card. */
export async function getRecentActivityFeed(
  limit = 10,
): Promise<ActivityFeedItem[]> {
  const perSource = Math.max(limit * 3, 30);
  const merged = await collectFeedItems({}, perSource);
  return merged.slice(0, limit);
}

/**
 * Distinct performers across every source that records an actor id, for
 * the "Performed by" filter dropdown.
 */
export async function listActivityFeedActors(): Promise<
  AdminActivityActorOption[]
> {
  const [adminActors, capitalActors, statusRows, orderActors, registeredUsers] =
    await Promise.all([
      listAdminActivityActors(),
      prisma.adminCapitalCostActivity.findMany({
        where: { actorId: { not: null } },
        distinct: ["actorId"],
        select: { actorId: true, actorName: true, actorEmail: true },
      }),
      prisma.orderStatusHistory.findMany({
        where: { updatedBy: { not: null } },
        distinct: ["updatedBy"],
        select: { updatedBy: true },
      }),
      prisma.order.findMany({
        distinct: ["userId"],
        select: {
          userId: true,
          customerName: true,
          customerEmail: true,
        },
      }),
      prisma.user.findMany({
        select: { id: true, name: true, email: true },
      }),
    ]);

  const byId = new Map<string, AdminActivityActorOption>();
  const add = (option: AdminActivityActorOption) => {
    if (!option.id) return;
    const existing = byId.get(option.id);
    if (!existing) {
      byId.set(option.id, option);
      return;
    }
    // Fill gaps from later sources without overwriting good values.
    byId.set(option.id, {
      id: option.id,
      name: existing.name ?? option.name,
      email: existing.email ?? option.email,
    });
  };

  for (const actor of adminActors) add(actor);
  for (const actor of capitalActors) {
    if (actor.actorId) {
      add({ id: actor.actorId, name: actor.actorName, email: actor.actorEmail });
    }
  }
  for (const actor of orderActors) {
    if (actor.userId) {
      add({
        id: actor.userId,
        name: actor.customerName || null,
        email: actor.customerEmail || null,
      });
    }
  }
  for (const user of registeredUsers) {
    add({ id: user.id, name: user.name, email: user.email });
  }

  const statusIds = statusRows
    .map((row) => row.updatedBy)
    .filter((id): id is string => Boolean(id) && !byId.has(id as string));
  if (statusIds.length) {
    const users = await prisma.user.findMany({
      where: { id: { in: statusIds } },
      select: { id: true, name: true, email: true },
    });
    for (const user of users) {
      add({ id: user.id, name: user.name, email: user.email });
    }
  }

  return Array.from(byId.values()).sort((a, b) =>
    (a.name ?? a.email ?? "").localeCompare(b.name ?? b.email ?? ""),
  );
}
