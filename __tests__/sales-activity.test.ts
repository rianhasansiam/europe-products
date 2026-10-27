import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  audit: vi.fn(),
  actors: vi.fn(),
  orders: vi.fn(),
  users: vi.fn(),
  messages: vi.fn(),
  statuses: vi.fn(),
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    order: { findMany: mocks.orders },
    user: { findMany: mocks.users },
    contactMessage: { findMany: mocks.messages },
    orderStatusHistory: { findMany: mocks.statuses },
  },
}));
vi.mock("@/lib/services/admin-activity.service", () => ({
  listAdminActivityWindow: mocks.audit,
  listAdminActivityActors: mocks.actors,
}));
vi.mock("@/lib/services/category.service", () => ({
  getCategoryBreadcrumbsByIds: async () => new Map(),
}));

import { getActivityFeed, getRecentActivityFeed, listActivityFeedActors } from "@/lib/services/activity-feed.service";

beforeEach(() => {
  vi.clearAllMocks();
  for (const mock of Object.values(mocks)) mock.mockResolvedValue([]);
});

describe("activity after retiring business modules", () => {
  it("keeps historical audit entries readable without links to removed pages", async () => {
    const paths = ["/admin/brands", "/admin/manufacturers/old", "/admin/capital-costs?tab=costs", "/admin/products"];
    mocks.audit.mockResolvedValue(paths.map((href, index) => ({
      id: String(index), kind: "settings", action: "updated", target: "Historical entry",
      targetId: null, href, actorId: null, actorName: "Owner", actorEmail: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    })));

    const result = await getActivityFeed({ source: "admin" });
    expect(result.total).toBe(4);
    expect(Object.fromEntries(result.items.map((item) => [item.id, item.href]))).toEqual({
      "admin-0": null, "admin-1": null, "admin-2": null, "admin-3": "/admin/products",
    });
    expect(result.items.every((item) => item.performedBy === "Owner")).toBe(true);
  });

  it("loads the dashboard feed and performer list using the remaining activity sources", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.actors.mockResolvedValue([{ id: "owner", name: "Owner", email: null }]);
    mocks.orders.mockResolvedValue([{
      id: "sale", orderNumber: "SALE-1", userId: null, customerName: "Guest",
      customerEmail: null, createdAt: new Date("2026-01-01"), user: null,
    }]);

    expect(await getRecentActivityFeed()).toEqual([
      expect.objectContaining({ kind: "order", target: "#SALE-1", performedBy: "Guest", href: "/admin/orders" }),
    ]);
    expect(await listActivityFeedActors()).toEqual([{ id: "owner", name: "Owner", email: null }]);
    expect(errors).not.toHaveBeenCalled();
  });
});
