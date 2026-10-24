import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchAdminOrderDetail,
  type AdminOrderDetail,
} from "@/features/admin-orders/api";

const order: AdminOrderDetail = {
  id: "order-1",
  orderNumber: "BB-1001",
  userId: null,
  guestCustomerId: "guest-1",
  subtotal: 1800,
  deliveryCharge: 80,
  discountAmount: 100,
  taxAmount: 0,
  totalAmount: 1780,
  advancePayment: 500,
  promoCode: "SAVE100",
  status: "PENDING",
  paymentMethod: "CASH_ON_DELIVERY",
  paymentStatus: "UNPAID",
  requiresPaymentReview: false,
  customerName: "Guest customer",
  customerPhone: "01700000000",
  customerEmail: null,
  customerAddress: "12 Example Road",
  customerCity: "Dhaka",
  customerArea: "Dhanmondi",
  customerPostalCode: "1209",
  customerNote: "Call before delivery",
  createdAt: "2026-10-06T10:00:00.000Z",
  updatedAt: "2026-10-06T10:00:00.000Z",
  user: null,
  items: [
    {
      id: "item-1",
      productId: null,
      variantId: null,
      productName: "Purchased shirt",
      productImage: null,
      sku: "SHIRT-RED-M",
      variantName: "Red / M",
      color: "Red",
      size: "M",
      variantAttributes: { Color: "Red", Size: "M" },
      attributeSummary: "Color: Red · Size: M",
      quantity: 2,
      unitPrice: 900,
      totalPrice: 1800,
      displayUnitPrice: 7.5,
      displayTotalPrice: 15,
      product: null,
    },
  ],
  statusHistory: [
    {
      id: "history-1",
      status: "PENDING",
      note: "Order created",
      updatedBy: null,
      createdAt: "2026-10-06T10:00:00.000Z",
    },
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("admin order detail API", () => {
  it("loads canonical prices and purchased snapshots from the admin endpoint", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: order })),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchAdminOrderDetail(order.id);

    expect(fetchMock).toHaveBeenCalledWith("/api/admin/orders/order-1", {
      method: "GET",
      cache: "no-store",
      signal: undefined,
    });
    expect(result).toEqual(order);
    expect(result.items[0].unitPrice).toBe(900);
    expect(result.items[0].product).toBeNull();
    expect(result.statusHistory[0].note).toBe("Order created");
  });

  it("forwards the caller's abort signal and preserves an aborted request", async () => {
    const controller = new AbortController();
    const aborted = new DOMException("Request aborted", "AbortError");
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(aborted);
    vi.stubGlobal("fetch", fetchMock);
    controller.abort();

    await expect(
      fetchAdminOrderDetail(order.id, controller.signal),
    ).rejects.toBe(aborted);

    expect(fetchMock.mock.calls[0][1]?.signal).toBe(controller.signal);
  });

  it.each([
    [404, { success: false, message: "Order not found." }, "Order not found."],
    [403, { success: false, error: "Admin access required." }, "Admin access required."],
    [200, { success: false }, "Failed to load order details."],
  ])("reports API errors for status %s", async (status, payload, message) => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify(payload), { status }),
      ),
    );

    await expect(fetchAdminOrderDetail(order.id)).rejects.toThrow(message);
  });

  it("reports a useful error when the API returns an unreadable response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response("Service temporarily unavailable", { status: 503 }),
      ),
    );

    await expect(fetchAdminOrderDetail(order.id)).rejects.toThrow(
      "Failed to load order details.",
    );
  });
});
