import "server-only";

import type { Prisma } from "@/app/generated/prisma/client";

import { BASE_CURRENCY } from "@/lib/currency/config";
import { prisma } from "@/lib/db/prisma";
import { round2, toNumber } from "@/lib/money";
import type { ReportQueryInput } from "@/lib/validations/report.validation";

/**
 * Server-side report aggregations for the admin "Reports" page.
 *
 * Returns a sales payload ready for the client to render
 * (preview table + PDF). Money fields are rounded to 2 dp at the
 * service edge so the PDF and the on-screen preview never disagree.
 */

/* -------------------------------------------------------------------------- */
/*  Shared helpers                                                            */
/* -------------------------------------------------------------------------- */

/** Round currency to 2 dp; accepts Decimal or number. Use everywhere here. */
function money(value: Parameters<typeof toNumber>[0]): number {
  return round2(value);
}

/**
 * Resolve the [from, to] window the report should cover.
 *
 *   - When `from` is missing, default to 30 days before `to`.
 *   - When `to` is missing, default to now.
 *   - The window is inclusive on both ends; we widen `to` to the
 *     end-of-day so callers can pass a date-only string and still
 *     capture the orders placed that same evening.
 */
function resolveWindow(query: ReportQueryInput) {
  const now = new Date();

  // All-time mode: span from the epoch to now so every order is in range.
  if (query.allTime) {
    return { from: new Date(0), to: now };
  }

  let to = query.to ? new Date(query.to) : now;
  // Widen to end-of-day when the caller passed a calendar date only.
  if (query.to && /^\d{4}-\d{2}-\d{2}$/.test(query.to)) {
    to = new Date(`${query.to}T23:59:59.999Z`);
  }

  let from = query.from ? new Date(query.from) : null;
  if (!from) {
    from = new Date(to);
    from.setDate(from.getDate() - 30);
  }
  // For pure dates, anchor at start-of-day so the window is intuitive.
  if (query.from && /^\d{4}-\d{2}-\d{2}$/.test(query.from)) {
    from = new Date(`${query.from}T00:00:00.000Z`);
  }

  return { from, to };
}

type Window = { from: Date; to: Date };

/** Common Prisma `where` block filtering Order rows by createdAt. */
function orderDateWhere(window: Window): Prisma.OrderWhereInput {
  return { currency: BASE_CURRENCY, createdAt: { gte: window.from, lte: window.to } };
}

/* -------------------------------------------------------------------------- */
/*  1. Sales report                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Sales totals and order counts, payment-status breakdowns, and a daily
 * series. Cancelled orders are counted separately and excluded from sales.
 */
async function buildSalesReport(window: Window, limit: number, allTime: boolean) {
  const where: Prisma.OrderWhereInput = orderDateWhere(window);

  const [orders, statusGroups, paymentGroups, dailyOrders] = await Promise.all([
    prisma.order.findMany({
      where,
      select: {
        id: true,
        orderNumber: true,
        totalAmount: true,
        status: true,
        paymentStatus: true,
        paymentMethod: true,
        customerName: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.order.groupBy({
      by: ["status"],
      where,
      _count: { _all: true },
      _sum: { totalAmount: true },
    }),
    prisma.order.groupBy({
      by: ["paymentStatus"],
      where: { ...where, status: { not: "CANCELLED" } },
      _count: { _all: true },
      _sum: { totalAmount: true },
    }),
    // The record limit applies only to the recent-order detail table.
    prisma.order.findMany({
      where: { ...where, status: { not: "CANCELLED" } },
      select: { createdAt: true, totalAmount: true },
    }),
  ]);

  const totals = await prisma.order.aggregate({
    where,
    _count: { _all: true },
  });

  const liveAggregate = await prisma.order.aggregate({
    where: { ...where, status: { not: "CANCELLED" } },
    _sum: {
      totalAmount: true,
    },
    _count: { _all: true },
  });

  const cancelledAggregate = await prisma.order.aggregate({
    where: { ...where, status: "CANCELLED" },
    _count: { _all: true },
  });

  // Daily series — bucket by UTC date for a tidy chart.
  const dailyMap = new Map<
    string,
    { day: string; sales: number; orders: number }
  >();
  const firstSalesDate = dailyOrders.reduce(
    (earliest, order) => order.createdAt < earliest ? order.createdAt : earliest,
    window.to,
  );
  const dayCursor = new Date(allTime ? firstSalesDate : window.from);
  dayCursor.setUTCHours(0, 0, 0, 0);
  while (dayCursor <= window.to) {
    const key = dayCursor.toISOString().slice(0, 10);
    dailyMap.set(key, { day: key, sales: 0, orders: 0 });
    dayCursor.setUTCDate(dayCursor.getUTCDate() + 1);
  }

  for (const order of dailyOrders) {
    const key = new Date(order.createdAt).toISOString().slice(0, 10);
    const bucket = dailyMap.get(key);
    if (!bucket) continue;
    bucket.sales = money(bucket.sales + toNumber(order.totalAmount));
    bucket.orders += 1;
  }

  const totalSales = money(liveAggregate._sum.totalAmount ?? 0);
  const totalOrders = liveAggregate._count._all;

  return {
    summary: {
      totalSales,
      totalOrders,
      cancelledOrders: cancelledAggregate._count._all,
      ordersInWindow: totals._count._all,
    },
    byStatus: statusGroups.map((group) => ({
      status: group.status,
      orders: group._count._all,
      sales: group.status === "CANCELLED" ? 0 : money(group._sum.totalAmount ?? 0),
    })),
    byPaymentStatus: paymentGroups.map((group) => ({
      paymentStatus: group.paymentStatus,
      orders: group._count._all,
      sales: money(group._sum.totalAmount ?? 0),
    })),
    dailySeries: Array.from(dailyMap.values()),
    recentOrders: orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      totalAmount: money(order.totalAmount),
      createdAt: order.createdAt.toISOString(),
    })),
  };
}

export type ReportPayload = Awaited<ReturnType<typeof buildReport>>;

export async function buildReport(query: ReportQueryInput) {
  const window = resolveWindow(query);
  return {
    meta: {
      currency: BASE_CURRENCY,
      type: query.type,
      from: window.from.toISOString(),
      to: window.to.toISOString(),
      generatedAt: new Date().toISOString(),
      limit: query.limit,
      allTime: query.allTime,
    },
    sales: await buildSalesReport(window, query.limit, query.allTime),
  };
}
