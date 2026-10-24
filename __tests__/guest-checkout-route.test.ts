import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ServiceError } from "@/lib/services/service-error";

const mocks = vi.hoisted(() => ({ requireUser: vi.fn(), rateLimit: vi.fn(), placeOrder: vi.fn(), preview: vi.fn(), airwallex: vi.fn(), invalidate: vi.fn(), revalidate: vi.fn(), guestOrder: vi.fn(), userOrder: vi.fn(), adminOrder: vi.fn(), myOrders: vi.fn() }));
vi.mock("@/lib/api/guards", () => ({ requireUser: mocks.requireUser, isAdminRequest: () => false }));
vi.mock("@/lib/services/order.service", () => ({ getOrderForGuest: mocks.guestOrder, getOrderForUser: mocks.userOrder, getCustomerOrderViewForAdmin: mocks.adminOrder, listMyOrders: mocks.myOrders }));
vi.mock("@/lib/auth/rate-limit", () => ({ rateLimitPersistent: mocks.rateLimit, getClientIp: () => "127.0.0.1" }));
vi.mock("@/lib/cache/catalog-invalidation", () => ({ invalidateProductsById: mocks.invalidate }));
vi.mock("@/lib/cache/revalidation", () => ({ revalidateCacheTags: mocks.revalidate }));
vi.mock("@/lib/airwallex/config/airwallex.config", () => ({ airwallexConfig: { enabled: true } }));
vi.mock("@/lib/currency/request-currency", () => ({ getCurrencyContextFromRequest: async () => ({ currency: "USD" }) }));
vi.mock("@/lib/services/checkout.service", async () => {
  const { ServiceError } = await import("@/lib/services/service-error");
  return { previewCheckout: mocks.preview, reserveOrderForAirwallex: mocks.placeOrder, CheckoutError: class extends ServiceError {} };
});


import { POST } from "@/app/api/checkout/route";
import { POST as previewPOST } from "@/app/api/checkout/preview/route";
import { GET as orderGET } from "@/app/api/orders/[id]/route";
import { GET as myOrdersGET } from "@/app/api/orders/my-orders/route";
import { GUEST_CHECKOUT_COOKIE, guestOrderCookieName } from "@/lib/orders/guest-access";
import { guestOrderToken, hashGuestToken } from "@/lib/orders/checkout-customer";

const token = "a".repeat(64);
const guestKey = `guest:${hashGuestToken(token)}`;
const body = {
  items: [{ productId: "product-1", variantId: "variant-1", quantity: 1 }], customerName: "Guest Buyer", customerPhone: "01712345678",
  customerEmail: "account@example.test", customerAddress: "12 Main Road", paymentMethod: "AIRWALLEX", airwallexQuoteToken: "q".repeat(80), idempotencyKey: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
};
function request(payload: unknown = body, cookie = `${GUEST_CHECKOUT_COOKIE}=${token}`, headers: Record<string, string> = {}) {
  return new NextRequest("https://shop.test/api/checkout", { method: "POST", headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}), ...headers }, body: JSON.stringify(payload) });
}

