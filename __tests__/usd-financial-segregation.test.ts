import { Decimal } from "@prisma/client/runtime/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  order: { findMany: vi.fn(), aggregate: vi.fn(), groupBy: vi.fn(), count: vi.fn() },
  orderItem: { findMany: vi.fn() },
  user: { count: vi.fn() },
  product: { findMany: vi.fn() },
}));
vi.mock("@/lib/db/prisma", () => ({ prisma: db }));
vi.mock("@/lib/services/activity-feed.service", () => ({ getRecentActivityFeed: async () => [] }));
vi.mock("@/lib/services/category.service", () => ({ getCategoryBreadcrumbsByIds: async () => new Map() }));

import { buildReport } from "@/lib/services/report.service";
import { getDashboardOverview } from "@/lib/services/dashboard.service";
import { reportQuerySchema } from "@/lib/validations/report.validation";
import { REPORT_TYPES } from "@/features/admin-reports/api";

const now = new Date();
const yesterday = new Date(now);
yesterday.setUTCDate(yesterday.getUTCDate() - 1);
function order(id: string, currency: string, amount: number, status: string, createdAt = now) {
  return {
    id, orderNumber: id.toUpperCase(), currency, totalAmount: new Decimal(amount),
    // Intentionally different: sales use the saved checkout total.
    subtotal: new Decimal(amount - 5), status, paymentStatus: "PAID",
    paymentMethod: "AIRWALLEX", customerName: "Customer", customerEmail: null,
    createdAt, user: null, _count: { items: 1 },
  };
}
const orders = [
  order("usd", "USD", 50, "DELIVERED"),
  order("older-usd", "USD", 30, "CONFIRMED", yesterday),
  order("legacy", "BDT", 5000, "DELIVERED"),
  order("cancelled", "USD", 70, "CANCELLED"),
];
type Query = {
  where?: { currency?: string; status?: string | { not: string }; createdAt?: { gte?: Date; lte?: Date; lt?: Date } };
  select?: Record<string, unknown>;
  _sum?: Record<string, boolean>;
  by?: string[];
  take?: number;
};
function matchingOrders(query: Query) {
  return orders.filter((row) => {
    const where = query.where;
    if (where?.currency && row.currency !== where.currency) return false;
    if (typeof where?.status === "string" && row.status !== where.status) return false;
    if (typeof where?.status === "object" && row.status === where.status.not) return false;
    const range = where?.createdAt;
    return (!range?.gte || row.createdAt >= range.gte)
      && (!range?.lte || row.createdAt <= range.lte)
      && (!range?.lt || row.createdAt < range.lt);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  db.order.findMany.mockImplementation(async (query: Query) => {
    const rows = matchingOrders(query).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return query.take ? rows.slice(0, query.take) : rows;
  });
  db.order.aggregate.mockImplementation(async (query: Query) => {
    const rows = matchingOrders(query);
    return {
      _count: { _all: rows.length },
      _sum: Object.fromEntries(Object.keys(query._sum ?? {}).map((key) => [key,
        rows.reduce((total, row) => total.plus((row as unknown as Record<string, Decimal>)[key] ?? 0), new Decimal(0)),
      ])),
    };
  });
  db.order.groupBy.mockImplementation(async (query: Query) => {
    const key = query.by?.[0] as "status" | "paymentStatus";
    const groups = new Map<string, { count: number; amount: Decimal }>();
    for (const row of matchingOrders(query)) {
      const group = groups.get(row[key]) ?? { count: 0, amount: new Decimal(0) };
      group.count += 1;
      group.amount = group.amount.plus(row.totalAmount);
      groups.set(row[key], group);
    }
    return [...groups].map(([value, group]) => ({ [key]: value, _count: { _all: group.count }, _sum: { totalAmount: group.amount } }));
  });
  db.order.count.mockImplementation(async (query: Query) => matchingOrders(query).length);
  db.orderItem.findMany.mockResolvedValue([]);
  db.user.count.mockResolvedValue(2);
  db.product.findMany.mockResolvedValue([]);
});

describe("sales reporting", () => {
  it("offers only sales and rejects removed report types", () => {
    expect(REPORT_TYPES).toEqual(["sales"]);
    for (const type of ["profit", "orders", "products", "inventory", "customers", "categories"]) {
      expect(reportQuerySchema.safeParse({ type }).success).toBe(false);
    }
  });

  it("excludes historical currencies and cancellations from sales", async () => {
    const result = await buildReport(reportQuerySchema.parse({ type: "sales", allTime: "true" }));
    expect(result.meta.currency).toBe("USD");
    expect(result.sales.summary).toEqual({ totalSales: 80, totalOrders: 2, cancelledOrders: 1, ordersInWindow: 3 });
    expect(result.sales.byStatus.find((row) => row.status === "CANCELLED")).toMatchObject({ orders: 1, sales: 0 });
    expect(result.sales.byPaymentStatus).toEqual([{ paymentStatus: "PAID", orders: 2, sales: 80 }]);
    expect(result.sales.recentOrders.some((row) => row.id === "legacy")).toBe(false);
    expect(db.orderItem.findMany).not.toHaveBeenCalled();
    for (const [query] of db.order.aggregate.mock.calls) expect(query.where.currency).toBe("USD");
  });

  it("keeps full-window daily totals when recent-order details are limited", async () => {
    const result = await buildReport(reportQuerySchema.parse({ type: "sales", allTime: "true", limit: 1 }));
    expect(result.sales.recentOrders).toHaveLength(1);
    expect(result.sales.dailySeries.reduce((sum, row) => sum + row.sales, 0)).toBe(80);
    expect(result.sales.dailySeries.reduce((sum, row) => sum + row.orders, 0)).toBe(2);
    expect(result.sales.dailySeries).toHaveLength(2);
    expect(db.order.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: { not: "CANCELLED" } }),
      select: { createdAt: true, totalAmount: true },
    }));
  });

  it("uses inclusive calendar dates and keeps empty days in the selected window", async () => {
    const start = new Date(yesterday);
    start.setUTCDate(start.getUTCDate() - 1);
    const result = await buildReport(reportQuerySchema.parse({
      type: "sales", from: start.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10),
    }));
    expect(result.sales.dailySeries).toHaveLength(3);
    expect(result.sales.dailySeries[0]).toMatchObject({ sales: 0, orders: 0 });
    expect(result.meta.to).toMatch(/T23:59:59\.999Z$/);
  });

  it("keeps dashboard sales consistent while preserving historical order currencies", async () => {
    const result = await getDashboardOverview();
    expect(result.stats.sales.current).toBe(80);
    expect(result.stats.orders.current).toBe(2);
    expect(result.stats.cancellations.current).toBe(1);
    expect(result.stats).not.toHaveProperty("profit");
    expect(result.stats).not.toHaveProperty("revenue");
    expect(result.sales.totalSales).toBe(80);
    expect(result.sales.totalOrders).toBe(2);
    expect(result.recentOrders.find((row) => row.id === "legacy")).toMatchObject({ currency: "BDT", totalAmount: 5000 });
    for (const [query] of db.order.aggregate.mock.calls) expect(query.where.currency).toBe("USD");
    for (const [query] of db.orderItem.findMany.mock.calls) {
      expect(query.where.order.currency).toBe("USD");
      expect(query.select).not.toHaveProperty("buyingPrice");
    }
  });
});
