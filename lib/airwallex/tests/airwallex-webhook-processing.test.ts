import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  applyAuthoritative: vi.fn(),
  claimEvents: vi.fn(),
  ingestEvent: vi.fn(),
  logEvent: vi.fn(),
  releaseEvent: vi.fn(),
  retrieveIntent: vi.fn(),
  verifySignature: vi.fn(),
}));

vi.mock("../config/airwallex.config", () => ({
  requireAirwallexConfig: () => ({
    webhookSecret: "test-webhook-secret",
    webhookToleranceSeconds: 300,
  }),
}));

vi.mock("../repositories/airwallex-payment.repository", () => ({
  claimAirwallexWebhookEvents: mocks.claimEvents,
  ingestAirwallexWebhookEvent: mocks.ingestEvent,
  releaseAirwallexEventForRetry: mocks.releaseEvent,
}));

vi.mock("../security/airwallex-redaction", () => ({
  logAirwallexEvent: mocks.logEvent,
}));

vi.mock("../security/airwallex-webhook-signature", () => ({
  verifyAirwallexWebhookSignature: mocks.verifySignature,
}));

vi.mock("../services/airwallex-payment-intent.service", () => ({
  retrieveAirwallexPaymentIntent: mocks.retrieveIntent,
}));

vi.mock("../services/airwallex-payment-verification.service", () => ({
  applyAuthoritativeAirwallexPayment: mocks.applyAuthoritative,
  toAirwallexAuthoritativePayment: (intent: {
    id: string;
    request_id: string;
    merchant_order_id: string;
    amount: number;
    currency: string;
    status: string;
  }) => ({
    paymentIntentId: intent.id,
    requestId: intent.request_id,
    merchantOrderId: intent.merchant_order_id,
    amount: intent.amount,
    currency: intent.currency,
    providerStatus: intent.status,
  }),
}));

import { processPendingAirwallexWebhookEvents } from "../services/airwallex-payment-event.service";

const FAILURE_EVENT_NAME = "payment_attempt.authorization_failed";

function attemptEnvelope(attemptId: string) {
  return {
    id: "evt_attempt_failure",
    name: FAILURE_EVENT_NAME,
    created_at: "2026-08-04T10:00:00Z",
    version: "2024-02-22",
    data: {
      object: {
        id: attemptId,
        payment_intent_id: "int_test123",
        status: "FAILED",
        failure_code: "authorization_failed",
      },
    },
  };
}

function claimedAttemptEvent(attemptId: string) {
  return {
    id: "stored_event_1",
    eventId: "evt_attempt_failure",
    eventName: FAILURE_EVENT_NAME,
    paymentIntentId: "int_test123",
    sanitizedPayload: attemptEnvelope(attemptId),
    processingAttempts: 1,
    lockToken: "lease-token",
  };
}

function retrievedIntent(latestAttemptId: string) {
  return {
    id: "int_test123",
    request_id: "request-1",
    amount: 125,
    currency: "USD",
    merchant_order_id: "order-1",
    status: "REQUIRES_PAYMENT_METHOD",
    latest_payment_attempt: {
      id: latestAttemptId,
      status: "FAILED",
    },
    created_at: "2026-08-04T09:55:00Z",
    updated_at: "2026-08-04T10:00:00Z",
  };
}

describe("Airwallex PaymentAttempt webhook processing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.applyAuthoritative.mockResolvedValue({
      orderId: "order-1",
      paymentId: "payment-1",
      status: "REQUIRES_PAYMENT_METHOD",
      duplicate: false,
      requiresReview: false,
    });
  });

  it("keeps the PI open when its latest PaymentAttempt fails", async () => {
    mocks.claimEvents.mockResolvedValue([claimedAttemptEvent("att_latest")]);
    mocks.retrieveIntent.mockResolvedValue(retrievedIntent("att_latest"));

    await processPendingAirwallexWebhookEvents();

    expect(mocks.applyAuthoritative).toHaveBeenCalledWith(
      expect.objectContaining({
        providerEvent: expect.objectContaining({
          eventName: FAILURE_EVENT_NAME,
        }),
        authoritative: expect.objectContaining({
          providerStatus: "REQUIRES_PAYMENT_METHOD",
        }),
      }),
    );
  });

  it("acknowledges a stale failure using current intent status without a downgrade override", async () => {
    mocks.claimEvents.mockResolvedValue([claimedAttemptEvent("att_old")]);
    mocks.retrieveIntent.mockResolvedValue(retrievedIntent("att_latest"));

    await processPendingAirwallexWebhookEvents();

    const call = mocks.applyAuthoritative.mock.calls[0]?.[0];
    expect(call.providerEvent.eventName).toBe(FAILURE_EVENT_NAME);
    expect(call.authoritative.providerStatus).toBe(
      "REQUIRES_PAYMENT_METHOD",
    );
    expect(mocks.releaseEvent).not.toHaveBeenCalled();
  });
});
