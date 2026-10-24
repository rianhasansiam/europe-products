import { describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  order: { aggregate: vi.fn(), groupBy: vi.fn() },
  cartItem: { count: vi.fn() },
  wishlist: { count: vi.fn() },
}));
vi.mock("@/lib/db/prisma", () => ({ prisma: database }));
vi.mock("next/cache", () => ({ unstable_cache: <T>(callback: T) => callback }));
import { getProfileOverview } from "@/lib/services/user.service";

describe("profile financial history", () => {
  it("keeps legacy orders in history counts while excluding their amounts from USD spend", async () => {
    const latestLegacyOrder = new Date("2026-10-23T12:00:00.000Z");
    database.user.findUnique.mockResolvedValue({ id: "customer-1" });
    database.order.aggregate.mockImplementation(async (query: { where: { currency?: string } }) =>
      query.where.currency === "USD"
        ? { _sum: { totalAmount: 12.5 } }
        : { _count: { _all: 3 }, _max: { createdAt: latestLegacyOrder } },
    );
    database.order.groupBy.mockResolvedValue([{ status: "DELIVERED", _count: { _all: 3 } }]);
    database.cartItem.count.mockResolvedValue(0);
    database.wishlist.count.mockResolvedValue(0);

    expect((await getProfileOverview("customer-1")).stats).toMatchObject({
      totalSpend: 12.5,
      totalOrders: 3,
      lastOrderAt: latestLegacyOrder,
      ordersByStatus: { DELIVERED: 3 },
    });
  });
});