describe("public checkout endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks(); vi.stubEnv("AUTH_URL", "");
    mocks.requireUser.mockResolvedValue({ ok: false, response: new Response(null, { status: 401 }) });
    mocks.rateLimit.mockResolvedValue({ allowed: true, resetMs: 60_000 });
    mocks.placeOrder.mockResolvedValue({ order: { id: "order-1", orderNumber: "ORD-1", userId: null, guestAccessTokenHash: "digest", checkoutKey: "digest", checkoutFingerprint: "digest", items: [{ productId: "product-1", buyingPrice: 60 }] }, summary: { total: 100 }, promo: null });
    mocks.preview.mockResolvedValue({ items: [], summary: { total: 100, baseTotal: 100 }, promo: null });
  });

  it("creates a guest checkout with server-established ownership and scoped confirmation cookie", async () => {
    const response = await POST(request({ ...body, userId: "admin-1", role: "ADMIN", guestCustomerId: "other", totalAmount: 0 }));
    expect(response.status).toBe(201);
    expect(mocks.placeOrder.mock.calls[0][0]).toEqual({ guestKey });
    for (const key of ["userId", "role", "guestCustomerId", "totalAmount"]) expect(mocks.placeOrder.mock.calls[0][1]).not.toHaveProperty(key);
    expect(response.cookies.get(guestOrderCookieName("order-1"))?.value).toBe(guestOrderToken(guestKey, "order-1"));
    const json = await response.json();
    for (const key of ["guestAccessTokenHash", "checkoutKey", "checkoutFingerprint"]) expect(json.data.order).not.toHaveProperty(key);
    expect(json.data.order.items[0]).not.toHaveProperty("buyingPrice");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(mocks.rateLimit).toHaveBeenCalledWith("checkout-submit-ip:127.0.0.1", 12, 300_000);
  });

  it("retains session ownership for signed-in customers regardless of guest cookies or body IDs", async () => {
    mocks.requireUser.mockResolvedValue({ ok: true, session: { user: { id: "user-1" } } });
    const response = await POST(request({ ...body, userId: "user-2" }));
    expect(response.status).toBe(201);
    expect(mocks.placeOrder.mock.calls[0][0]).toBe("user-1");
    expect(response.cookies.get(guestOrderCookieName("order-1"))).toBeUndefined();
  });

  it("bootstraps direct guest requests before any mutation so missing cookies cannot bypass retries", async () => {
    const response = await POST(request(body, ""));
    expect(response.status).toBe(409);
    expect(response.cookies.get(GUEST_CHECKOUT_COOKIE)?.value).toMatch(/^[a-f0-9]{64}$/);
    expect(mocks.placeOrder).not.toHaveBeenCalled();
  });

  it("rejects invalid delivery and duplicate-request fields before order creation", async () => {
    const response = await POST(request({ ...body, customerName: "", customerPhone: "abc", customerAddress: "", idempotencyKey: undefined }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ fieldErrors: { customerName: expect.any(Array), customerPhone: expect.any(Array), customerAddress: expect.any(Array), idempotencyKey: expect.any(Array) } });
    expect(mocks.placeOrder).not.toHaveBeenCalled();
  });

  it("blocks cross-site, oversized, and rate-limited requests", async () => {
    expect((await POST(request(body, undefined, { origin: "https://evil.test" }))).status).toBe(403);
    expect((await POST(request({ ...body, customerNote: "a".repeat(70_000) }))).status).toBe(413);
    mocks.rateLimit.mockResolvedValueOnce({ allowed: true, resetMs: 60_000 }).mockResolvedValueOnce({ allowed: false, resetMs: 60_000 });
    expect((await POST(request())).status).toBe(429);
    expect(mocks.placeOrder).not.toHaveBeenCalled();
  });

  it("keeps committed payment-error confirmation private but accessible to its guest", async () => {
    mocks.placeOrder.mockRejectedValue(new ServiceError(409, "Payment is initializing.", { orderId: "order-1", paymentState: "PENDING" }));
    const response = await POST(request({ ...body, paymentMethod: "AIRWALLEX" }));
    expect(response.status).toBe(409);
    expect(response.cookies.get(guestOrderCookieName("order-1"))?.value).toBe(guestOrderToken(guestKey, "order-1"));
    expect(mocks.placeOrder.mock.calls[0][0]).toEqual({ guestKey });
  });

  it("issues an initial HttpOnly guest identity through read-only preview", async () => {
    const response = await previewPOST(request({ items: body.items }, ""));
    expect(response.status).toBe(200);
    expect(response.cookies.get(GUEST_CHECKOUT_COOKIE)?.value).toMatch(/^[a-f0-9]{64}$/);
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(mocks.preview.mock.calls[0][0]).toBeNull();
    expect(mocks.placeOrder).not.toHaveBeenCalled();
  });

  it("reads guest confirmation only through the SQL-scoped order-token hash", async () => {
    mocks.guestOrder.mockResolvedValue({ id: "order-1" });
    const scopedToken = guestOrderToken(guestKey, "order-1");
    const response = await orderGET(new NextRequest("https://shop.test/api/orders/order-1", { headers: { cookie: `${guestOrderCookieName("order-1")}=${scopedToken}` } }), { params: Promise.resolve({ id: "order-1" }) });
    expect(response.status).toBe(200);
    expect(mocks.guestOrder).toHaveBeenCalledWith("order-1", hashGuestToken(scopedToken));
    expect(mocks.userOrder).not.toHaveBeenCalled();
    expect(mocks.adminOrder).not.toHaveBeenCalled();
  });

  it("denies a predictable ID, matching contact, and other-order cookie without an order query", async () => {
    const response = await orderGET(new NextRequest("https://shop.test/api/orders/order-1?email=account@example.test", { headers: { cookie: `${guestOrderCookieName("order-2")}=${"a".repeat(64)}` } }), { params: Promise.resolve({ id: "order-1" }) });
    expect(response.status).toBe(401);
    expect(mocks.guestOrder).not.toHaveBeenCalled();
    expect(mocks.userOrder).not.toHaveBeenCalled();
  });

  it("returns the same not-found response for a wrong scoped cookie", async () => {
    mocks.guestOrder.mockResolvedValue(null);
    const response = await orderGET(new NextRequest("https://shop.test/api/orders/order-1", { headers: { cookie: `${guestOrderCookieName("order-1")}=${"b".repeat(64)}` } }), { params: Promise.resolve({ id: "order-1" }) });
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: "Order not found." });
  });

  it("does not grant registered order history access with a guest confirmation cookie", async () => {
    const response = await myOrdersGET(new NextRequest("https://shop.test/api/orders/my-orders", { headers: { cookie: `${guestOrderCookieName("order-1")}=${guestOrderToken(guestKey, "order-1")}` } }));
    expect(response.status).toBe(401);
    expect(mocks.myOrders).not.toHaveBeenCalled();
  });
});
