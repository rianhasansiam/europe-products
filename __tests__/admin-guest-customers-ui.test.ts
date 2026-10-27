import { createElement } from "react";
import { renderToStaticMarkup } from "./helpers/intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import UsersTable from "@/app/admin/users/components/UsersTable";
import UsersToolbar from "@/app/admin/users/components/UsersToolbar";
import UserSummaryCards from "@/app/admin/users/components/UserSummaryCards";
import {
  fetchAllAdminCustomersSnapshot,
  fetchAllAdminUsersSnapshot,
  parseGuestsPayload,
  type AdminGuestRow,
  type AdminRegisteredCustomerRow,
} from "@/features/admin-users/api";
import reducer, { patchAdminUser, setAdminUsers } from "@/store/slices/admin-users.slice";

const guest: AdminGuestRow = {
  id: "same-id", name: "Guest Buyer", email: null, phone: "01700000000",
  city: "Dhaka", address: "12 Main Road", postalCode: "1216", image: null,
  role: null, customerType: "GUEST", termsAcceptedAt: null,
  createdAt: "2026-10-06T10:00:00.000Z", updatedAt: "2026-10-06T10:00:00.000Z",
  ordersCount: 2, liveOrdersCount: 1, totalSpend: 1500,
  lastOrderAt: "2026-10-06T10:00:00.000Z",
};

const registered: AdminRegisteredCustomerRow = {
  id: "same-id", name: "Registered Buyer", email: "buyer@example.com", phone: null,
  city: null, image: null, role: "USER", customerType: "REGISTERED", termsAcceptedAt: null,
  createdAt: "2026-10-05T10:00:00.000Z", updatedAt: "2026-10-05T10:00:00.000Z",
  ordersCount: 0, liveOrdersCount: 0, totalSpend: 0, lastOrderAt: null,
};

afterEach(() => vi.unstubAllGlobals());

describe("admin customer snapshots", () => {
  it("preserves optional guest email and strips account roles from guest rows", () => {
    const { items } = parseGuestsPayload({ success: true, data: [{ ...guest, role: "ADMIN" }] });
    expect(items[0]).toEqual(guest);
  });

  it("combines every page in date order without merging a guest into a matching account", async () => {
    const fetchMock = vi.fn(async (input: string) => {
      const url = new URL(input, "https://bangbuy.test");
      const page = Number(url.searchParams.get("page"));
      const guests = url.pathname === "/api/admin/guests";
      const data = guests
        ? [{ ...guest, id: page === 1 ? guest.id : "second-guest", email: registered.email,
          createdAt: page === 1 ? guest.createdAt : "2026-10-04T10:00:00.000Z" }]
        : [registered];
      return new Response(JSON.stringify({
        success: true, data, meta: { page, pageSize: 100, total: guests ? 2 : 1, totalPages: guests ? 2 : 1 },
      }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const customers = await fetchAllAdminCustomersSnapshot();
    expect(customers.map((row) => [row.customerType, row.id])).toEqual([
      ["GUEST", "same-id"], ["REGISTERED", "same-id"], ["GUEST", "second-guest"],
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/guests?page=2&pageSize=100", {
      method: "GET", cache: "no-store",
    });
  });

  it("keeps the account-only snapshot away from the guest endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: [registered] })));
    vi.stubGlobal("fetch", fetchMock);

    const rows = await fetchAllAdminUsersSnapshot();
    expect(rows).toHaveLength(1);
    expect(rows[0]).not.toHaveProperty("customerType");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain("/api/admin/users?");
  });

  it("reports guest loading errors rather than showing an incomplete combined list", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string) => {
      return input.startsWith("/api/admin/guests")
        ? new Response(JSON.stringify({ success: false, error: "Guest profiles unavailable" }), { status: 500 })
        : new Response(JSON.stringify({ success: true, data: [registered] }));
    }));
    await expect(fetchAllAdminCustomersSnapshot()).rejects.toThrow("Guest profiles unavailable");
  });
});

describe("admin guest customer presentation", () => {
  it("shows guest delivery details and order totals without granting account role controls", () => {
    const markup = renderToStaticMarkup(createElement(UsersTable, {
      users: [guest], isLoading: false, totalCount: 1,
      busyUserId: guest.id, currentUserId: guest.id, onToggleRole: vi.fn(),
    }));
    for (const value of ["Guest Buyer", ">Guest<", "01700000000", "No email provided", "12 Main Road", "1216", "1 active", "Guest checkout"]) {
      expect(markup).toContain(value);
    }
    expect(markup).not.toContain("<button");
    expect(markup).not.toContain(">You<");
  });

  it("retains registered role actions and prevents changing the current admin's role", () => {
    const markup = renderToStaticMarkup(createElement(UsersTable, {
      users: [{ ...registered, role: "ADMIN" }], isLoading: false, totalCount: 1,
      busyUserId: null, currentUserId: registered.id, onToggleRole: vi.fn(),
    }));
    expect(markup).toContain("Make USER");
    expect(markup.match(/<button[^>]*>/)?.[0]).toContain('disabled=""');
    expect(markup).toContain("You");
  });

  it("offers a guest filter independently from account role selection", () => {
    const markup = renderToStaticMarkup(createElement(UsersToolbar, {
      query: "", roleFilter: "ALL", customerTypeFilter: "GUEST", visibleCount: 1,
      totalCount: 2, isLoading: false, onQueryChange: vi.fn(), onRoleChange: vi.fn(),
      onCustomerTypeChange: vi.fn(), onRefresh: vi.fn(),
    }));
    const selects = markup.match(/<select[^>]*>.*?<\/select>/g) ?? [];
    expect(selects).toHaveLength(2);
    expect(selects[0]).toContain('aria-label="Customer type"');
    expect(selects[0]).toContain('value="GUEST" selected=""');
    expect(selects[1]).toContain('aria-label="Account role"');
    expect(selects[1]).toContain('disabled=""');
    expect(selects[1]).not.toContain('value="GUEST"');
  });

  it("shows the guest customer count", () => {
    const markup = renderToStaticMarkup(createElement(UserSummaryCards, {
      totalCustomers: 12, guests: 7, admins: 1, withOrders: 8, lifetimeSales: 9000,
    }));
    expect(markup).toContain("Guest customers");
    expect(markup).toContain(">7<");
  });

  it("patches only registered rows when guest and account identifiers overlap", () => {
    const state = reducer(undefined, setAdminUsers([guest, registered]));
    const next = reducer(state, patchAdminUser({ id: registered.id, changes: { role: "ADMIN" } }));
    expect(next.items[0]).toEqual(guest);
    expect(next.items[1]).toMatchObject({ customerType: "REGISTERED", role: "ADMIN" });
  });
});
