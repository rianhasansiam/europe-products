import "server-only";

import type { Prisma } from "@/app/generated/prisma/client";
import { unstable_cache } from "next/cache";

import { hashPassword, verifyPassword } from "@/lib/auth/passwords";
import { toNumber } from "@/lib/money";
import { BASE_CURRENCY } from "@/lib/currency/config";
import { prisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";
import type {
  AdminUserQueryInput,
  ChangePasswordInput,
  UpdateProfileInput,
  UpdateUserRoleInput,
} from "@/lib/validations/user.validation";

/**
 * The single home for User admin DB logic.
 *
 * Route handlers stay thin and these helpers stay reusable. Domain
 * rules live here:
 *   - role updates can't promote/demote yourself (caller decides UX,
 *     service enforces the basic invariant — last admin standing).
 *   - reads are served from `unstable_cache` and busted on demand
 *     when a write happens.
 */

export class UserError extends ServiceError {
  constructor(
    status: number,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(status, message, details);
    this.name = "UserError";
  }
}

/* -------------------------------------------------------------------------- */
/*  Admin reads                                                               */
/* -------------------------------------------------------------------------- */

function buildAdminWhere(query: AdminUserQueryInput): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = {};

  if (query.role) where.role = query.role;

  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: "insensitive" } },
      { email: { contains: query.search, mode: "insensitive" } },
      { phone: { contains: query.search, mode: "insensitive" } },
    ];
  }

  return where;
}

/**
 * Paginated list of users for the admin panel. Each row includes
 * lightweight aggregates (order count, total spend, last order date)
 * so the UI can render a meaningful customer table without N+1s.
 */
export async function listUsersForAdmin(query: AdminUserQueryInput) {
  const where = buildAdminWhere(query);
  const skip = (query.page - 1) * query.pageSize;

  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: query.pageSize,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        city: true,
        image: true,
        role: true,
        termsAcceptedAt: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { orders: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  // Group money by saved currency; counts and recency still include legacy orders.
  const userIds = rows.map((row) => row.id);
  const aggregates = userIds.length === 0 ? [] : await prisma.order.groupBy({
    by: ["userId", "currency"],
    where: { userId: { in: userIds }, status: { not: "CANCELLED" } },
    _sum: { totalAmount: true }, _max: { createdAt: true }, _count: { _all: true },
  });
  const aggregateMap = new Map<string | null, { totalSpend: number; lastOrderAt: Date | null; liveOrders: number }>();
  for (const row of aggregates) {
    const stats = aggregateMap.get(row.userId) ?? { totalSpend: 0, lastOrderAt: null, liveOrders: 0 };
    if (row.currency === BASE_CURRENCY) stats.totalSpend = toNumber(row._sum.totalAmount);
    stats.liveOrders += row._count._all;
    if (row._max.createdAt && (!stats.lastOrderAt || row._max.createdAt > stats.lastOrderAt)) stats.lastOrderAt = row._max.createdAt;
    aggregateMap.set(row.userId, stats);
  }

  const items = rows.map((row) => {
    const { _count, ...rest } = row;
    const stats = aggregateMap.get(row.id);
    return {
      ...rest,
      ordersCount: _count.orders,
      liveOrdersCount: stats?.liveOrders ?? 0,
      totalSpend: stats?.totalSpend ?? 0,
      lastOrderAt: stats?.lastOrderAt ?? null,
    };
  });

  return {
    items,
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    },
  };
}

/**
 * Cache layer over `listUsersForAdmin`. Tagged `admin-users` so role
 * changes (and new sign-ups, when wired) can bust it on demand via
 * `revalidateTag("admin-users", "max")`.
 */
const getCachedUsersForAdmin = unstable_cache(
  async (query: AdminUserQueryInput) => listUsersForAdmin(query),
  ["admin-users-list"],
  { revalidate: 300, tags: ["admin-users"] },
);

export function listUsersForAdminCached(query: AdminUserQueryInput) {
  return getCachedUsersForAdmin(query);
}

