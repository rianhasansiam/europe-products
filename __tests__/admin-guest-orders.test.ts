import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "./helpers/intl";

import OrdersTable from "@/app/admin/orders/components/OrdersTable";
import {
  getAdminOrderCustomerType,
  parseOrdersPayload,
} from "@/features/admin-orders/api";
import { adminOrderQuerySchema } from "@/lib/validations/order.validation";

const database = vi.hoisted(() => ({
  findMany: vi.fn(),
  count: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: { order: database },
}));
vi.mock("@/lib/orders/notifications", () => ({
  notifyOrderStatusChange: vi.fn(),
}));

import { listOrdersForAdmin } from "@/lib/services/order.service";

beforeEach(() => {
  database.findMany.mockResolvedValue([]);
  database.count.mockResolvedValue(0);
});

describe("admin guest customer identity", () => {
  it("uses the saved guest association even when submitted contact matches an account", () => {
    const { items } = parseOrdersPayload({
      success: true,
      data: [{
        id: "guest-order",
        guestCustomerId: "guest-profile",
        userId: null,
        customerName: "Delivery recipient",
        customerPhone: "+8801700000000",
        customerEmail: "registered@example.com",
        customerAddress: "Checkout address",
        customerCity: "Dhaka",
        customerArea: "Mirpur",
        customerPostalCode: "1216",
        customerNote: "Call before delivery",
        user: null,
      }],
    });

    expect(getAdminOrderCustomerType(items[0])).toBe("GUEST");
    expect(items[0]).toMatchObject({
      userId: null,
      guestCustomerId: "guest-profile",
      customerEmail: "registered@example.com",
      customerAddress: "Checkout address",
      customerCity: "Dhaka",
      customerArea: "Mirpur",
      customerPostalCode: "1216",
      customerNote: "Call before delivery",
    });
  });

  it("preserves registered orders and does not fabricate guest identities for older orders", () => {
    expect(getAdminOrderCustomerType({ userId: "user-1", guestCustomerId: null }))
      .toBe("REGISTERED");
    expect(getAdminOrderCustomerType({ userId: null, guestCustomerId: null }))
      .toBeNull();
  });

  it("renders the guest label and submitted contact and delivery snapshots in admin details", () => {
    const { items } = parseOrdersPayload({
      success: true,
      data: [{
        id: "guest-order",
        orderNumber: "ORDER-GUEST",
        guestCustomerId: "guest-profile",
        customerName: "Guest recipient",
        customerPhone: "+8801700000000",
        customerEmail: "guest@example.com",
        customerAddress: "Checkout address",
        customerArea: "Mirpur",
        customerCity: "Dhaka",
        customerPostalCode: "1216",
        customerNote: "Call before delivery",
      }],
    });
    const markup = renderToStaticMarkup(createElement(OrdersTable, {
      orders: items,
      isLoading: false,
      totalCount: 1,
      busyOrderId: null,
      expandedId: "guest-order",
      onToggleExpand: vi.fn(),
      onViewDetails: vi.fn(),
      onChangeStatus: vi.fn(),
      onTogglePayment: vi.fn(),
      onApprovePaymentReview: vi.fn(),
      onRecordPaymentRefund: vi.fn(),
    }));

    for (const submittedValue of [
      ">Guest<", "Guest recipient", "+8801700000000", "guest@example.com",
      "Checkout address", "Mirpur, Dhaka, 1216", "Call before delivery",
    ]) {
      expect(markup).toContain(submittedValue);
    }
  });
});

describe("admin customer filters", () => {
  it("scopes both guest rows and their pagination count to a saved guest association", async () => {
    await listOrdersForAdmin(adminOrderQuerySchema.parse({ customerType: "GUEST" }));

    const where = { guestCustomerId: { not: null } };
    expect(database.findMany).toHaveBeenCalledWith(expect.objectContaining({ where }));
    expect(database.count).toHaveBeenCalledWith({ where });
  });

  it("requires a registered association and excludes guest rows from the registered filter", async () => {
    await listOrdersForAdmin(adminOrderQuerySchema.parse({ customerType: "REGISTERED" }));

    const where = { userId: { not: null }, guestCustomerId: null };
    expect(database.findMany).toHaveBeenCalledWith(expect.objectContaining({ where }));
    expect(database.count).toHaveBeenCalledWith({ where });
  });

  it("keeps unassociated historical orders in the unfiltered list", async () => {
    await listOrdersForAdmin(adminOrderQuerySchema.parse({}));

    expect(database.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
    expect(database.count).toHaveBeenCalledWith({ where: {} });
  });

  it("rejects unsupported customer identity filters", () => {
    expect(adminOrderQuerySchema.safeParse({ customerType: "ADMIN" }).success).toBe(false);
  });
});
