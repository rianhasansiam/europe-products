import "server-only";

import type { Prisma } from "@/app/generated/prisma/client";
import { BASE_CURRENCY } from "@/lib/currency/config";
import { prisma } from "@/lib/db/prisma";
import { toNumber } from "@/lib/money";
import type { AdminGuestQueryInput } from "@/lib/validations/user.validation";

/** Admin contact directory; never merges profiles by email or phone. */
export async function listGuestCustomersForAdmin(query: AdminGuestQueryInput) {
  const where: Prisma.GuestCustomerWhereInput = query.search
    ? {
        OR: [
          { fullName: { contains: query.search, mode: "insensitive" } },
          { email: { contains: query.search, mode: "insensitive" } },
          { phone: { contains: query.search, mode: "insensitive" } },
          { city: { contains: query.search, mode: "insensitive" } },
          { address: { contains: query.search, mode: "insensitive" } },
        ],
      }
    : {};

  const [rows, total] = await Promise.all([
    prisma.guestCustomer.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        city: true,
        address: true,
        postalCode: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { orders: true } },
      },
    }),
    prisma.guestCustomer.count({ where }),
  ]);

  const guestIds = rows.map((row) => row.id);
  const aggregates = guestIds.length === 0 ? [] : await prisma.order.groupBy({
    by: ["guestCustomerId", "currency"],
    where: { guestCustomerId: { in: guestIds }, status: { not: "CANCELLED" } },
    _sum: { totalAmount: true }, _max: { createdAt: true }, _count: { _all: true },
  });
  const statsByGuest = new Map<string | null, { totalSpend: number; lastOrderAt: Date | null; liveOrders: number }>();
  for (const row of aggregates) {
    const stats = statsByGuest.get(row.guestCustomerId) ?? { totalSpend: 0, lastOrderAt: null, liveOrders: 0 };
    if (row.currency === BASE_CURRENCY) stats.totalSpend = toNumber(row._sum.totalAmount);
    stats.liveOrders += row._count._all;
    if (row._max.createdAt && (!stats.lastOrderAt || row._max.createdAt > stats.lastOrderAt)) stats.lastOrderAt = row._max.createdAt;
    statsByGuest.set(row.guestCustomerId, stats);
  }

  const items = rows.map((row) => {
    const stats = statsByGuest.get(row.id);
    return {
      id: row.id,
      name: row.fullName,
      email: row.email,
      phone: row.phone,
      city: row.city,
      address: row.address,
      postalCode: row.postalCode,
      image: null,
      role: null,
      customerType: "GUEST" as const,
      termsAcceptedAt: null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      ordersCount: row._count.orders,
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