export function getUserForAdmin(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      city: true,
      image: true,
      role: true,
      termsAcceptedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

/* -------------------------------------------------------------------------- */
/*  Admin updates                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Flip a user's role between USER and ADMIN.
 *
 * Guards:
 *   - 404 when the user doesn't exist.
 *   - 409 when the role is already what was requested (no-op).
 *   - 409 when demoting the last remaining ADMIN — we always keep at
 *     least one admin so the panel can never lock itself out.
 */
export async function updateUserRole(
  userId: string,
  input: UpdateUserRoleInput,
) {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });
  if (!existing) throw new UserError(404, "User not found.");

  if (existing.role === input.role) {
    throw new UserError(409, `User is already ${input.role}.`);
  }

  if (existing.role === "ADMIN" && input.role === "USER") {
    const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
    if (adminCount <= 1) {
      throw new UserError(
        409,
        "At least one admin must remain. Promote another user first.",
      );
    }
  }

  return prisma.user.update({
    where: { id: userId },
    data: { role: input.role },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      city: true,
      image: true,
      role: true,
      termsAcceptedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

/* -------------------------------------------------------------------------- */
/*  Customer self-serve                                                       */
/* -------------------------------------------------------------------------- */

const profileSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  city: true,
  image: true,
  role: true,
  provider: true,
  termsAcceptedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

/**
 * Lightweight "is this a credential-based account" check used by the
 * password-change endpoint. We never expose the password hash itself.
 */
async function readPasswordHash(userId: string) {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, password: true, provider: true },
  });
  return row;
}

/**
 * Build the rich profile snapshot used by the My Profile dashboard.
 *
 * Returns the user record plus aggregate stats so the page can render
 * the overview tab without firing a second round of requests.
 */
export async function getProfileOverview(userId: string) {
  const [user, orderAggregate, orderHistory, ordersByStatus, cartCount, wishlistCount] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: profileSelect,
      }),
      prisma.order.aggregate({
        where: { userId, currency: BASE_CURRENCY, status: { not: "CANCELLED" } },
        _sum: { totalAmount: true },
      }),
      prisma.order.aggregate({
        where: { userId, status: { not: "CANCELLED" } },
        _count: { _all: true },
        _max: { createdAt: true },
      }),
      prisma.order.groupBy({
        by: ["status"],
        where: { userId },
        _count: { _all: true },
      }),
      prisma.cartItem.count({ where: { userId } }),
      prisma.wishlist.count({ where: { userId } }),
    ]);

  if (!user) throw new UserError(404, "User not found.");

  const statusBreakdown = ordersByStatus.reduce<Record<string, number>>(
    (acc, row) => {
      acc[row.status] = row._count._all;
      return acc;
    },
    {},
  );

  return {
    user,
    stats: {
      totalSpend: orderAggregate._sum.totalAmount ?? 0,
      totalOrders: orderHistory._count._all,
      lastOrderAt: orderHistory._max.createdAt ?? null,
      ordersByStatus: statusBreakdown,
      cartCount,
      wishlistCount,
    },
  };
}

/**
 * Apply a partial profile update from the customer-facing settings
 * page. Email and role are intentionally not editable here — email
 * changes touch auth and require a verification flow we don't have
 * yet, and role is admin-only.
 */
export async function updateOwnProfile(
  userId: string,
  input: UpdateProfileInput,
) {
  // Build the partial Prisma `data` payload from only the fields the
  // client actually sent. Empty strings were normalized to `undefined`
  // by the schema so nothing here will accidentally blank the column.
  const data: Prisma.UserUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.phone !== undefined) data.phone = input.phone;
  if (input.city !== undefined) data.city = input.city;
  if (input.image !== undefined) data.image = input.image;

  if (Object.keys(data).length === 0) {
    throw new UserError(400, "No changes to save.");
  }

  return prisma.user.update({
    where: { id: userId },
    data,
    select: profileSelect,
  });
}

/**
 * Change the caller's password.
 *
 * Rules:
 *   - Credential accounts: must supply the current password.
 *   - Google-only accounts: setting a password for the first time is
 *     allowed without `currentPassword`. The provider stamp stays
 *     GOOGLE so the audit trail (and the "how did this user join us?"
 *     reporting) still reflects the original signup.
 *   - The new password is bcrypt-hashed in `passwords.ts`.
 */
export async function changeOwnPassword(
  userId: string,
  input: ChangePasswordInput,
) {
  const row = await readPasswordHash(userId);
  if (!row) throw new UserError(404, "User not found.");

  const hasExisting = Boolean(row.password);

  if (hasExisting) {
    if (!input.currentPassword) {
      throw new UserError(400, "Enter your current password to continue.");
    }
    const matches = await verifyPassword(input.currentPassword, row.password);
    if (!matches) {
      throw new UserError(401, "Current password is incorrect.");
    }
  }

  const hashed = await hashPassword(input.newPassword);

  await prisma.user.update({
    where: { id: userId },
    data: { password: hashed },
    select: { id: true },
  });

  return { ok: true as const, hadPassword: hasExisting };
}
