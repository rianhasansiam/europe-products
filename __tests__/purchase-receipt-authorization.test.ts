import { Decimal } from "@prisma/client/runtime/client";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireUser: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn() }));
vi.mock("@/lib/api/guards", () => ({ requireUser: mocks.requireUser, isAdminRequest: () => false }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { order: { findFirst: mocks.findFirst, findUnique: mocks.findUnique } } }));

import { GET } from "@/app/api/orders/[id]/route";
import * as purchaseBuilder from "@/lib/analytics/order-purchase";
import { guestOrderToken, hashGuestToken } from "@/lib/orders/checkout-customer";
import { GUEST_CHECKOUT_COOKIE, guestOrderCookieName } from "@/lib/orders/guest-access";

type Gateway = "SSLCOMMERZ" | "AIRWALLEX";
const orderId = "private-purchase-order";
const guestIdentity = "a".repeat(64);
const token = guestOrderToken(`guest:${hashGuestToken(guestIdentity)}`, orderId);
const tokenHash = hashGuestToken(token);
const context = { params: Promise.resolve({ id: orderId }) };
const gateways = ["SSLCOMMERZ", "AIRWALLEX"] as const;

function persistedOrder(gateway: Gateway, userId: string | null) {
  return {
    id: orderId, userId, guestAccessTokenHash: userId === null ? tokenHash : null,
    orderNumber: "PRIVATE-1", guestCustomerId: userId === null ? "guest-1" : null,
    paymentMethod: gateway, status: "PAYMENT_CONFIRMED", paymentStatus: "PAID",
    currency: "BDT", baseCurrency: "BDT", displayCurrency: "EUR",
    subtotal: new Decimal("1800"), deliveryCharge: new Decimal("60"), discountAmount: new Decimal("100"),
    taxAmount: new Decimal("250"), totalAmount: new Decimal("2010"), advancePayment: new Decimal("0"),
    displaySubtotal: new Decimal("16.56"), displayDeliveryCharge: new Decimal("0.55"), displayDiscountAmount: new Decimal("0.92"),
    displayTaxAmount: new Decimal("2.30"), displayTotalAmount: new Decimal("18.49"), displayAdvancePayment: new Decimal("0"),
    exchangeRate: new Decimal("0.0092"), exchangeRateAt: new Date("2026-10-04T06:00:00.000Z"),
    items: [], statusHistory: [],
    payments: [{
      provider: gateway, status: "SUCCESS", requiresReview: false,
      transactionId: "private-provider-id", validationId: gateway === "SSLCOMMERZ" ? "private-validation-id" : null,
      providerStatus: gateway === "AIRWALLEX" ? "SUCCEEDED" : null, paidAt: new Date("2026-10-04T06:00:00.000Z"),
      amount: new Decimal(gateway === "AIRWALLEX" ? "16.48" : "2010"), currency: gateway === "AIRWALLEX" ? "USD" : "BDT",
      baseAmount: gateway === "AIRWALLEX" ? new Decimal("2010") : null, baseCurrency: gateway === "AIRWALLEX" ? "BDT" : null,
      exchangeRate: gateway === "AIRWALLEX" ? new Decimal("0.0082") : null,
    }],
  };
}

function scopeDatabaseTo(order: ReturnType<typeof persistedOrder>) {
  mocks.findFirst.mockImplementation(async ({ where }: { where: { id: string; userId: string | null; guestAccessTokenHash?: string } }) => {
    if (where.id !== order.id || where.userId !== order.userId) return null;
    if (order.userId === null && where.guestAccessTokenHash !== order.guestAccessTokenHash) return null;
    return order;
  });
}

function request(cookie?: string) {
  return new NextRequest(`https://shop.example.test/api/orders/${orderId}`, { headers: cookie ? { cookie } : {} });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireUser.mockResolvedValue({ ok: false, response: Response.json({ success: false, error: "Unauthorized" }, { status: 401 }) });
  mocks.findFirst.mockResolvedValue(null);
  vi.spyOn(purchaseBuilder, "buildVerifiedPurchaseSnapshot");
});

