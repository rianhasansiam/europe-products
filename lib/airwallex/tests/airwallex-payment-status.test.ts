import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PaymentTransactionStatus } from "@/app/generated/prisma/client";

const mocks = vi.hoisted(() => ({ findOrder: vi.fn(), retrieve: vi.fn(), apply: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { order: { findFirst: mocks.findOrder } } }));
vi.mock("../services/airwallex-payment-intent.service", () => ({ retrieveAirwallexPaymentIntent: mocks.retrieve }));
vi.mock("../services/airwallex-payment-verification.service", () => ({
  applyAuthoritativeAirwallexPayment: mocks.apply,
  toAirwallexAuthoritativePayment: (value: unknown) => value,
}));
vi.mock("../security/airwallex-redaction", () => ({ logAirwallexEvent: vi.fn() }));

import { getOwnerScopedAirwallexPaymentStatus } from "../services/airwallex-payment-status.service";

const ORIGINAL_TIME = new Date("2026-10-27T00:00:00.000Z");
const UPDATED_TIME = new Date("2026-10-27T00:01:00.000Z");
function order(status: PaymentTransactionStatus = "REQUIRES_PAYMENT_METHOD", review = false, paymentStatus = "PENDING") {
  return {
    id: "order-1", paymentStatus, updatedAt: ORIGINAL_TIME, _count: { payments: review ? 1 : 0 },
    payments: [{ status, transactionId: "int_owner123", requiresReview: review, failureMessage: null, updatedAt: UPDATED_TIME }],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findOrder.mockResolvedValue(order());
  mocks.retrieve.mockResolvedValue({ id: "int_owner123", status: "SUCCEEDED" });
  mocks.apply.mockResolvedValue({ status: "SUCCESS", requiresReview: false });
});

describe("owner-scoped Airwallex status reconciliation", () => {
  it("reports success only after reading the committed order and payment state", async () => {
    mocks.findOrder.mockResolvedValueOnce(order()).mockResolvedValueOnce(order("SUCCESS", false, "PAID"));
    const result = await getOwnerScopedAirwallexPaymentStatus("owner-1", "order-1");
    expect(result).toMatchObject({ paymentStatus: "SUCCEEDED", requiresReview: false, terminal: true, updatedAt: UPDATED_TIME.toISOString() });
    expect(mocks.apply).toHaveBeenCalledWith({ authoritative: { id: "int_owner123", status: "SUCCEEDED" }, source: "RECONCILIATION" });
    for (const [query] of mocks.findOrder.mock.calls) expect(query.where).toEqual({ id: "order-1", userId: "owner-1", paymentMethod: "AIRWALLEX" });
  });

  it.each(["REQUIRES_REVIEW", "PENDING_REVIEW"] as const)("returns fresh %s holds instead of stale requiresReview=false", async (status) => {
    mocks.findOrder.mockResolvedValueOnce(order()).mockResolvedValueOnce(order(status, true));
    mocks.apply.mockResolvedValue({ status, requiresReview: true });
    expect(await getOwnerScopedAirwallexPaymentStatus("owner-1", "order-1")).toMatchObject({ paymentStatus: status, requiresReview: true, terminal: false, failureMessage: "Payment verification requires manual review." });
  });

  it("preserves a concurrent paid payment's review hold instead of emitting terminal success", async () => {
    mocks.findOrder.mockResolvedValueOnce(order()).mockResolvedValueOnce(order("SUCCESS", true, "PAID"));
    mocks.apply.mockResolvedValue({ status: "SUCCESS", requiresReview: true });
    expect(await getOwnerScopedAirwallexPaymentStatus("owner-1", "order-1")).toMatchObject({ paymentStatus: "REQUIRES_REVIEW", requiresReview: true, terminal: false });
  });

  it("does not expose a provider verdict that was not committed to the database", async () => {
    // A provider result or mocked verification return cannot substitute for a
    // committed order/payment snapshot read in the customer's ownership scope.
    expect(await getOwnerScopedAirwallexPaymentStatus("owner-1", "order-1")).toMatchObject({ paymentStatus: "REQUIRES_PAYMENT_METHOD", requiresReview: false, terminal: false });
    expect(mocks.findOrder).toHaveBeenCalledTimes(2);
  });

  it.each(["provider", "verification"])("retains persisted state when %s fails", async (stage) => {
    if (stage === "provider") mocks.retrieve.mockRejectedValue(new Error("Provider unavailable"));
    else mocks.apply.mockRejectedValue(new Error("Verification unavailable"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await getOwnerScopedAirwallexPaymentStatus("owner-1", "order-1")).toMatchObject({ paymentStatus: "REQUIRES_PAYMENT_METHOD", requiresReview: false, terminal: false });
    if (stage === "provider") expect(mocks.apply).not.toHaveBeenCalled();
    expect(mocks.findOrder).toHaveBeenCalledTimes(2);
  });

  it("keeps a stored sibling review hold ahead of an otherwise paid order", async () => {
    const held = order("SUCCESS", false, "PAID"); held._count.payments = 1;
    mocks.findOrder.mockResolvedValue(held);
    expect(await getOwnerScopedAirwallexPaymentStatus("owner-1", "order-1")).toMatchObject({ paymentStatus: "REQUIRES_REVIEW", requiresReview: true, terminal: false });
    expect(mocks.retrieve).not.toHaveBeenCalled();
  });

  it("skips remote calls for unbound reservations", async () => {
    mocks.findOrder.mockResolvedValue({ ...order("CREATED"), payments: [{ ...order("CREATED").payments[0], transactionId: null }] });
    expect(await getOwnerScopedAirwallexPaymentStatus("owner-1", "order-1")).toMatchObject({ paymentStatus: "CREATED", terminal: false });
    expect(mocks.retrieve).not.toHaveBeenCalled();
  });

  it("returns not found without a provider call for a different owner", async () => {
    mocks.findOrder.mockResolvedValue(null);
    expect(await getOwnerScopedAirwallexPaymentStatus("other-owner", "order-1")).toBeNull();
    expect(mocks.retrieve).not.toHaveBeenCalled();
  });

  it("keeps a guest's SQL ownership constraint during the refresh", async () => {
    await getOwnerScopedAirwallexPaymentStatus({ guestAccessTokenHash: "digest" }, "order-1");
    for (const [query] of mocks.findOrder.mock.calls) expect(query.where).toEqual({ id: "order-1", userId: null, guestAccessTokenHash: "digest", paymentMethod: "AIRWALLEX" });
  });
});
