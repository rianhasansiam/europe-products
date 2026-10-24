import { Decimal, PrismaClientKnownRequestError } from "@prisma/client/runtime/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  order: { findMany: vi.fn(), aggregate: vi.fn(), groupBy: vi.fn(), count: vi.fn() },
  orderItem: { findMany: vi.fn() }, user: { count: vi.fn() }, product: { findMany: vi.fn() },
  adminCapital: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
  adminOtherCost: { findMany: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  adminCapitalCostActivity: { create: vi.fn(), findMany: vi.fn() },
  adminProductCost: { findMany: vi.fn() }, settings: vi.fn(),
}));
vi.mock("@/lib/db/prisma", () => ({ prisma: db }));
vi.mock("@/lib/services/settings.service", () => ({ getStoreSettings: db.settings }));
vi.mock("@/lib/services/activity-feed.service", () => ({ getRecentActivityFeed: async () => [] }));
vi.mock("@/lib/services/category.service", () => ({ getCategoryBreadcrumbsByIds: async () => new Map() }));

import { buildReport } from "@/lib/services/report.service";
import { getDashboardOverview } from "@/lib/services/dashboard.service";
import { addCapital, createOtherCost, deleteOtherCost, getCapitalCostOverview, getProductCost, listOtherCosts, listRecentActivity, updateOtherCost } from "@/lib/services/capital-cost.service";
import { reportQuerySchema } from "@/lib/validations/report.validation";

const date = new Date();
const orders = [
  { id: "usd", orderNumber: "USD", currency: "USD", totalAmount: new Decimal(50), subtotal: new Decimal(50), deliveryCharge: new Decimal(0), discountAmount: new Decimal(0), status: "DELIVERED", paymentStatus: "PAID", paymentMethod: "AIRWALLEX", customerName: "Customer", customerEmail: null, createdAt: date, user: null, _count: { items: 1 } },
  { id: "legacy", orderNumber: "LEGACY", currency: "BDT", totalAmount: new Decimal(5000), subtotal: new Decimal(5000), deliveryCharge: new Decimal(0), discountAmount: new Decimal(0), status: "DELIVERED", paymentStatus: "PAID", paymentMethod: "CASH_ON_DELIVERY", customerName: "Historical", customerEmail: null, createdAt: date, user: null, _count: { items: 1 } },
];
type Query = { where?: { currency?: string; status?: unknown; order?: { currency?: string }; AND?: unknown[] }; select?: { currency?: boolean; amount?: boolean; quantity?: boolean; totalPrice?: boolean }; _sum?: Record<string, boolean> };
function matchingOrders(query: Query) {
  return orders.filter((order) => (!query.where?.currency || order.currency === query.where.currency) && query.where?.status !== "CANCELLED");
}
const cost = (currency: string, amount: number) => ({ id: currency, currency, amount: new Decimal(amount), reason: "Supplies", description: null, costDate: date, createdAt: date, updatedAt: date });

beforeEach(() => {
  vi.clearAllMocks();
  db.settings.mockResolvedValue({ currency: "USD", pricingCurrencyVerified: true });
  db.order.findMany.mockImplementation(async (query: Query) => matchingOrders(query));
  db.order.aggregate.mockImplementation(async (query: Query) => {
    const rows = matchingOrders(query);
    return { _count: { _all: rows.length }, _sum: Object.fromEntries(Object.keys(query._sum ?? {}).map((key) => [key, rows.reduce((total, row) => total.plus((row as unknown as Record<string, Decimal>)[key] ?? 0), new Decimal(0))])) };
  });
  db.order.groupBy.mockResolvedValue([]);
  db.order.count.mockResolvedValue(1);
  db.orderItem.findMany.mockResolvedValue([]);
  db.user.count.mockResolvedValue(2);
  db.product.findMany.mockResolvedValue([]);
  db.adminCapital.findMany.mockImplementation(async (query: Query) => query.where?.currency === "USD" ? [{ amount: new Decimal(100) }] : [{ amount: new Decimal(100) }, { amount: new Decimal(10000) }]);
  db.adminCapital.findFirst.mockResolvedValue({ id: "capital", currency: "USD", amount: new Decimal(100), note: null, createdAt: date, updatedAt: date });
  db.adminCapital.create.mockImplementation(async ({ data }) => ({ id: "new", createdAt: date, updatedAt: date, ...data, amount: new Decimal(data.amount) }));
  db.adminOtherCost.findMany.mockImplementation(async (query: Query) => query.select?.amount && query.where?.AND ? [{ amount: new Decimal(5) }] : [cost("USD", 5), cost("BDT", 500)]);
  db.adminOtherCost.count.mockResolvedValue(2);
  db.adminOtherCost.create.mockImplementation(async ({ data }) => ({ id: "new", createdAt: date, updatedAt: date, ...data, amount: new Decimal(data.amount) }));
  db.adminCapitalCostActivity.create.mockResolvedValue({});
  db.adminCapitalCostActivity.findMany.mockResolvedValue([{ id: "old", currency: "BDT", type: "COST_CREATED", amount: new Decimal(500), description: "Historical cost", note: null, entityId: null, actorName: null, actorEmail: null, createdAt: date }]);
  db.adminProductCost.findMany.mockResolvedValue([]);
});

