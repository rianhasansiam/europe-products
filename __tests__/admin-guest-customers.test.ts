import { NextRequest } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ guests: vi.fn(), count: vi.fn(), orders: vi.fn(), admin: vi.fn(), activity: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: {
  guestCustomer: { findMany: mocks.guests, count: mocks.count },
  order: { groupBy: mocks.orders },
} }));
vi.mock("@/lib/api/guards", () => ({ requireAdmin: mocks.admin }));
vi.mock("@/lib/services/admin-activity.service", () => ({ logAdminRouteActivity: mocks.activity }));

import { listGuestCustomersForAdmin } from "@/lib/services/guest-customer.service";
import { adminGuestQuerySchema } from "@/lib/validations/user.validation";
import { GET } from "@/app/api/admin/guests/route";

const now = new Date("2026-10-06T00:00:00Z");
function guest(id: string, email: string | null = null) {
  return { id, fullName: `Guest ${id}`, phone: "01700000000", email, city: "Dhaka", address: "12 Delivery Road", postalCode: "1216", createdAt: now, updatedAt: now, _count: { orders: 1 } };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.admin.mockResolvedValue({ ok: true, session: { user: { id: "admin-1", role: "ADMIN" } } });
  mocks.guests.mockResolvedValue([guest("guest-1")]);
  mocks.count.mockResolvedValue(1);
  mocks.orders.mockResolvedValue([{ guestCustomerId: "guest-1", currency: "USD", _sum: { totalAmount: new Prisma.Decimal("214.50") }, _max: { createdAt: now }, _count: { _all: 1 } }]);
});

describe("admin guest customer directory", () => {
  it("returns non-login guest contact and delivery details with exact guest-owned stats", async () => {
    const result = await listGuestCustomersForAdmin(adminGuestQuerySchema.parse({}));
    expect(result.items[0]).toMatchObject({ id: "guest-1", name: "Guest guest-1", email: null, phone: "01700000000", address: "12 Delivery Road", postalCode: "1216", role: null, customerType: "GUEST", ordersCount: 1, liveOrdersCount: 1, totalSpend: 214.5 });
    expect(mocks.orders).toHaveBeenCalledWith(expect.objectContaining({ by: ["guestCustomerId", "currency"], where: { guestCustomerId: { in: ["guest-1"] }, status: { not: "CANCELLED" } } }));
    expect(result.items[0]).not.toHaveProperty("password");
    expect(result.items[0]).not.toHaveProperty("guestAccessTokenHash");
  });

  it("keeps historical order counts and recency without mixing BDT into USD spend", async () => {
    const later = new Date("2026-10-10T00:00:00Z");
    mocks.orders.mockResolvedValue([
      { guestCustomerId: "guest-1", currency: "USD", _sum: { totalAmount: new Prisma.Decimal("214.50") }, _max: { createdAt: now }, _count: { _all: 1 } },
      { guestCustomerId: "guest-1", currency: "BDT", _sum: { totalAmount: new Prisma.Decimal("10000") }, _max: { createdAt: later }, _count: { _all: 2 } },
    ]);
    const result = await listGuestCustomersForAdmin(adminGuestQuerySchema.parse({}));
    expect(result.items[0]).toMatchObject({ totalSpend: 214.5, liveOrdersCount: 3, lastOrderAt: later });
  });

  it("paginates and searches profiles without deduplicating matching contacts", async () => {
    mocks.guests.mockResolvedValue([guest("guest-1", "same@example.test"), guest("guest-2", "same@example.test")]);
    mocks.count.mockResolvedValue(21);
    const result = await listGuestCustomersForAdmin(adminGuestQuerySchema.parse({ page: 2, pageSize: 10, search: "  Guest  " }));
    expect(mocks.guests).toHaveBeenCalledWith(expect.objectContaining({ skip: 10, take: 10, orderBy: [{ createdAt: "desc" }, { id: "desc" }], where: { OR: expect.arrayContaining([{ fullName: { contains: "Guest", mode: "insensitive" } }, { email: { contains: "Guest", mode: "insensitive" } }]) } }));
    expect(result.items).toHaveLength(2);
    expect(result.meta).toEqual({ page: 2, pageSize: 10, total: 21, totalPages: 3 });
    expect(result.items[1]).toMatchObject({ totalSpend: 0, liveOrdersCount: 0, lastOrderAt: null });
  });

  it("avoids aggregate reads for an empty page and still returns pagination metadata", async () => {
    mocks.guests.mockResolvedValue([]); mocks.count.mockResolvedValue(0);
    expect(await listGuestCustomersForAdmin(adminGuestQuerySchema.parse({}))).toMatchObject({ items: [], meta: { total: 0, totalPages: 1 } });
    expect(mocks.orders).not.toHaveBeenCalled();
  });

  it("requires fresh administrator authorization before reading any guest information", async () => {
    for (const status of [401, 403]) {
      mocks.admin.mockResolvedValueOnce({ ok: false, response: new Response(null, { status }) });
      expect((await GET(new NextRequest("https://shop.test/api/admin/guests"))).status).toBe(status);
    }
    expect(mocks.guests).not.toHaveBeenCalled();
    expect(mocks.activity).not.toHaveBeenCalled();
  });

  it("validates query bounds before database access and returns private admin JSON", async () => {
    expect((await GET(new NextRequest("https://shop.test/api/admin/guests?pageSize=1000"))).status).toBe(400);
    expect(mocks.guests).not.toHaveBeenCalled();
    const response = await GET(new NextRequest("https://shop.test/api/admin/guests?pageSize=100"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toMatchObject({ success: true, data: [{ customerType: "GUEST", role: null, totalSpend: 214.5 }], meta: { total: 1 } });
  });
});