describe("Purchase snapshots remain behind actual receipt route and SQL authorization", () => {
  it.each(gateways)("exposes the verified %s payload only to its order-specific guest cookie", async (gateway) => {
    scopeDatabaseTo(persistedOrder(gateway, null));
    const response = await GET(request(`${guestOrderCookieName(orderId)}=${token}`), context);
    expect(response.status).toBe(200);
    expect(mocks.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: orderId, userId: null, guestAccessTokenHash: tokenHash } }));
    const json = await response.json();
    expect(json.data.metaPurchase).toMatchObject({
      eventId: `purchase:${orderId}`, eventTime: 1791093600,
      value: gateway === "AIRWALLEX" ? 16.48 : 2010, currency: gateway === "AIRWALLEX" ? "USD" : "BDT",
    });
    expect(json.data).not.toHaveProperty("guestAccessTokenHash");
    expect(json.data).not.toHaveProperty("payments");
    expect(JSON.stringify(json)).not.toContain("private-provider-id");
    expect(JSON.stringify(json)).not.toContain("private-validation-id");
  });

  it.each(gateways)("exposes the saved %s payload to the registered SQL-scoped owner", async (gateway) => {
    scopeDatabaseTo(persistedOrder(gateway, "owner-1"));
    mocks.requireUser.mockResolvedValue({ ok: true, session: { user: { id: "owner-1" } } });
    const response = await GET(request(), context);
    expect(response.status).toBe(200);
    expect(mocks.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: orderId, userId: "owner-1" } }));
    expect((await response.json()).data.metaPurchase).toMatchObject({
      eventId: `purchase:${orderId}`, value: gateway === "AIRWALLEX" ? 16.48 : 2010, currency: gateway === "AIRWALLEX" ? "USD" : "BDT",
    });
  });

  it.each(gateways)("does not build or expose %s payload for a wrong scoped bearer cookie", async (gateway) => {
    scopeDatabaseTo(persistedOrder(gateway, null));
    const response = await GET(request(`${guestOrderCookieName(orderId)}=${"b".repeat(64)}`), context);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Order not found." });
    expect(purchaseBuilder.buildVerifiedPurchaseSnapshot).not.toHaveBeenCalled();
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it.each(gateways)("does not query or expose %s payload after the browser expires the scoped guest cookie", async (gateway) => {
    scopeDatabaseTo(persistedOrder(gateway, null));
    // Browser cookie expiry removes the scoped bearer; a general checkout
    // identity or an unrelated order's cookie cannot replace authorization.
    const response = await GET(request(`${GUEST_CHECKOUT_COOKIE}=${guestIdentity}; ${guestOrderCookieName("other-order")}=${token}`), context);
    expect(response.status).toBe(401);
    expect(await response.json()).not.toHaveProperty("data");
    expect(mocks.findFirst).not.toHaveBeenCalled();
    expect(purchaseBuilder.buildVerifiedPurchaseSnapshot).not.toHaveBeenCalled();
  });

  it.each(gateways)("does not build or expose another registered customer's %s Purchase", async (gateway) => {
    scopeDatabaseTo(persistedOrder(gateway, "owner-1"));
    mocks.requireUser.mockResolvedValue({ ok: true, session: { user: { id: "another-owner" } } });
    const response = await GET(request(), context);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Order not found." });
    expect(mocks.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: orderId, userId: "another-owner" } }));
    expect(purchaseBuilder.buildVerifiedPurchaseSnapshot).not.toHaveBeenCalled();
  });

  it.each(gateways)("retains guest bearer authorization for %s when the buyer signs in later", async (gateway) => {
    scopeDatabaseTo(persistedOrder(gateway, null));
    mocks.requireUser.mockResolvedValue({ ok: true, session: { user: { id: "signed-in-later" } } });
    const response = await GET(request(`${guestOrderCookieName(orderId)}=${token}`), context);
    expect(response.status).toBe(200);
    expect(mocks.findFirst).toHaveBeenNthCalledWith(1, expect.objectContaining({ where: { id: orderId, userId: "signed-in-later" } }));
    expect(mocks.findFirst).toHaveBeenNthCalledWith(2, expect.objectContaining({ where: { id: orderId, userId: null, guestAccessTokenHash: tokenHash } }));
    expect((await response.json()).data.metaPurchase.eventId).toBe(`purchase:${orderId}`);
  });
});
