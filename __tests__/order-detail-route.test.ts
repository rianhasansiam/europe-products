import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUser = vi.hoisted(() => vi.fn());
const isAdminRequest = vi.hoisted(() => vi.fn());
const getCustomerOrderViewForAdmin = vi.hoisted(() => vi.fn());
const getOrderForUser = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/guards", () => ({
  requireUser,
  isAdminRequest,
}));

vi.mock("@/lib/services/order.service", () => ({
  getCustomerOrderViewForAdmin,
  getOrderForUser,
}));

import { GET } from "@/app/api/orders/[id]/route";

const ORDER_ID = "order-1";
const USER_ID = "user-1";
const request = new Request(
  `https://example.test/api/orders/${ORDER_ID}`,
) as NextRequest;

function customerOrderView() {
  return {
    id: ORDER_ID,
    paymentMethod: "AIRWALLEX",
    paymentAmount: 10.63,
    paymentCurrency: "EUR",
    currency: "EUR",
    totalAmount: 10.63,
  };
}

describe("owner-scoped order detail route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUser.mockResolvedValue({
      ok: true,
      session: { user: { id: USER_ID } },
    });
    getOrderForUser.mockResolvedValue(customerOrderView());
    getCustomerOrderViewForAdmin.mockResolvedValue(customerOrderView());
  });

  it("uses the customer-view serializer contract for an administrator", async () => {
    isAdminRequest.mockResolvedValue(true);

    const response = await GET(request, {
      params: Promise.resolve({ id: ORDER_ID }),
    });

    expect(getCustomerOrderViewForAdmin).toHaveBeenCalledWith(ORDER_ID);
    expect(getOrderForUser).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        paymentAmount: 10.63,
        paymentCurrency: "EUR",
      },
    });
  });

  it("keeps a regular customer scoped to their own order", async () => {
    isAdminRequest.mockResolvedValue(false);

    const response = await GET(request, {
      params: Promise.resolve({ id: ORDER_ID }),
    });

    expect(getOrderForUser).toHaveBeenCalledWith(ORDER_ID, USER_ID);
    expect(getCustomerOrderViewForAdmin).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
  });
});