describe("financial currency segregation", () => {
  it("excludes BDT orders from sales totals and profit item queries", async () => {
    const sales = await buildReport(reportQuerySchema.parse({ type: "sales", allTime: "true" }));
    expect(sales.meta.currency).toBe("USD");
    expect(sales.sales?.summary.totalRevenue).toBe(50);
    for (const [query] of db.order.aggregate.mock.calls) expect(query.where.currency).toBe("USD");
    await buildReport(reportQuerySchema.parse({ type: "profit", allTime: "true" }));
    expect(db.orderItem.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ order: expect.objectContaining({ currency: "USD" }) }) }));
  });

  it("keeps dashboard sums USD and recent historical order amounts in BDT", async () => {
    const result = await getDashboardOverview();
    expect(result.stats.revenue.current).toBe(50);
    expect(result.sales.totalRevenue).toBe(50);
    expect(result.recentOrders.find((order) => order.id === "legacy")).toMatchObject({ currency: "BDT", totalAmount: 5000 });
    for (const [query] of db.order.aggregate.mock.calls) expect(query.where.currency).toBe("USD");
    for (const [query] of db.orderItem.findMany.mock.calls) expect(query.where.order.currency).toBe("USD");
  });

  it("persists new capital, cost and activity entries explicitly in USD", async () => {
    expect(await addCapital({ amount: 25, note: null })).toMatchObject({ currency: "USD", amount: 25 });
    expect(await createOtherCost({ amount: 5, reason: "Supplies", description: null, costDate: date })).toMatchObject({ currency: "USD", amount: 5 });
    expect(db.adminCapital.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ currency: "USD" }) }));
    expect(db.adminOtherCost.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ currency: "USD" }) }));
    for (const [query] of db.adminCapitalCostActivity.create.mock.calls) expect(query.data.currency).toBe("USD");
  });

  it("retains historical cost and activity currencies while totaling USD only", async () => {
    const list = await listOtherCosts({ page: 1, pageSize: 20 });
    expect(list.items.find((item) => item.id === "BDT")).toMatchObject({ amount: 500, currency: "BDT" });
    expect(list.filteredTotalAmount).toBe(5);
    expect((await listRecentActivity())[0]).toMatchObject({ amount: 500, currency: "BDT" });
    const overview = await getCapitalCostOverview();
    expect(overview.summary).toMatchObject({ totalCapital: 100, otherCosts: 5, remainingBalance: 95 });
    expect(db.adminCapital.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { currency: "USD" } }));
  });

  it("blocks catalog product cost reporting until USD prices are reviewed", async () => {
    db.settings.mockResolvedValue({ currency: "BDT", pricingCurrencyVerified: false });
    await expect(getProductCost()).rejects.toMatchObject({ status: 503 });
    expect(db.adminProductCost.findMany).not.toHaveBeenCalled();
  });

  it("refuses mutations of historical BDT other-cost records", async () => {
    const notFound = new PrismaClientKnownRequestError("Historical record is outside USD scope", { code: "P2025", clientVersion: "test" });
    db.adminOtherCost.update.mockRejectedValue(notFound);
    db.adminOtherCost.delete.mockRejectedValue(notFound);
    await expect(updateOtherCost("BDT", { amount: 1 })).rejects.toMatchObject({ status: 404 });
    await expect(deleteOtherCost("BDT")).rejects.toMatchObject({ status: 404 });
    expect(db.adminOtherCost.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "BDT", currency: "USD" } }));
    expect(db.adminOtherCost.delete).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "BDT", currency: "USD" } }));
    expect(db.adminCapitalCostActivity.create).not.toHaveBeenCalled();
  });
});
