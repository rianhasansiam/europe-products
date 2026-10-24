import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  findOrder: vi.fn(),
  rateLimit: vi.fn(),
  initiate: vi.fn(),
  status: vi.fn(),
}));

vi.mock("@/lib/api/guards", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: { order: { findUnique: mocks.findOrder } },
}));
vi.mock("@/lib/auth/rate-limit", () => ({
  getClientIp: () => "203.0.113.10",
  rateLimitPersistent: mocks.rateLimit,
}));
vi.mock("../security/airwallex-origin-validation", () => ({
  assertAirwallexInitiationOrigin: vi.fn(),
}));
vi.mock("../services/airwallex-payment-initiation.service", () => ({
  initiateAirwallexPayment: mocks.initiate,
}));
vi.mock("../services/airwallex-payment-status.service", () => ({
  getOwnerScopedAirwallexPaymentStatus: mocks.status,
}));

import { guestOrderToken, hashGuestToken } from "@/lib/orders/checkout-customer";
import { POST } from "../handlers/initiate-payment.handler";
import { GET } from "../handlers/payment-status.handler";

const ORDER_ID = "guest-order-1";
const GUEST_KEY = `guest:${"a".repeat(64)}`;
const TOKEN = guestOrderToken(GUEST_KEY, ORDER_ID);
const TOKEN_HASH = hashGuestToken(TOKEN);

function request(method: "GET" | "POST", token?: string, cookieOrderId = ORDER_ID) {
  return new Request("https://shop.example.test/api/payments/airwallex/initiate", {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { cookie: `bangbuy-guest-order-${cookieOrderId}=${token}` } : {}),
    },
    ...(method === "POST" ? { body: JSON.stringify({ orderId: ORDER_ID }) } : {}),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireUser.mockResolvedValue({
    ok: false,
    response: new Response("Authentication required.", { status: 401 }),
  });
  mocks.findOrder.mockResolvedValue({ id: ORDER_ID, userId: null, guestAccessTokenHash: TOKEN_HASH });
  mocks.rateLimit.mockResolvedValue({ allowed: true, resetMs: 60_000 });
  mocks.initiate.mockResolvedValue({ intentId: "int_guest", clientSecret: "secret" });
  mocks.status.mockResolvedValue({ orderId: ORDER_ID, paymentStatus: "PENDING" });
});

describe("guest payment order authorization", () => {
  it("initializes payment only after proving possession of this order's cookie", async () => {
    const response = await POST(request("POST", TOKEN));

    expect(response.status).toBe(200);
    expect(mocks.initiate).toHaveBeenCalledWith({ guestAccessTokenHash: TOKEN_HASH }, ORDER_ID);
  });

  it("reads payment status with the same narrow order authorization", async () => {
    const response = await GET(request("GET", TOKEN), { params: Promise.resolve({ orderId: ORDER_ID }) });

    expect(response.status).toBe(200);
    expect(mocks.status).toHaveBeenCalledWith({ guestAccessTokenHash: TOKEN_HASH }, ORDER_ID);
  });

  it("does not authorize payment using an order ID alone", async () => {
    const response = await POST(request("POST"));

    expect(response.status).toBe(401);
    expect(mocks.findOrder).not.toHaveBeenCalled();
    expect(mocks.initiate).not.toHaveBeenCalled();
  });

  it("rejects a guessed token without contacting the payment provider", async () => {
    const response = await POST(request("POST", "b".repeat(64)));

    expect(response.status).toBe(404);
    expect(mocks.initiate).not.toHaveBeenCalled();
  });

  it("rejects a valid token from a different order, even under this cookie name", async () => {
    const differentToken = guestOrderToken(GUEST_KEY, "guest-order-2");
    const response = await GET(request("GET", differentToken), { params: Promise.resolve({ orderId: ORDER_ID }) });

    expect(response.status).toBe(404);
    expect(mocks.status).not.toHaveBeenCalled();
  });

  it("does not authorize a registered order using any guest cookie", async () => {
    mocks.findOrder.mockResolvedValue({ id: ORDER_ID, userId: "registered-user", guestAccessTokenHash: TOKEN_HASH });
    const response = await POST(request("POST", TOKEN));

    expect(response.status).toBe(404);
    expect(mocks.initiate).not.toHaveBeenCalled();
  });

  it("keeps a guest order accessible to its cookie holder after signing in", async () => {
    mocks.requireUser.mockResolvedValue({ ok: true, session: { user: { id: "registered-user", role: "USER" } } });
    const response = await POST(request("POST", TOKEN));

    expect(response.status).toBe(200);
    expect(mocks.initiate).toHaveBeenCalledWith({ guestAccessTokenHash: TOKEN_HASH }, ORDER_ID);
  });
});
