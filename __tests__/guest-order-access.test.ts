import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppSession } from "@/lib/auth/session";

const requireUser = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/guards", () => ({ requireUser }));

import { checkoutCustomerOwnsOrder, checkoutRequestKey, guestOrderToken, hashGuestToken, publicOrderFields } from "@/lib/orders/checkout-customer";
import { canAccessOrder, getCheckoutCustomer, getGuestOrderTokenHash, GUEST_CHECKOUT_COOKIE, guestOrderCookieName, isCheckoutOriginAllowed, setGuestCheckoutCookies } from "@/lib/orders/guest-access";
import { checkoutSchema } from "@/lib/validations/checkout.validation";

const token = "a".repeat(64);
const guest = { guestKey: `guest:${hashGuestToken(token)}` };
const order = { id: "order-1", userId: null, guestAccessTokenHash: hashGuestToken(guestOrderToken(guest.guestKey, "order-1")) };
const session = { user: { id: "user-1", role: "USER" } } as AppSession;
const input = {
  items: [{ productId: "product-1", variantId: "variant-1", quantity: 1 }],
  customerName: "  Guest Buyer  ", customerPhone: "+880 (1712) 345-678", customerEmail: "  ACCOUNT@Example.COM  ",
  customerAddress: "  123 Delivery Street  ", paymentMethod: "AIRWALLEX", airwallexQuoteToken: "q".repeat(80), idempotencyKey: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
};
function request(cookie?: string) {
  return new NextRequest("https://shop.test/api/orders/order-1", { headers: cookie ? { cookie } : {} });
}

describe("guest identity and private order access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUser.mockResolvedValue({ ok: false, response: new Response(null, { status: 401 }) });
  });
  it("creates a non-login identity without relying on submitted contacts", async () => {
    const first = await getCheckoutCustomer(request());
    const next = await getCheckoutCustomer(request(`${GUEST_CHECKOUT_COOKIE}=${first.guestToken}`));
    expect(first.userId).toBeNull(); expect(first.isNewGuest).toBe(true);
    expect(first.guestToken).toMatch(/^[a-f0-9]{64}$/);
    expect(next.customer).toEqual(first.customer); expect(next.isNewGuest).toBe(false);
  });
  it("keeps the authenticated session identity when a guest cookie is present", async () => {
    requireUser.mockResolvedValue({ ok: true, session });
    expect(await getCheckoutCustomer(request(`${GUEST_CHECKOUT_COOKIE}=${token}`))).toMatchObject({ customer: "user-1", userId: "user-1", guestToken: null });
  });
  it("allows precisely the order cookie and denies IDs, contacts, and checkout cookies alone", () => {
    expect(canAccessOrder(order, null, request())).toBe(false);
    expect(canAccessOrder(order, null, request(`${GUEST_CHECKOUT_COOKIE}=${token}`))).toBe(false);
    const cookie = `${guestOrderCookieName(order.id)}=${guestOrderToken(guest.guestKey, order.id)}`;
    expect(canAccessOrder(order, null, request(cookie))).toBe(true);
    expect(canAccessOrder({ ...order, id: "order-2" }, null, request(cookie))).toBe(false);
    expect(canAccessOrder(order, null, request(`${guestOrderCookieName(order.id)}=${"b".repeat(64)}`))).toBe(false);
  });
  it("never authorizes registered orders with guest credentials or a different user", () => {
    const ownerOrder = { ...order, userId: "user-2" };
    const cookie = request(`${guestOrderCookieName(order.id)}=${guestOrderToken(guest.guestKey, order.id)}`);
    expect(canAccessOrder(ownerOrder, null, cookie)).toBe(false);
    expect(canAccessOrder(ownerOrder, session, cookie)).toBe(false);
    expect(canAccessOrder(ownerOrder, { ...session, user: { ...session.user, role: "ADMIN" } }, cookie)).toBe(false);
    expect(canAccessOrder({ ...ownerOrder, userId: session.user.id }, session, request())).toBe(true);
  });
  it("scopes replay ownership and request keys to the opaque checkout identity", () => {
    expect(checkoutCustomerOwnsOrder(guest, order)).toBe(true);
    expect(checkoutCustomerOwnsOrder({ guestKey: "other" }, order)).toBe(false);
    expect(checkoutCustomerOwnsOrder("user-1", order)).toBe(false);
    expect(checkoutRequestKey(guest, input.idempotencyKey)).not.toBe(checkoutRequestKey({ guestKey: "other" }, input.idempotencyKey));
  });
  it("sets HttpOnly scoped bearer cookies without exposing tokens in JSON", () => {
    const response = setGuestCheckoutCookies(NextResponse.json({ id: order.id }), { customer: guest, guestToken: token }, order.id);
    expect(response.cookies.get(GUEST_CHECKOUT_COOKIE)?.value).toBe(token);
    expect(response.cookies.get(guestOrderCookieName(order.id))?.value).toBe(guestOrderToken(guest.guestKey, order.id));
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("SameSite=lax");
    expect(getGuestOrderTokenHash(request(`${guestOrderCookieName(order.id)}=${guestOrderToken(guest.guestKey, order.id)}`), order.id)).toBe(order.guestAccessTokenHash);
    expect(publicOrderFields({ ...order, checkoutKey: "secret", checkoutFingerprint: "secret", customerPhone: "1234567" })).toEqual({ id: order.id, userId: null, customerPhone: "1234567" });
  });
  it("rejects cross-site checkout posts even without configured AUTH_URL", () => {
    vi.stubEnv("AUTH_URL", "");
    expect(isCheckoutOriginAllowed(new NextRequest("https://shop.test/api/checkout", { headers: { origin: "https://evil.test" } }))).toBe(false);
    expect(isCheckoutOriginAllowed(new NextRequest("https://shop.test/api/checkout", { headers: { origin: "https://shop.test" } }))).toBe(true);
    vi.unstubAllEnvs();
  });
});

describe("public checkout validation", () => {
  it("normalizes contacts and strips client roles, ownership, and money", () => {
    const parsed = checkoutSchema.parse({ ...input, userId: "admin-1", guestCustomerId: "guest-1", role: "ADMIN", totalAmount: 0, deliveryCharge: 0, items: [{ ...input.items[0], unitPrice: 0 }] });
    expect(parsed).toMatchObject({ customerName: "Guest Buyer", customerPhone: "+8801712345678", customerEmail: "account@example.com", customerAddress: "123 Delivery Street" });
    for (const field of ["userId", "guestCustomerId", "role", "totalAmount", "deliveryCharge"]) expect(parsed).not.toHaveProperty(field);
    expect(parsed.items?.[0]).not.toHaveProperty("unitPrice");
  });
  it("requires checkout IDs for Airwallex and required delivery fields", () => {
    expect(checkoutSchema.safeParse({ ...input, idempotencyKey: undefined }).success).toBe(false);
    for (const field of ["customerName", "customerPhone", "customerAddress"]) expect(checkoutSchema.safeParse({ ...input, [field]: "" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...input, customerPhone: "not-a-phone" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...input, customerEmail: "invalid" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...input, customerEmail: "" }).success).toBe(true);
  });
});
